"""Simulation logic for buy-to-let scenarios."""
from typing import List

from .finance import amortization_step, calc_annuity
from .models import LoanParams, PropertyParams, RentParams, SimulationParams
from .rent import rent_for_year


def simulate(params: SimulationParams) -> List[dict]:
    """Run the rental property simulation and return yearly records."""

    pp: PropertyParams = params.property_params
    lp: LoanParams = params.loan_params
    rp: RentParams = params.rent_params

    if lp.annuity is None:
        annuity = calc_annuity(lp.principal, lp.interest_rate, lp.years)
    else:
        annuity = lp.annuity

    years = []
    prop_value_start = []
    prop_value_end = []
    equity_start = []
    equity_end = []

    loan_rest_start = []
    loan_rest_end = []
    interest_paid = []
    principal_paid = []
    annuity_annual = []

    net_cold_month_list = []
    warm_month_list = []
    warm_year_list = []
    mgmt_costs_annual_list = []

    depreciation_annual = []
    depreciation_cum = []
    taxable_income = []
    taxes = []
    cf_operating = []
    cf_after_tax = []

    value_start = pp.purchase_price
    rest = lp.principal
    cum_depr = 0.0

    for i in range(params.n_years):
        year = params.start_year + i

        growth = value_start * pp.value_growth_rate
        value_end = value_start + growth

        equity0 = value_start - rest

        new_rest, interest, repayment = amortization_step(rest, lp.interest_rate, annuity)

        net_cold_month, warm_month, warm_year = rent_for_year(rp, i)
        mgmt_costs = rp.mgmt_costs_annual

        cf_op = warm_year - mgmt_costs - interest - repayment

        depr_year = pp.depreciation_basis * pp.depreciation_rate
        cum_depr += depr_year

        taxable = warm_year - mgmt_costs - interest - depr_year
        tax = max(taxable, 0) * params.tax_rate

        cf_net = cf_op - tax

        equity1 = value_end - new_rest

        years.append(year)

        prop_value_start.append(value_start)
        prop_value_end.append(value_end)
        equity_start.append(equity0)
        equity_end.append(equity1)

        loan_rest_start.append(rest)
        loan_rest_end.append(new_rest)
        interest_paid.append(interest)
        principal_paid.append(repayment)
        annuity_annual.append(annuity)

        net_cold_month_list.append(net_cold_month)
        warm_month_list.append(warm_month)
        warm_year_list.append(warm_year)
        mgmt_costs_annual_list.append(mgmt_costs)

        depreciation_annual.append(depr_year)
        depreciation_cum.append(cum_depr)
        taxable_income.append(taxable)
        taxes.append(tax)
        cf_operating.append(cf_op)
        cf_after_tax.append(cf_net)

        value_start = value_end
        rest = new_rest

    records = []
    for idx in range(len(years)):
        records.append(
            {
                "year": years[idx],
                "property_value_start": prop_value_start[idx],
                "property_value_end": prop_value_end[idx],
                "equity_start": equity_start[idx],
                "equity_end": equity_end[idx],
                "loan_rest_start": loan_rest_start[idx],
                "loan_rest_end": loan_rest_end[idx],
                "annuity_annual": annuity_annual[idx],
                "interest_paid": interest_paid[idx],
                "principal_paid": principal_paid[idx],
                "net_cold_rent_month": net_cold_month_list[idx],
                "warm_rent_month": warm_month_list[idx],
                "warm_rent_year": warm_year_list[idx],
                "mgmt_costs_annual": mgmt_costs_annual_list[idx],
                "depreciation_annual": depreciation_annual[idx],
                "depreciation_cum": depreciation_cum[idx],
                "taxable_income": taxable_income[idx],
                "taxes": taxes[idx],
                "cashflow_operating": cf_operating[idx],
                "cashflow_after_tax": cf_after_tax[idx],
            }
        )

    return records
