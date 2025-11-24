from dataclasses import asdict
from typing import Any, List

from buy_to_let_model import LoanParams, PropertyParams, RentParams, SimulationParams, simulate
from capital_market import ADDITIONAL_COST_RATE, DEFAULT_INTEREST_RATE
from controllers.controller_utils import json_float, json_int


def _build_simulation_params(payload: dict) -> SimulationParams:
    purchase_price = json_float(payload, "purchase_price", 400_000.0)
    transaction_cost_factor = json_float(payload, "transaction_cost_factor", ADDITIONAL_COST_RATE)
    value_growth_rate = json_float(payload, "value_growth_rate", 0.02)
    depreciation_basis = json_float(payload, "depreciation_basis", purchase_price * 0.8)
    depreciation_rate = json_float(payload, "depreciation_rate", 0.02)

    property_params = PropertyParams(
        purchase_price=purchase_price,
        transaction_cost_factor=transaction_cost_factor,
        value_growth_rate=value_growth_rate,
        depreciation_basis=depreciation_basis,
        depreciation_rate=depreciation_rate,
    )

    loan_principal = json_float(payload, "loan_principal", purchase_price * 0.8)
    loan_interest_rate = json_float(payload, "loan_interest_rate", DEFAULT_INTEREST_RATE)
    loan_years = max(json_int(payload, "loan_years", 30), 1)
    annuity_raw = json_float(payload, "loan_annuity", 0.0)
    annuity = annuity_raw if annuity_raw > 0 else None

    loan_params = LoanParams(
        principal=loan_principal,
        interest_rate=loan_interest_rate,
        years=loan_years,
        annuity=annuity,
    )

    rent_params = RentParams(
        net_cold_rent_month=json_float(payload, "net_cold_rent_month", 1400.0),
        operating_costs_month=json_float(payload, "operating_costs_month", 220.0),
        mgmt_costs_annual=json_float(payload, "mgmt_costs_annual", 1200.0),
        rent_increase_rate=json_float(payload, "rent_increase_rate", 0.03),
        rent_increase_interval_years=max(json_int(payload, "rent_increase_interval_years", 3), 1),
    )

    start_year = json_int(payload, "start_year", 2025)
    n_years = max(json_int(payload, "n_years", 20), 1)
    tax_rate = max(json_float(payload, "tax_rate", 0.25), 0.0)

    return SimulationParams(
        start_year=start_year,
        n_years=n_years,
        property_params=property_params,
        loan_params=loan_params,
        rent_params=rent_params,
        tax_rate=tax_rate,
    )


def _summarize_simulation(records: List[dict]):
    if not records:
        return {}

    first_row = records[0]
    last_row = records[-1]

    def _sum(field: str) -> float:
        return sum(float(r.get(field, 0) or 0) for r in records)

    return {
        "cashflow_year1": first_row.get("cashflow_operating", 0.0),
        "cashflow_after_tax_year1": first_row.get("cashflow_after_tax", 0.0),
        "warm_rent_year1": first_row.get("warm_rent_year", 0.0),
        "taxes_year1": first_row.get("taxes", 0.0),
        "equity_final": last_row.get("equity_end", 0.0),
        "property_value_final": last_row.get("property_value_end", 0.0),
        "loan_rest_final": last_row.get("loan_rest_end", 0.0),
        "total_taxes": _sum("taxes"),
        "total_operating_cashflow": _sum("cashflow_operating"),
        "total_cashflow_after_tax": _sum("cashflow_after_tax"),
    }


def run_simulation(payload: dict) -> dict:
    params = _build_simulation_params(payload)
    records = simulate(params)
    summary = _summarize_simulation(records)

    return {
        "inputs": {
            "property": asdict(params.property_params),
            "loan": asdict(params.loan_params),
            "rent": asdict(params.rent_params),
            "tax_rate": params.tax_rate,
            "start_year": params.start_year,
            "n_years": params.n_years,
        },
        "summary": summary,
        "records": [
            {key: round(value, 2) if isinstance(value, (int, float)) else value for key, value in record.items()}
            for record in records
        ],
        "total_investment_cost": round(
            params.property_params.purchase_price * (1 + params.property_params.transaction_cost_factor),
            2,
        ),
    }
