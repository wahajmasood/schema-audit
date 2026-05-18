"""Smoke tests for the stdlib HTML parser wrapper."""

from schema_audit._html import (
    Element,
    get_attr,
    has_attr,
    is_element,
    is_text_node,
    parse_html,
    text_content,
)


def _find(node, tag):
    if isinstance(node, Element):
        if node.tag_name == tag:
            return node
        for c in node.children:
            r = _find(c, tag)
            if r is not None:
                return r
    return None


def test_parses_basic_document():
    root = parse_html("<html><body><p>hello</p></body></html>")
    assert root.tag_name == "#document"
    p = _find(root, "p")
    assert p is not None
    assert text_content(p) == "hello"


def test_lowercases_tag_names_and_attribute_keys():
    root = parse_html('<DIV ItemScope ITEMTYPE="https://schema.org/Product"></DIV>')
    div = _find(root, "div")
    assert div is not None
    assert "itemscope" in div.attrs
    assert "itemtype" in div.attrs
    assert div.attrs["itemtype"] == "https://schema.org/Product"


def test_void_elements_have_no_children():
    root = parse_html('<div><meta name="x" content="y"><img src="i.jpg"></div>')
    meta = _find(root, "meta")
    img = _find(root, "img")
    assert meta is not None and meta.children == []
    assert img is not None and img.children == []


def test_get_attr_and_has_attr():
    root = parse_html('<a href="https://x" data-x="1">Hi</a>')
    a = _find(root, "a")
    assert get_attr(a, "href") == "https://x"
    assert get_attr(a, "missing") is None
    assert has_attr(a, "data-x")
    assert not has_attr(a, "missing")


def test_text_content_descends():
    root = parse_html("<div>A <span>B</span> C</div>")
    div = _find(root, "div")
    assert text_content(div) == "A B C"


def test_is_element_and_is_text_node():
    root = parse_html("<p>hi</p>")
    p = _find(root, "p")
    assert is_element(p)
    assert not is_text_node(p)
    assert is_text_node(p.children[0])


def test_malformed_html_does_not_raise():
    # Mis-nested tags should not crash the parser.
    root = parse_html("<div><span>unclosed div<p>another</span></p>")
    assert root.tag_name == "#document"
