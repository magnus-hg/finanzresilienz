import random
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")


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

    properties = _generate_properties(30, latitude, longitude, radius)
    filtered = _filter_properties(properties, min_price, max_price, min_size, max_size, min_rooms, max_rooms)

    payload = [
        {
            **asdict(prop),
            "price_per_sqm": prop.price_per_sqm,
            "rent_per_sqm": prop.rent_per_sqm,
        }
        for prop in filtered
    ]
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


@app.route("/average-price")
def average_price():
    latitude = _parse_float("latitude", 52.52)
    longitude = _parse_float("longitude", 13.405)
    radius = max(_parse_float("radius", 5), 0.1)
    average_value = _average_price_per_sqm(latitude, longitude, radius)
    return jsonify({
        "latitude": latitude,
        "longitude": longitude,
        "radius_km": radius,
        "average_price_per_sqm": average_value,
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


def _serve_html(filename: str):
    return send_from_directory(BASE_DIR, filename)


@app.route("/")
def home_page():
    return _serve_html("index.html")


@app.route("/immobilienrechner")
def mortgage_page():
    return _serve_html("immobilienrechner.html")


@app.route("/wohnungssuche")
def housing_page():
    return _serve_html("wohnungssuche.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
