from dataclasses import asdict
from typing import Tuple

from flask import Flask, jsonify, redirect, render_template, request, url_for

from capital_market import (
    ADDITIONAL_COST_RATE,
    DEFAULT_INTEREST_RATE,
    DEFAULT_TILGUNG_RATE,
    average_price_per_sqm,
    build_property_payload,
    collect_average_price,
)
from buy_to_let_model import (
    LoanParams,
    PropertyParams,
    RentParams,
    SimulationParams,
    simulate,
)
from tax_calculations import (
    est_2026,
    est_2026_married,
    tax_rates_married,
    tax_rates_single,
)
from utils import MAX_AMORTIZATION_YEARS, mortgage_schedule


app = Flask(__name__, static_folder="static", template_folder="templates")
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


def _json_float(payload: dict, key: str, default: float) -> float:
    try:
        value = payload.get(key, default)
        if value in ("", None):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _json_int(payload: dict, key: str, default: int) -> int:
    try:
        value = payload.get(key, default)
        if value in ("", None):
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


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
    interest_rate = max(_parse_float("interest_rate", DEFAULT_INTEREST_RATE), 0.0)
    initial_tilgung_rate = max(_parse_float("tilgung_rate", DEFAULT_TILGUNG_RATE), 0.0001)
    available_assets = max(_parse_float("available_assets", 0.0), 0.0)
    additional_cost_rate = max(_parse_float("additional_cost_rate", ADDITIONAL_COST_RATE), 0.0)

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
        available_assets,
        additional_cost_rate,
    )
def _build_simulation_params(payload: dict) -> SimulationParams:
    purchase_price = _json_float(payload, "purchase_price", 400_000.0)
    transaction_cost_factor = _json_float(
        payload, "transaction_cost_factor", ADDITIONAL_COST_RATE
    )
    value_growth_rate = _json_float(payload, "value_growth_rate", 0.02)
    depreciation_basis = _json_float(
        payload, "depreciation_basis", purchase_price * 0.8
    )
    depreciation_rate = _json_float(payload, "depreciation_rate", 0.02)

    property_params = PropertyParams(
        purchase_price=purchase_price,
        transaction_cost_factor=transaction_cost_factor,
        value_growth_rate=value_growth_rate,
        depreciation_basis=depreciation_basis,
        depreciation_rate=depreciation_rate,
    )

    loan_principal = _json_float(payload, "loan_principal", purchase_price * 0.8)
    loan_interest_rate = _json_float(payload, "loan_interest_rate", DEFAULT_INTEREST_RATE)
    loan_years = max(_json_int(payload, "loan_years", 30), 1)
    annuity_raw = _json_float(payload, "loan_annuity", 0.0)
    annuity = annuity_raw if annuity_raw > 0 else None

    loan_params = LoanParams(
        principal=loan_principal,
        interest_rate=loan_interest_rate,
        years=loan_years,
        annuity=annuity,
    )

    rent_params = RentParams(
        net_cold_rent_month=_json_float(payload, "net_cold_rent_month", 1400.0),
        operating_costs_month=_json_float(payload, "operating_costs_month", 220.0),
        mgmt_costs_annual=_json_float(payload, "mgmt_costs_annual", 1200.0),
        rent_increase_rate=_json_float(payload, "rent_increase_rate", 0.03),
        rent_increase_interval_years=max(
            _json_int(payload, "rent_increase_interval_years", 3), 1
        ),
    )

    start_year = _json_int(payload, "start_year", 2025)
    n_years = max(_json_int(payload, "n_years", 20), 1)
    tax_rate = max(_json_float(payload, "tax_rate", 0.25), 0.0)

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
    interest_rate = max(_parse_float("interest_rate", DEFAULT_INTEREST_RATE), 0.0)
    initial_tilgung_rate = max(_parse_float("tilgung_rate", DEFAULT_TILGUNG_RATE), 0.0001)
    additional_cost_rate = max(_parse_float("additional_cost_rate", ADDITIONAL_COST_RATE), 0.0)

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
    )

    return jsonify({
        "latitude": latitude,
        "longitude": longitude,
        "radius_km": radius,
        "samples": samples,
        "average_price_per_sqm": average_value,
        "observations": observations,
        "interest_rate": interest_rate,
        "tilgung_rate": initial_tilgung_rate,
        "additional_cost_rate": additional_cost_rate,
    })


@app.route("/average-rent")
def average_rent():
    latitude = _parse_float("latitude", 52.52)
    longitude = _parse_float("longitude", 13.405)
    radius = max(_parse_float("radius", 5), 0.1)
    average_value = average_price_per_sqm(latitude, longitude, radius, rent=True)
    return jsonify({
        "latitude": latitude,
        "longitude": longitude,
        "radius_km": radius,
        "average_rent_per_sqm": average_value,
    })


