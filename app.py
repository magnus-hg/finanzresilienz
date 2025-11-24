from typing import Tuple

from flask import Flask, jsonify, redirect, render_template, request, url_for

from controllers import owner, rental
from tax_calculations import (
    est_2026,
    est_2026_married,
    tax_rates_married,
    tax_rates_single,
)


app = Flask(__name__, static_folder="static", template_folder="templates")


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
