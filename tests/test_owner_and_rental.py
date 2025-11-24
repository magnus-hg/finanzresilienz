import random

from controllers.owner import average_price, average_rent, list_properties
from controllers.rental import run_simulation


def test_owner_property_listing_includes_mortgage_details():
    rng = random.Random(0)

    results = list_properties({}, rng=rng)

    assert results, "Expected at least one property in listing"
    first = results[0]

    assert "mortgage_monthly_rate" in first
    assert "mortgage_loan_amount" in first
    assert first["mortgage_loan_amount"] >= 0
    assert first["mortgage_monthly_rate"] >= 0


def test_owner_average_price_and_rent_are_positive():
    rng = random.Random(1)

    price_summary = average_price({}, rng=rng)
    rent_summary = average_rent({}, rng=rng)

    assert price_summary["average_price_per_sqm"] > 0
    assert price_summary["observations"] > 0
    assert rent_summary["average_rent_per_sqm"] > 0


def test_rental_simulation_outputs_complete_payload():
    result = run_simulation({})

    assert result["records"], "Simulation should produce yearly records"
    assert result["summary"], "Summary should not be empty"
    assert result["total_investment_cost"] > 0
    assert len(result["records"]) == result["inputs"]["n_years"]


def test_rental_simulation_applies_taxation():
    payload = {"tax_rate": 0.5}

    result = run_simulation(payload)
    first_record = result["records"][0]

    assert first_record["cashflow_after_tax"] < first_record["cashflow_operating"]
