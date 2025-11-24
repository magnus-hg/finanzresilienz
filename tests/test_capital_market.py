import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from capital_market import (
    Property,
    _serialize_property_with_mortgage,
    build_property_payload,
)


def test_build_property_payload_contains_mortgage_details():
    rng = random.Random(0)
    payload = build_property_payload(
        latitude=52.52,
        longitude=13.405,
        radius=1.0,
        min_price=0,
        max_price=2_000_000,
        min_size=0,
        max_size=1_000,
        min_rooms=1,
        max_rooms=10,
        interest_rate=0.02,
        initial_tilgung_rate=0.03,
        available_assets=50_000,
        additional_cost_rate=0.1,
        rng=rng,
    )

    assert payload, "expected at least one property in the payload"

    first = payload[0]
    expected_total_price = first["price_eur"] * 1.1
    expected_loan = max(expected_total_price - 50_000, 0)

    assert math.isclose(first["mortgage_loan_amount"], expected_loan, rel_tol=1e-6)
    assert math.isclose(
        first["mortgage_monthly_rate"],
        first["mortgage_loan_amount"] * (0.02 + 0.03) / 12,
        rel_tol=1e-6,
    )
    assert first["additional_cost_rate"] == 0.1
    assert first["estimated_rent_month"] >= 0
    assert first["estimated_rent_per_sqm"] >= 0


def test_serialize_property_with_mortgage_calculations():
    prop = Property(
        identifier="test-prop",
        price_eur=300_000,
        living_space_sqm=100.0,
        rooms=3,
        latitude=0.0,
        longitude=0.0,
        address="Test Address",
        property_type="apartment",
        rent_price_eur=None,
    )

    result = _serialize_property_with_mortgage(
        prop,
        interest_rate=0.02,
        initial_tilgung_rate=0.03,
        available_assets=0,
        additional_cost_rate=0.1,
        average_rent_per_sqm=10.0,
    )

    expected_total_price = prop.price_eur * 1.1
    assert math.isclose(result["total_price_eur"], expected_total_price, rel_tol=1e-6)
    assert math.isclose(result["mortgage_loan_amount"], expected_total_price, rel_tol=1e-6)
    assert math.isclose(result["estimated_rent_month"], 1000.0, rel_tol=1e-6)
    assert math.isclose(
        result["mortgage_monthly_rate"],
        expected_total_price * (0.02 + 0.03) / 12,
        rel_tol=1e-6,
    )
