"""Stdlib HTML parser wrapper — produces a parse5-shaped DOM tree.

Internal module (cycle 10). Consumers should never import it directly.

The JS side uses ``parse5`` (the one named runtime-dep exception in the
constitution). The Python side stays stdlib-only via
:class:`html.parser.HTMLParser`, wrapped here in a minimal DOM tree
whose ``Element`` / ``TextNode`` shape mirrors what the Microdata and
RDFa extractors expect — so the extractor ports are near-line-by-line
translations of the TypeScript originals.

The tree is intentionally minimal: tag name, lowercased attributes,
ordered children. No CSS selectors, no querying — extractors do their
own recursion using helpers below.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from html.parser import HTMLParser

# HTML5 void elements — never have children, always self-close.
_VOID_TAGS = frozenset(
    {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "source",
        "track",
        "wbr",
    }
)


@dataclass
class TextNode:
    """A run of character data in the document."""

    value: str
    node_name: str = "#text"


@dataclass
class Element:
    """An HTML element: tag, attrs, children.

    Attribute names are lowercased on parse. Attribute values are
    preserved verbatim. ``children`` is the in-order list of child
    nodes (Elements or TextNodes).
    """

    tag_name: str
    attrs: dict[str, str] = field(default_factory=dict)
    children: list[Element | TextNode] = field(default_factory=list)


class _TreeBuilder(HTMLParser):
    """Event-driven HTMLParser that builds a DOM-ish tree."""

    def __init__(self) -> None:
        # Lenient mode — convert character references, don't choke on
        # malformed markup (schema.org markup in the wild often is).
        super().__init__(convert_charrefs=True)
        self.root = Element(tag_name="#document")
        self._stack: list[Element] = [self.root]

    def _current(self) -> Element:
        return self._stack[-1]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        el = Element(
            tag_name=tag.lower(),
            attrs={k.lower(): (v if v is not None else "") for k, v in attrs},
        )
        self._current().children.append(el)
        if tag.lower() not in _VOID_TAGS:
            self._stack.append(el)

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        # `<br />` and friends — append without pushing.
        el = Element(
            tag_name=tag.lower(),
            attrs={k.lower(): (v if v is not None else "") for k, v in attrs},
        )
        self._current().children.append(el)

    def handle_endtag(self, tag: str) -> None:
        tag_l = tag.lower()
        if tag_l in _VOID_TAGS:
            return
        # Unwind stack to the matching open tag. If we can't find one
        # (broken markup) leave the stack alone — best-effort close.
        for i in range(len(self._stack) - 1, 0, -1):
            if self._stack[i].tag_name == tag_l:
                del self._stack[i:]
                return

    def handle_data(self, data: str) -> None:
        # Coalesce adjacent text nodes for cleaner tree.
        children = self._current().children
        if children and isinstance(children[-1], TextNode):
            children[-1].value += data
        else:
            children.append(TextNode(value=data))


def parse_html(html: str) -> Element:
    """Parse an HTML string into a tree rooted at a synthetic
    ``#document`` element. The synthetic root has no attributes; its
    children are the document's top-level elements / text nodes.

    Never raises — malformed HTML produces a best-effort tree.
    """
    builder = _TreeBuilder()
    builder.feed(html)
    builder.close()
    return builder.root


# ── Helpers used by the Microdata + RDFa extractors ─────────────────────────


def is_element(node: object) -> bool:
    return isinstance(node, Element)


def is_text_node(node: object) -> bool:
    return isinstance(node, TextNode)


def get_attr(el: Element, name: str) -> str | None:
    """Return the lowercased-key attribute value, or None when absent."""
    return el.attrs.get(name)


def has_attr(el: Element, name: str) -> bool:
    return name in el.attrs


def children(node: Element | TextNode) -> list[Element | TextNode]:
    if isinstance(node, Element):
        return node.children
    return []


def text_content(node: Element | TextNode) -> str:
    """Concatenate descendant text. Mirrors parse5 textContent()."""
    if isinstance(node, TextNode):
        return node.value
    parts: list[str] = []
    for child in node.children:
        parts.append(text_content(child))
    return "".join(parts)
