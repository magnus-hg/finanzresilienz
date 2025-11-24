from typing import Any, Mapping, Optional

from capital_market import (
    ADDITIONAL_COST_RATE,
    DEFAULT_INTEREST_RATE,
    DEFAULT_TILGUNG_RATE,
    average_price_per_sqm,
    build_property_payload,
    collect_average_price,
)
from controllers.controller_utils import parse_float_arg, parse_int_arg


def list_properties(args: Mapping[str, Any], rng: Optional[Any] = None) -> list[dict]:
    min_price = parse_float_arg(args, "min_price", 0)
    max_price = parse_float_arg(args, "max_price", 2_000_000)
    min_size = parse_float_arg(args, "min_size", 0)
    max_size = parse_float_arg(args, "max_size", 1000)
    min_rooms = parse_int_arg(args, "min_rooms", 1)
    max_rooms = parse_int_arg(args, "max_rooms", 10)
    latitude = parse_float_arg(args, "latitude", 52.52)
    longitude = parse_float_arg(args, "longitude", 13.405)
    radius = max(parse_float_arg(args, "radius", 5), 0.1)
    interest_rate = max(parse_float_arg(args, "interest_rate", DEFAULT_INTEREST_RATE), 0.0)
    initial_tilgung_rate = max(parse_float_arg(args, "tilgung_rate", DEFAULT_TILGUNG_RATE), 0.0001)
    available_assets = max(parse_float_arg(args, "available_assets", 0.0), 0.0)
    additional_cost_rate = max(parse_float_arg(args, "additional_cost_rate", ADDITIONAL_COST_RATE), 0.0)

    return build_property_payload(
        latitude,
        longitude,
        radius,
        min_price,
        max_price,
        min_size,
        max_size,
        min_rooms,
        max_rooms,
        interest_rate,
        initial_tilgung_rate,
        available_assets,
        additional_cost_rate,
        rng=rng,
    )


def average_price(args: Mapping[str, Any], rng: Optional[Any] = None) -> dict:
    min_price = parse_float_arg(args, "min_price", 0)
    max_price = parse_float_arg(args, "max_price", 2_000_000)
    min_size = parse_float_arg(args, "min_size", 0)
    max_size = parse_float_arg(args, "max_size", 1000)
    min_rooms = parse_int_arg(args, "min_rooms", 1)
    max_rooms = parse_int_arg(args, "max_rooms", 10)
    latitude = parse_float_arg(args, "latitude", 52.52)
    longitude = parse_float_arg(args, "longitude", 13.405)
    radius = max(parse_float_arg(args, "radius", 5), 0.1)
    samples = max(parse_int_arg(args, "samples", 5), 1)
    interest_rate = max(parse_float_arg(args, "interest_rate", DEFAULT_INTEREST_RATE), 0.0)
    initial_tilgung_rate = max(parse_float_arg(args, "tilgung_rate", DEFAULT_TILGUNG_RATE), 0.0001)
    additional_cost_rate = max(parse_float_arg(args, "additional_cost_rate", ADDITIONAL_COST_RATE), 0.0)

    average_value, observations = collect_average_price(
        latitude,
        longitude,
        radius,
        min_price,
        max_price,
        min_size,
        max_size,
        min_rooms,
        max_rooms,
        samples,
        interest_rate,
        initial_tilgung_rate,
        additional_cost_rate,
        rng=rng,
    )

    return {
        "latitude": latitude,
        "longitude": longitude,
        "radius_km": radius,
        "samples": samples,
        "average_price_per_sqm": average_value,
        "observations": observations,
        "interest_rate": interest_rate,
        "tilgung_rate": initial_tilgung_rate,
        "additional_cost_rate": additional_cost_rate,
    }


def average_rent(args: Mapping[str, Any], rng: Optional[Any] = None) -> dict:
    latitude = parse_float_arg(args, "latitude", 52.52)
    longitude = parse_float_arg(args, "longitude", 13.405)
    radius = max(parse_float_arg(args, "radius", 5), 0.1)
    average_value = average_price_per_sqm(latitude, longitude, radius, rent=True, rng=rng)

    return {
        "latitude": latitude,
        "longitude": longitude,
        "radius_km": radius,
        "average_rent_per_sqm": average_value,
    }
