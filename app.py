import random
from dataclasses import dataclass, asdict
from typing import List, Optional, Tuple

from flask import Flask, jsonify, render_template, request

from utils import MAX_AMORTIZATION_YEARS, mortgage_schedule

INTEREST_RATE = 0.04
INITIAL_TILGUNG_RATE = 0.01


app = Flask(__name__, static_folder="static", template_folder="templates")


@dataclass
class Property:
    identifier: str
    price_eur: int
    living_space_sqm: float
    rooms: int
    latitude: float
    longitude: float
    address: str
    property_type: str
    rent_price_eur: Optional[int] = None

    @property
    def price_per_sqm(self) -> float:
        return round(self.price_eur / self.living_space_sqm, 2)

    @property
    def rent_per_sqm(self) -> Optional[float]:
        if self.rent_price_eur is None:
            return None
        return round(self.rent_price_eur / self.living_space_sqm, 2)




def _deg_per_km() -> float:
    """Approximate number of degrees latitude per kilometre."""
    return 1.0 / 111.0


def _random_coordinate(base: float, radius_km: float) -> float:
    jitter = random.uniform(-radius_km, radius_km) * _deg_per_km()
    return base + jitter


def _generate_property(base_lat: float, base_lon: float, radius: float, index: int) -> Property:
    size = round(random.uniform(35, 160), 2)
    price = int(random.uniform(100_000, 1_500_000))
    rooms = random.randint(1, 6)
    rent_price = int(random.uniform(800, 4000)) if random.random() > 0.4 else None
    return Property(
        identifier=f"property-{index}",
        price_eur=price,
        living_space_sqm=size,
        rooms=rooms,
        latitude=_random_coordinate(base_lat, radius),
        longitude=_random_coordinate(base_lon, radius),
        address=f"Random Street {random.randint(1, 200)}, {random.randint(10000, 99999)} Sample City",
        property_type=random.choice(["apartment", "loft", "condo", "house"]),
        rent_price_eur=rent_price,
    )


def _parse_float(param: str, default: float) -> float:
    value = request.args.get(param)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _parse_int(param: str, default: int) -> int:
    value = request.args.get(param)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _generate_properties(count: int, base_lat: float, base_lon: float, radius: float) -> List[Property]:
    return [_generate_property(base_lat, base_lon, radius, i) for i in range(count)]


def _filter_properties(properties: List[Property], min_price: float, max_price: float,
                        min_size: float, max_size: float, min_rooms: int, max_rooms: int) -> List[Property]:
    result = []
    for prop in properties:
        if not (min_price <= prop.price_eur <= max_price):
            continue
        if not (min_size <= prop.living_space_sqm <= max_size):
            continue
        if not (min_rooms <= prop.rooms <= max_rooms):
            continue
        result.append(prop)
    return result


def _build_property_payload(latitude: float, longitude: float, radius: float,
                            min_price: float, max_price: float,
                            min_size: float, max_size: float,
                            min_rooms: int, max_rooms: int) -> List[dict]:
    properties = _generate_properties(30, latitude, longitude, radius)
    filtered = _filter_properties(properties, min_price, max_price, min_size, max_size, min_rooms, max_rooms)
    filtered.sort(key=lambda prop: prop.price_eur, reverse=True)
    return [
        _serialize_property_with_mortgage(prop)
        for prop in filtered
    ]


def _serialize_property_with_mortgage(prop: Property) -> dict:
    schedule, total_interest, total_paid = mortgage_schedule(
        prop.price_eur,
        INTEREST_RATE,
        INITIAL_TILGUNG_RATE,
        MAX_AMORTIZATION_YEARS,
    )
    mortgage_years = len(schedule)
    return {
        **asdict(prop),
        "price_per_sqm": prop.price_per_sqm,
        "rent_per_sqm": prop.rent_per_sqm,
        "mortgage_years": mortgage_years,
        "mortgage_total_interest": round(total_interest, 2),
        "mortgage_total_paid": round(total_paid, 2),
    }


@app.route("/properties")
def list_properties():
    min_price = _parse_float("min_price", 0)
    max_price = _parse_float("max_price", 2_000_000)
    min_size = _parse_float("min_size", 0)
    max_size = _parse_float("max_size", 1000)
    min_rooms = _parse_int("min_rooms", 1)
    max_rooms = _parse_int("max_rooms", 10)
    latitude = _parse_float("latitude", 52.52)
    longitude = _parse_float("longitude", 13.405)
    radius = max(_parse_float("radius", 5), 0.1)

    payload = _build_property_payload(
        latitude,
        longitude,
        radius,
        min_price,
        max_price,
        min_size,
        max_size,
        min_rooms,
        max_rooms,
    )
    return jsonify({"properties": payload, "count": len(payload)})


def _average_price_per_sqm(base_lat: float, base_lon: float, radius: float, rent: bool = False) -> float:
    properties = _generate_properties(50, base_lat, base_lon, radius)
    per_sqm_values = []
    for prop in properties:
        value = prop.rent_per_sqm if rent else prop.price_per_sqm
        if value is not None:
            per_sqm_values.append(value)
    if not per_sqm_values:
        return 0.0
    return round(sum(per_sqm_values) / len(per_sqm_values), 2)


def _collect_average_price(latitude: float, longitude: float, radius: float,
                           min_price: float, max_price: float,
                           min_size: float, max_size: float,
                           min_rooms: int, max_rooms: int,
                           samples: int) -> Tuple[float, int]:
    observed_values: List[float] = []
    for _ in range(samples):
        payload = _build_property_payload(
            latitude,
            longitude,
            radius,
            min_price,
            max_price,
            min_size,
            max_size,
            min_rooms,
            max_rooms,
        )
        for prop in payload:
            value = prop.get("price_per_sqm")
            if isinstance(value, (int, float)) and value > 0:
                observed_values.append(value)
    if not observed_values:
        return 0.0, 0
    return round(sum(observed_values) / len(observed_values), 2), len(observed_values)


@app.route("/average-price")
def average_price():
    min_price = _parse_float("min_price", 0)
    max_price = _parse_float("max_price", 2_000_000)
    min_size = _parse_float("min_size", 0)
    max_size = _parse_float("max_size", 1000)
    min_rooms = _parse_int("min_rooms", 1)
    max_rooms = _parse_int("max_rooms", 10)
    latitude = _parse_float("latitude", 52.52)
    longitude = _parse_float("longitude", 13.405)
    radius = max(_parse_float("radius", 5), 0.1)
    samples = max(_parse_int("samples", 5), 1)

    average_value, observations = _collect_average_price(
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
    )

    return jsonify({
        "latitude": latitude,
        "longitude": longitude,
        "radius_km": radius,
        "samples": samples,
        "average_price_per_sqm": average_value,
        "observations": observations,
    })


@app.route("/average-rent")
def average_rent():
    latitude = _parse_float("latitude", 52.52)
    longitude = _parse_float("longitude", 13.405)
    radius = max(_parse_float("radius", 5), 0.1)
    average_value = _average_price_per_sqm(latitude, longitude, radius, rent=True)
    return jsonify({
        "latitude": latitude,
        "longitude": longitude,
        "radius_km": radius,
        "average_rent_per_sqm": average_value,
    })


@app.route("/")
def home_page():
    return render_template("index.html")


@app.route("/immobilienrechner")
def mortgage_page():
    return render_template("immobilienrechner.html")


@app.route("/wohnungssuche")
def housing_page():
    return render_template("wohnungssuche.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
