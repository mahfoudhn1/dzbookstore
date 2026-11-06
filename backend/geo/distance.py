"""Haversine distance for PostgreSQL, without requiring the PostGIS extension.

The catalog stores latitude/longitude as plain floats.  A radius search is a
straightforward great-circle annotation; if PostGIS becomes available later the
same module can switch to ``ST_Distance`` without changing callers.
"""
import math

from django.db.models import Case, ExpressionWrapper, F, FloatField, Func, Value, When


def radians(expression):
    return Func(expression, function='RADIANS')


def haversine_expression(lat_field, lng_field, latitude, longitude):
    """Return a distance-in-kilometres expression for the given coordinates."""
    latitude = float(latitude)
    longitude = float(longitude)
    lat_rad = math.radians(latitude)
    lng_rad = math.radians(longitude)

    cos_angle = (
        Func(radians(lat_field), function='COS') * math.cos(lat_rad) *
        Func(radians(lng_field) - Value(lng_rad), function='COS')
        + Func(radians(lat_field), function='SIN') * math.sin(lat_rad)
    )
    # Floating point round-off can push the cosine just outside [-1, 1] and
    # make ACOS error; clamping to 1 keeps antipodal points at 20 000 km.
    clamped = Func(cos_angle, Value(1.0), function='LEAST')
    return ExpressionWrapper(
        Value(6371.0) * Func(clamped, function='ACOS'),
        output_field=FloatField(),
    )


def seller_coordinates():
    """Exact bookstore coordinates, or opted-in individual seller coordinates.

    Individual sellers who have not opted into showing their precise location
    contribute NULL so they are excluded from distance sorting rather than
    leaking their home address.
    """
    individual_lat = Case(
        When(individual_seller__show_exact_location=True, then=F('individual_seller__latitude')),
        default=Value(None),
        output_field=FloatField(),
    )
    individual_lng = Case(
        When(individual_seller__show_exact_location=True, then=F('individual_seller__longitude')),
        default=Value(None),
        output_field=FloatField(),
    )
    return individual_lat, individual_lng
