"""RDFa extractor.

Ports ``core/src/utils/rdfa-extractor.ts``. Walks the HTML tree
top-down, tracking the inherited ``vocab`` as we descend. When we hit a
``[typeof]`` element, we extract it as a top-level item — descending
into nested ``[typeof]`` is handled by the item's own recursion (not
the top-level walk).

Per-element value-extraction:

- ``content=`` attribute is the universal RDFa override
- ``meta``                            → ``content``
- ``a``, ``link``                     → ``href``
- ``img``/``audio``/``video``/...     → ``src``
- ``object``                          → ``data``
- ``data``, ``meter``                 → ``value``
- ``time``                            → ``datetime`` / text
- ``[resource]`` (no ``typeof``)      → ``resource`` URI
- anything else                       → trimmed text

Cycle-10 limitations (mirror the JS cycle-7 limitations exactly):

- CURIE prefixes (``typeof="schema:Product"``) emit ``INVALID_ITEMTYPE``
  with the same message JS uses.
- Non-schema.org vocab subtree silently produces no item.

Pure: no I/O.
"""

from __future__ import annotations

import re

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
from .errors import invalid_itemtype, no_vocab
from .registry import load_registry
from .types import Issue

_REGISTRY = load_registry()

_SCHEMA_VOCAB_RE = re.compile(r"^https?://(?:www\.)?schema\.org/?$")
_SCHEMA_TYPE_URL_RE = re.compile(
    r"^https?://(?:www\.)?schema\.org/([A-Za-z][A-Za-z0-9]*)/?$"
)


def _extract_element_value(el: Element) -> str:
    """RDFa value-extraction: content= attribute is the universal override."""
    content = get_attr(el, "content")
    if content is not None:
        return content

    tag = el.tag_name.lower()
    if tag == "meta":
        return ""  # unreachable: meta with no content already handled above
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

    # RDFa-specific: resource attribute is a URI reference when present
    # and no typeof is on the element.
    resource = get_attr(el, "resource")
    if resource is not None:
        return resource
    return text_content(el).strip()


def _collect_property_elements(scope: Element) -> list[Element]:
    """Find descendants with ``[property]`` belonging to THIS scope.

    Don't descend into nested ``[typeof]`` — those properties belong to
    the nested item.
    """
    result: list[Element] = []

    def recurse(node: Element | TextNode) -> None:
        if not is_element(node):
            for c in children(node):
                recurse(c)
            return
        assert isinstance(node, Element)

        has_prop = has_attr(node, "property")
        is_inner_type = has_attr(node, "typeof") and node is not scope

        if has_prop:
            result.append(node)
            if has_attr(node, "typeof"):
                return  # nested item; children belong to it
        elif is_inner_type:
            return  # orphan nested typeof from this scope's perspective

        for c in node.children:
            recurse(c)

    for c in scope.children:
        recurse(c)
    return result


def _extract_item(
    el: Element,
    current_vocab: str | None,
    issues: list[Issue],
) -> dict[str, object] | None:
    typeof_val = (get_attr(el, "typeof") or "").strip()
    own_vocab = get_attr(el, "vocab")
    vocab = own_vocab if own_vocab is not None else current_vocab

    type_name: str | None = None
    itemtype_raw = typeof_val

    full_url_match = _SCHEMA_TYPE_URL_RE.match(typeof_val)
    if full_url_match:
        type_name = full_url_match.group(1)
    elif ":" in typeof_val:
        issues.append(
            invalid_itemtype(
                typeof_val,
                (
                    "CURIE prefixes (schema:Product) are not supported in cycle 7. "
                    "Use vocab= + bare typeof, or a fully-qualified URL."
                ),
            )
        )
        # continue without type_name; per-item will emit MISSING_TYPE
    elif not vocab:
        issues.append(no_vocab(typeof_val))
        return None
    elif not _SCHEMA_VOCAB_RE.match(vocab.strip()):
        # vocab is set but not schema.org — silently no item from this subtree
        return None
    else:
        type_name = typeof_val

    if type_name is not None and type_name not in _REGISTRY["types"]:
        issues.append(
            invalid_itemtype(
                typeof_val,
                f'Type "{type_name}" is not in the registry.',
            )
        )
        # keep type_name so per-item emits UNKNOWN_TYPE consistently

    item: dict[str, object] = {"@context": "https://schema.org"}
    if type_name is not None:
        item["@type"] = type_name
    item["@itemtypeRaw"] = itemtype_raw

    resource = get_attr(el, "resource")
    if resource is not None:
        item["@id"] = resource

    for prop_el in _collect_property_elements(el):
        prop_attr = (get_attr(prop_el, "property") or "").strip()
        prop_names = [name for name in prop_attr.split() if name]
        if not prop_names:
            continue

        value: object
        if has_attr(prop_el, "typeof"):
            nested = _extract_item(prop_el, vocab, issues)
            value = nested if nested is not None else ""
        else:
            value = _extract_element_value(prop_el)

        for name in prop_names:
            item[name] = value

    return item


def _walk_top_level(
    node: Element | TextNode,
    current_vocab: str | None,
    items: list[dict[str, object]],
    issues: list[Issue],
) -> None:
    if not is_element(node):
        for c in children(node):
            _walk_top_level(c, current_vocab, items, issues)
        return
    assert isinstance(node, Element)

    own_vocab = get_attr(node, "vocab")
    new_vocab = own_vocab if own_vocab is not None else current_vocab

    if has_attr(node, "typeof"):
        item = _extract_item(node, new_vocab, issues)
        if item is not None:
            items.append(item)
        return  # nested typeofs handled by the item's own recursion

    for c in node.children:
        _walk_top_level(c, new_vocab, items, issues)


def extract_rdfa(html: str) -> tuple[list[dict[str, object]], list[Issue]]:
    """Parse HTML and extract RDFa items.

    Returns a 2-tuple ``(items, extraction_issues)``. ``items`` are
    JSON-LD-shaped dicts each carrying ``@context``, optional
    ``@type``, optional ``@itemtypeRaw``, and property keys.
    """
    extraction_issues: list[Issue] = []
    doc = parse_html(html)

    items: list[dict[str, object]] = []
    _walk_top_level(doc, None, items, extraction_issues)
    return items, extraction_issues
