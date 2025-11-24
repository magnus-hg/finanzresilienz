"""Capital market utilities for property search and mortgage calculations."""
from dataclasses import asdict, dataclass
import random
from typing import List, Optional, Tuple

from loan_utils import MAX_AMORTIZATION_YEARS, mortgage_schedule

DEFAULT_INTEREST_RATE = 0.01
DEFAULT_TILGUNG_RATE = 0.04
ADDITIONAL_COST_RATE = 0.105


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


def _random_coordinate(base: float, radius_km: float, rng: random.Random) -> float:
    jitter = rng.uniform(-radius_km, radius_km) * _deg_per_km()
    return base + jitter


def _generate_property(
    base_lat: float, base_lon: float, radius: float, index: int, rng: random.Random
) -> Property:
    size = round(rng.uniform(35, 160), 2)
    price = int(rng.uniform(100_000, 1_500_000))
    rooms = rng.randint(1, 6)
    rent_price = int(rng.uniform(800, 4000)) if rng.random() > 0.4 else None
    return Property(
        identifier=f"property-{index}",
        price_eur=price,
        living_space_sqm=size,
        rooms=rooms,
        latitude=_random_coordinate(base_lat, radius, rng),
        longitude=_random_coordinate(base_lon, radius, rng),
        address=f"Random Street {rng.randint(1, 200)}, {rng.randint(10000, 99999)} Sample City",
        property_type=rng.choice(["apartment", "loft", "condo", "house"]),
        rent_price_eur=rent_price,
    )


def _generate_properties(
    count: int, base_lat: float, base_lon: float, radius: float, rng: Optional[random.Random] = None
) -> List[Property]:
    rng = rng or random
    return [_generate_property(base_lat, base_lon, radius, i, rng) for i in range(count)]


def _filter_properties(
    properties: List[Property],
    min_price: float,
    max_price: float,
    min_size: float,
    max_size: float,
    min_rooms: int,
    max_rooms: int,
) -> List[Property]:
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


def estimate_rent(
    living_space_sqm: float, rent_per_sqm: Optional[float], fallback_rent_per_sqm: float
) -> Tuple[float, float]:
    rent_rate = rent_per_sqm if rent_per_sqm is not None else fallback_rent_per_sqm
    if rent_rate <= 0 or living_space_sqm <= 0:
        return 0.0, rent_per_sqm or 0.0
    monthly_rent = rent_rate * living_space_sqm
    return round(monthly_rent, 2), rent_rate


def _serialize_property_with_mortgage(
    prop: Property,
    interest_rate: float,
    initial_tilgung_rate: float,
    available_assets: float,
    additional_cost_rate: float,
    average_rent_per_sqm: float,
) -> dict:
    usable_assets = max(available_assets, 0)
    cost_rate = max(additional_cost_rate, 0)
    total_price = prop.price_eur * (1 + cost_rate)
    additional_costs = total_price - prop.price_eur
    loan_amount = max(total_price - usable_assets, 0)

    estimated_rent_month, used_rent_rate = estimate_rent(
        prop.living_space_sqm,
        prop.rent_per_sqm,
        average_rent_per_sqm,
    )

    if loan_amount > 0:
        schedule, total_interest, total_paid = mortgage_schedule(
            loan_amount,
            interest_rate,
            initial_tilgung_rate,
            MAX_AMORTIZATION_YEARS,
        )
        mortgage_years = len(schedule)
        annual_annuity = loan_amount * (interest_rate + initial_tilgung_rate)
        monthly_rate = annual_annuity / 12 if annual_annuity > 0 else 0
    else:
        schedule = []
        total_interest = 0.0
        total_paid = 0.0
        mortgage_years = 0
        monthly_rate = 0.0

    return {
        **asdict(prop),
        "price_per_sqm": prop.price_per_sqm,
        "rent_per_sqm": prop.rent_per_sqm,
        "available_assets": usable_assets,
        "additional_costs_eur": round(additional_costs),
        "total_price_eur": round(total_price),
        "additional_cost_rate": cost_rate,
        "mortgage_years": mortgage_years,
        "mortgage_total_interest": round(total_interest, 2),
        "mortgage_total_paid": round(total_paid, 2),
        "mortgage_monthly_rate": round(monthly_rate, 2),
        "mortgage_interest_rate": interest_rate,
        "mortgage_tilgung_rate": initial_tilgung_rate,
        "mortgage_loan_amount": loan_amount,
        "estimated_rent_month": estimated_rent_month,
        "estimated_rent_per_sqm": used_rent_rate,
    }


def build_property_payload(
    latitude: float,
    longitude: float,
    radius: float,
    min_price: float,
    max_price: float,
    min_size: float,
    max_size: float,
    min_rooms: int,
    max_rooms: int,
    interest_rate: float,
    initial_tilgung_rate: float,
    available_assets: float,
    additional_cost_rate: float,
    rng: Optional[random.Random] = None,
) -> List[dict]:
    rng = rng or random
    properties = _generate_properties(30, latitude, longitude, radius, rng)
    filtered = _filter_properties(
        properties, min_price, max_price, min_size, max_size, min_rooms, max_rooms
    )
    filtered.sort(key=lambda prop: prop.price_eur, reverse=True)
    average_rent_per_sqm = average_price_per_sqm(latitude, longitude, radius, rent=True, rng=rng)

    return [
        _serialize_property_with_mortgage(
            prop,
            interest_rate,
            initial_tilgung_rate,
            available_assets,
            additional_cost_rate,
            average_rent_per_sqm,
        )
        for prop in filtered
    ]


def average_price_per_sqm(
    base_lat: float, base_lon: float, radius: float, rent: bool = False, rng: Optional[random.Random] = None
) -> float:
    rng = rng or random
    properties = _generate_properties(50, base_lat, base_lon, radius, rng)
    per_sqm_values = []
    for prop in properties:
        value = prop.rent_per_sqm if rent else prop.price_per_sqm
        if value is not None:
            per_sqm_values.append(value)
    if not per_sqm_values:
        return 0.0
    return round(sum(per_sqm_values) / len(per_sqm_values), 2)


def collect_average_price(
    latitude: float,
    longitude: float,
    radius: float,
    min_price: float,
    max_price: float,
    min_size: float,
    max_size: float,
    min_rooms: int,
    max_rooms: int,
    samples: int,
    interest_rate: float,
    initial_tilgung_rate: float,
    additional_cost_rate: float,
    rng: Optional[random.Random] = None,
) -> Tuple[float, int]:
    rng = rng or random
    observed_values: List[float] = []
    for _ in range(samples):
        payload = build_property_payload(
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
            0.0,
            additional_cost_rate,
            rng=rng,
        )
        for prop in payload:
            value = prop.get("price_per_sqm")
            if isinstance(value, (int, float)) and value > 0:
                observed_values.append(value)
    if not observed_values:
        return 0.0, 0
    return round(sum(observed_values) / len(observed_values), 2), len(observed_values)