@app.route("/api/tax", methods=["POST"])
def calculate_tax():
    payload = request.get_json(silent=True) or {}
    primary_zve = max(_json_float(payload, "zve", 0.0), 0.0)
    partner_zve = max(_json_float(payload, "partner_zve", 0.0), 0.0)
    filing_status = (payload.get("filing_status") or "single").lower()

    if filing_status == "married":
        est, avg_rate, marginal_rate = tax_rates_married(primary_zve, partner_zve)
        total_zve = primary_zve + partner_zve

        def _tax_calc(income: float) -> Tuple[float, float, float]:
            return tax_rates_married(income, 0.0)

    else:
        est, avg_rate, marginal_rate = tax_rates_single(primary_zve)
        total_zve = primary_zve

        def _tax_calc(income: float) -> Tuple[float, float, float]:
            return tax_rates_single(income)

    def _tax_curve(max_income: float, step: float = 1_000.0) -> list[dict]:
        capped_income = max(max_income, 300_000)
        points = []
        income = 0.0

        while income <= capped_income:
            est_point, avg_point, marginal_point = _tax_calc(income)
            points.append(
                {
                    "zve": round(income, 2),
                    "est": round(est_point, 2),
                    "avg_rate": round(avg_point, 2),
                    "marginal_rate": round(marginal_point, 2),
                }
            )
            income += step

        if capped_income % step != 0:
            # Ensure the upper bound is included for consistent chart lines
            est_point, avg_point, marginal_point = _tax_calc(capped_income)
            points.append(
                {
                    "zve": round(capped_income, 2),
                    "est": round(est_point, 2),
                    "avg_rate": round(avg_point, 2),
                    "marginal_rate": round(marginal_point, 2),
                }
            )

        return points

    return jsonify(
        {
            "zve": total_zve,
            "est": round(est, 2),
            "avg_rate": round(avg_rate, 2),
            "marginal_rate": round(marginal_rate, 2),
            "curve": _tax_curve(max_income=total_zve),
            "filing_status": filing_status,
        "partner_zve": partner_zve if filing_status == "married" else 0.0,
        }
    )


@app.route("/api/plz/<plz>/market-data")
def plz_market_data(plz: str):
    """Return fixed market data metrics for a given postal code."""

    return jsonify(
        {
            "plz": plz,
            "avg_mietpreis_neuvermietung_per_sqm": 10.0,
            "avg_kaufpreis_per_sqm": 4_000.0,
            "avg_hausgeld_per_sqm": 4.0,
            "umlagefaehiges_hausgeld_per_sqm": 2.75,
        }
    )


@app.route("/api/vermietung/simulation", methods=["POST"])
def buy_to_let_simulation():
    payload = request.get_json(silent=True) or {}
    params = _build_simulation_params(payload)

    records = simulate(params)
    summary = _summarize_simulation(records)

    return jsonify({
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
            params.property_params.purchase_price
            * (1 + params.property_params.transaction_cost_factor),
            2,
        ),
    })


@app.route("/api/vermietung/max-affordable-size", methods=["POST"])
def affordable_size_estimation():
    payload = request.get_json(silent=True) or {}
    
    wealth = data.get("wealth", 200000)
    rent = data.get("repayment_rate", 0.02)
    interest = data.get("interest_rate", 0.04)
    
    price_per_square_meter = data.get("price_per_square_meter", 4000)
    base_rent_per_square_meter = data.get("base_rent_per_square_meter", 10)
    non_chargeable_operating_costs_per_square_meter = data.get("non_chargeable_operating_costs_per_square_meter", 1)
    additional_purchase_costs_factor = data.get("additional_purchase_costs_factor", 1.105)

    annuity = interest + rent
    
    nominator = - wealth * (annuity/12)
    denominator = base_rent_per_square_meter - non_chargeable_operating_costs_per_square_meter - (annuity/12) * price_per_square_meter * additional_purchase_costs_factor
    
    maximally_affordable_size = nominator / denominator
    
    
    
    """
    return jsonify({
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
            params.property_params.purchase_price
            * (1 + params.property_params.transaction_cost_factor),
            2,
        ),
    })
    """


@app.route("/")
def home_page():
    return render_template("index.html")


@app.route("/immobilienrechner")
def mortgage_page():
    return render_template("immobilienrechner.html")


@app.route("/wohnungssuche")
def housing_page():
    return render_template("wohnungssuche.html")


@app.route("/finanzierungsdetails")
def financing_details_page():
    return redirect(url_for("financing_details_owner"))


@app.route("/finanzierungsdetails/eigenheim")
def financing_details_owner():
    return render_template("finanzierungsdetails_eigenheim.html")


@app.route("/finanzierungsdetails/vermietung")
def financing_details_rental():
    return render_template("finanzierungsdetails_vermietung.html")


@app.route("/vermietungsrechner")
def buy_to_let_page():
    return render_template("vermietungsrechner.html")


@app.route("/steuerrechner")
def tax_page():
    return render_template("steuerrechner.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
