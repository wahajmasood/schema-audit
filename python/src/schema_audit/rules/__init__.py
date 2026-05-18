"""Atomic validation rules.

Every rule is a pure function ``(...) -> list[Issue]`` (Design Tenet #2).
No I/O, no shared state, no side effects. The orchestrator
(:mod:`schema_audit._per_item`) calls them in sequence and threads the
returned issues into the right bucket.
"""

from .validate_context import validate_context
from .validate_property_existence import validate_property_existence
from .validate_property_value_type import validate_property_value_type
from .validate_recommended import validate_recommended
from .validate_required import validate_required
from .validate_type import validate_type
from .validate_url import validate_url

__all__ = [
    "validate_context",
    "validate_property_existence",
    "validate_property_value_type",
    "validate_recommended",
    "validate_required",
    "validate_type",
    "validate_url",
]
