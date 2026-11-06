"""Small shared utilities used across the marketplace backend.

This package intentionally has no Django app config: it only holds pure
helpers (text normalisation, distance maths) so every app can import it
without creating circular dependencies.
"""
