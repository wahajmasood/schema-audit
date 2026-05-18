"""Microdata extractor — pulls Microdata items out of an HTML tree and
emits JSON-LD-shaped dicts that the per-item engine can consume.

Ports ``core/src/utils/microdata-extractor.ts`` line-for-line. Per-tag
value-extraction rules:

- ``meta``                                → ``content`` attribute
- ``a``, ``link``                         → ``href`` attribute
- ``img``/``audio``/``video``/``source``/
  ``embed``/``iframe``/``track``          → ``src`` attribute
- ``object``                              → ``data`` attribute
- ``data``, ``meter``                     → ``value`` attribute
- ``time``                                → ``datetime`` (fallback to text)
- any element with ``itemscope``          → recursive extraction → nested object
- anything else                           → trimmed text content

Extraction-time issues (``NO_ITEMSCOPE``, ``MISSING_ITEMTYPE``,
``INVALID_ITEMTYPE``) are returned separately from items so the
orchestrator can fold them into the final ValidationResult.

Pure: no I/O. Same registry the per-item engine uses.
"""

from __future__ import annotations

import re
from typing import TypedDict

from ._html import (
    Element,
    TextNode,
    children,
    get_attr,
    has_attr,
    is_element,
    parse_html,
    text_content,
)
from .errors import invalid_itemtype, missing_itemtype, no_itemscope
from .registry import load_registry
from .types import Issue

_REGISTRY = load_registry()

_SCHEMA_TYPE_RE = re.compile(
    r"^https?://(?:www\.)?schema\.org/([A-Za-z][A-Za-z0-9]*)/?$"
)


class ExtractedItem(TypedDict, total=False):
    """A JSON-LD-shaped dict matching the JS ExtractedItem interface."""

    # The TypedDict is total=False so additional schema.org property keys
    # can sit alongside the reserved ones below at runtime.
    pass


def _extract_type_name(itemtype: str) -> str | None:
    m = _SCHEMA_TYPE_RE.match(itemtype.strip())
    return m.group(1) if m else None


def _extract_element_value(el: Element) -> str:
    """Return the Microdata value for a property element, per its tag."""
    tag = el.tag_name.lower()
    if tag == "meta":
        return get_attr(el, "content") or ""
    if tag in ("a", "link"):
        return get_attr(el, "href") or ""
    if tag in ("img", "audio", "video", "source", "embed", "iframe", "track"):
        return get_attr(el, "src") or ""
    if tag == "object":
        return get_attr(el, "data") or ""
    if tag in ("data", "meter"):
        return get_attr(el, "value") or ""
    if tag == "time":
        dt = get_attr(el, "datetime")
        if dt is not None:
            return dt
        return text_content(el).strip()
    return text_content(el).strip()


def _collect_property_elements(scope: Element) -> list[Element]:
    """Find descendant elements bearing ``itemprop`` that belong to THIS
    scope. Recursion stops at any nested itemscope — those properties
    belong to the nested item.
    """
    result: list[Element] = []

    def recurse(node: Element | TextNode) -> None:
        if not is_element(node):
            for c in children(node):
                recurse(c)
            return
        assert isinstance(node, Element)

        has_itemprop = has_attr(node, "itemprop")
        is_inner_scope = has_attr(node, "itemscope") and node is not scope

        if has_itemprop:
            result.append(node)
            if has_attr(node, "itemscope"):
                # This element is itself a nested item; don't descend —
                # its children belong to the nested item.
                return
        elif is_inner_scope:
            # Bare nested itemscope with no itemprop — orphan from this
            # scope's perspective.
            return

        for c in node.children:
            recurse(c)

    for c in scope.children:
        recurse(c)
    return result


def _extract_item(
    el: Element, is_top_level: bool, issues: list[Issue]
) -> dict[str, object] | None:
    itemtype = get_attr(el, "itemtype")
    type_name: str | None = None
    itemtype_raw: str | None = None

    if itemtype is None:
        if is_top_level:
            issues.append(missing_itemtype())
            return None
        # Nested item without itemtype — allowed; just no @type.
    else:
        itemtype_raw = itemtype
        extracted = _extract_type_name(itemtype)
        if extracted is None:
            issues.append(
                invalid_itemtype(
                    itemtype,
                    "itemtype must be a schema.org URL (https://schema.org/<Type>).",
                )
            )
            # Continue without typeName so per-item emits MISSING_TYPE.
        elif extracted not in _REGISTRY["types"]:
            issues.append(
                invalid_itemtype(itemtype, f'Type "{extracted}" is not in the registry.')
            )
            # Pass through so per-item emits UNKNOWN_TYPE consistently.
            type_name = extracted
        else:
            type_name = extracted

    item: dict[str, object] = {"@context": "https://schema.org"}
    if type_name is not None:
        item["@type"] = type_name
    if itemtype_raw is not None:
        item["@itemtypeRaw"] = itemtype_raw

    itemid = get_attr(el, "itemid")
    if itemid is not None:
        item["@id"] = itemid

    for prop_el in _collect_property_elements(el):
        itemprop = (get_attr(prop_el, "itemprop") or "").strip()
        prop_names = [name for name in itemprop.split() if name]
        if not prop_names:
            continue

        value: object
        if has_attr(prop_el, "itemscope"):
            nested = _extract_item(prop_el, is_top_level=False, issues=issues)
            value = nested if nested is not None else ""
        else:
            value = _extract_element_value(prop_el)

        for name in prop_names:
            item[name] = value

    return item


def _find_orphan_itemtype(node: Element | TextNode, issues: list[Issue]) -> None:
    if is_element(node):
        assert isinstance(node, Element)
        if has_attr(node, "itemtype") and not has_attr(node, "itemscope"):
            issues.append(no_itemscope(node.tag_name))
        for c in node.children:
            _find_orphan_itemtype(c, issues)
    else:
        for c in children(node):
            _find_orphan_itemtype(c, issues)


def _find_top_level_itemscopes(node: Element | TextNode) -> list[Element]:
    result: list[Element] = []

    def recurse(n: Element | TextNode) -> None:
        if is_element(n):
            assert isinstance(n, Element)
            if has_attr(n, "itemscope"):
                result.append(n)
                return  # nested items are handled by the item's own recursion
            for c in n.children:
                recurse(c)
            return
        for c in children(n):
            recurse(c)

    recurse(node)
    return result


def extract_microdata(html: str) -> tuple[list[dict[str, object]], list[Issue]]:
    """Parse HTML and extract Microdata items.

    Returns a 2-tuple ``(items, extraction_issues)``:

    - ``items`` is a list of JSON-LD-shaped dicts (each with
      ``@context``, optional ``@type``, optional ``@itemtypeRaw``, and
      property keys).
    - ``extraction_issues`` are the issues that surface during
      extraction (orphan itemtype, missing itemtype, invalid itemtype).
      They are merged into the final ``ValidationResult`` by the
      orchestrator.
    """
    extraction_issues: list[Issue] = []
    doc = parse_html(html)

    _find_orphan_itemtype(doc, extraction_issues)

    items: list[dict[str, object]] = []
    for el in _find_top_level_itemscopes(doc):
        item = _extract_item(el, is_top_level=True, issues=extraction_issues)
        if item is not None:
            items.append(item)

    return items, extraction_issues
