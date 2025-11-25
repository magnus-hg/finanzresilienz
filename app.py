import json
from pathlib import Path
from typing import Dict, Tuple

from flask import Flask, jsonify, redirect, render_template, request, url_for

from controllers import owner, rental
from capital_market.models import simulate_market_investment
from real_estate.market_data import get_real_estate_market_placeholder
from real_estate.finance_data import get_real_estate_finance_data_placeholder
from tax_calculations import (
    est_2026,
    est_2026_married,
    tax_rates_married,
    tax_rates_single,
)


app = Flask(__name__, static_folder="static", template_folder="templates")

DATA_DIR = Path(__file__).parent / "data_files"


REAL_ESTATE_PLACEHOLDER_FILE = DATA_DIR / "realestateplaceholderdata.json"
real_estate_market = get_real_estate_market_placeholder(
    REAL_ESTATE_PLACEHOLDER_FILE.read_text(encoding="utf-8")
)

FINANCE_DATA_PLACEHOLDER_FILE = DATA_DIR / "realestatefinancedefaultdata.json"
real_estate_finance_data = get_real_estate_finance_data_placeholder(
    FINANCE_DATA_PLACEHOLDER_FILE.read_text(encoding="utf-8")
)




def load_data_files() -> Dict[str, object]:
    data_files: Dict[str, object] = {}

    for file_path in DATA_DIR.glob("*.json"):
        with file_path.open("r", encoding="utf-8") as file:
            data_files[file_path.name] = json.load(file)

    return data_files


@app.route("/properties")
def list_properties():
    return jsonify(owner.list_properties(request.args))


@app.route("/average-price")
def average_price():
    return jsonify(owner.average_price(request.args))


@app.route("/average-rent")
def average_rent():
    return jsonify(owner.average_rent(request.args))


@app.route("/api/tax", methods=["POST"])
def calculate_tax():
    payload = request.get_json(silent=True) or {}
    primary_zve = max(payload.get("zve", 0.0) or 0.0, 0.0)
    partner_zve = max(payload.get("partner_zve", 0.0) or 0.0, 0.0)
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
    return jsonify(rental.run_simulation(payload))


@app.route("/api/capitalmarket/simulation", methods=["POST"])
def capital_market_simulation():
    payload = request.get_json(silent=True) or {}
    product_index = int(payload.get("product_index", 0))
    available_wealth = float(payload.get("available_wealth") or 0.0)
    yearly_savings = float(payload.get("yearly_savings") or 0.0)
    years = max(int(payload.get("years") or 0), 1)

    data_files = load_data_files()
    capitalmarket_data = data_files.get("capitalmarketdata.json", [])

    if not isinstance(capitalmarket_data, list) or not capitalmarket_data:
        return jsonify({"error": "Keine Kapitalmarktdaten vorhanden."}), 400

    try:
        product = capitalmarket_data[product_index]
    except (IndexError, TypeError):
        product = capitalmarket_data[0]

    try:
        expected_return = float(product.get("return") or 0.0)
    except (TypeError, ValueError):
        expected_return = 0.0

    values, years_count = simulate_market_investment(
        product.get("name", ""),
        product.get("isin", ""),
        expected_return,
        available_wealth,
        yearly_savings,
        years,
    )

    timeseries = [{"year": index + 1, "value": value} for index, value in enumerate(values)]

    return jsonify(
        {
            "product": {
                "name": product.get("name", ""),
                "isin": product.get("isin", ""),
                "expected_return": expected_return,
            },
            "years": years_count,
            "timeseries": timeseries,
        }
    )


@app.route("/")
def home_page():
    data_files = load_data_files()
    capitalmarket_data = data_files.get("capitalmarketdata.json", [])

    return render_template("index.html", capitalmarket_data=capitalmarket_data)


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
