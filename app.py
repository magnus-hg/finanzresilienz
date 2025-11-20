import random
from dataclasses import dataclass, asdict
from typing import List, Optional, Tuple

from flask import Flask, jsonify, redirect, render_template, request, url_for

from buy_to_let_model import (
    LoanParams,
    PropertyParams,
    RentParams,
    SimulationParams,
    simulate,
)
from utils import MAX_AMORTIZATION_YEARS, mortgage_schedule

DEFAULT_INTEREST_RATE = 0.01
DEFAULT_TILGUNG_RATE = 0.04
ADDITIONAL_COST_RATE = 0.105


def est_2025(zve: float) -> float:
    """
    Einkommensteuer 2025 nach §32a EStG
    zvE = zu versteuerndes Einkommen
    Returns: tax amount (ESt)
    """

    y = (zve - 11_604) / 10_000
    z = (zve - 17_005) / 10_000

    if zve <= 11_604:
        tax = 0

    elif zve <= 17_005:  # Progression Zone 1
        tax = (922.98 * y + 1_400) * y

    elif zve <= 66_760:  # Progression Zone 2
        tax = (181.19 * z + 2_397) * z + 1_028

    elif zve <= 277_825:  # 42% zone
        tax = 0.42 * zve - 10_887.29

    else:  # 45% zone
        tax = 0.45 * zve - 19_322.04

    return tax


def tax_rates(zve: float) -> Tuple[float, float, float]:
    """
    Returns:
      est: Einkommensteuer
      avg_rate: Durchschnittssteuersatz (in %)
      marginal_rate: Grenzsteuersatz (in %)
    """

    est = est_2025(zve)

    avg_rate = est / zve * 100 if zve > 0 else 0

    if zve <= 11_604:
        marginal = 0
    elif zve <= 17_005:
        y = (zve - 11_604) / 10_000
        marginal = (2 * 922.98 * y + 1_400) / 10_000 * 100
    elif zve <= 66_760:
        z = (zve - 17_005) / 10_000
        marginal = (2 * 181.19 * z + 2_397) / 10_000 * 100
    elif zve <= 277_825:
        marginal = 42
    else:
        marginal = 45

    return est, avg_rate, marginal


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


def _estimate_rent(living_space_sqm: float, rent_per_sqm: Optional[float], fallback_rent_per_sqm: float) -> Tuple[float, float]:
    rent_rate = rent_per_sqm if rent_per_sqm is not None else fallback_rent_per_sqm
    if rent_rate <= 0 or living_space_sqm <= 0:
        return 0.0, rent_per_sqm or 0.0
    monthly_rent = rent_rate * living_space_sqm
    return round(monthly_rent, 2), rent_rate


def _build_property_payload(
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
) -> List[dict]:
    properties = _generate_properties(30, latitude, longitude, radius)
    filtered = _filter_properties(properties, min_price, max_price, min_size, max_size, min_rooms, max_rooms)
    filtered.sort(key=lambda prop: prop.price_eur, reverse=True)
    average_rent_per_sqm = _average_price_per_sqm(latitude, longitude, radius, rent=True)

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

    estimated_rent_month, used_rent_rate = _estimate_rent(
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
        interest_rate,
        initial_tilgung_rate,
        available_assets,
        additional_cost_rate,
    )
    return jsonify({
        "properties": payload,
        "count": len(payload),
        "interest_rate": interest_rate,
        "tilgung_rate": initial_tilgung_rate,
        "additional_cost_rate": additional_cost_rate,
    })


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


def _collect_average_price(
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
) -> Tuple[float, int]:
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
            interest_rate,
            initial_tilgung_rate,
            0.0,
            additional_cost_rate,
        )
        for prop in payload:
            value = prop.get("price_per_sqm")
            if isinstance(value, (int, float)) and value > 0:
                observed_values.append(value)
    if not observed_values:
        return 0.0, 0
    return round(sum(observed_values) / len(observed_values), 2), len(observed_values)


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
    average_value = _average_price_per_sqm(latitude, longitude, radius, rent=True)
    return jsonify({
        "latitude": latitude,
        "longitude": longitude,
        "radius_km": radius,
        "average_rent_per_sqm": average_value,
    })


@app.route("/api/tax", methods=["POST"])
def calculate_tax():
    payload = request.get_json(silent=True) or {}
    zve = max(_json_float(payload, "zve", 0.0), 0.0)

    est, avg_rate, marginal_rate = tax_rates(zve)

    def _tax_curve(max_income: float, step: float = 1_000.0) -> list[dict]:
        capped_income = max(max_income, 300_000)
        points = []
        income = 0.0

        while income <= capped_income:
            est_point, avg_point, marginal_point = tax_rates(income)
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
            est_point, avg_point, marginal_point = tax_rates(capped_income)
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
            "zve": zve,
            "est": round(est, 2),
            "avg_rate": round(avg_rate, 2),
            "marginal_rate": round(marginal_rate, 2),
            "curve": _tax_curve(max_income=zve),
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
