from dataclasses import dataclass
from typing import Optional


@dataclass
class PropertyParams:
    purchase_price: float              # Kaufpreis der Wohnung
    transaction_cost_factor: float     # Makler + Notar + Grundbuch + GrESt (z.B. 0.1057)
    value_growth_rate: float           # jährliche Wertsteigerung (z.B. 0.02)
    depreciation_basis: float          # Basis für AfA (z.B. Kaufpreis ohne Grundstück)
    depreciation_rate: float           # z.B. 0.02 für 2 % p.a.


@dataclass
class LoanParams:
    principal: float                   # Darlehensbetrag
    interest_rate: float               # nominaler Jahreszins, z.B. 0.035
    years: int                         # Zinsbindungs-/Tilgungsdauer (für Annuität)
    annuity: Optional[float] = None    # jährlicher Kapitaldienst; wenn None -> berechnet


@dataclass
class RentParams:
    net_cold_rent_month: float         # Nettokaltmiete pro Monat Startjahr
    operating_costs_month: float       # umlagefähige Kosten pro Monat
    mgmt_costs_annual: float           # nicht umlagefähige Bewirtschaftungskosten p.a.
    rent_increase_rate: float          # Mietsteigerung (z.B. 0.065)
    rent_increase_interval_years: int  # Intervall in Jahren (z.B. 3)


@dataclass
class SimulationParams:
    start_year: int
    n_years: int
    property_params: PropertyParams
    loan_params: LoanParams
    rent_params: RentParams
    tax_rate: float = 0.0              # Körperschaft / Einkommen ∼ einfach pauschal; 0 wenn ignorieren



def calc_annuity(principal: float, rate: float, years: int) -> float:
    """
    Klassische Annuität: A = P * i / (1 - (1 + i)^-n)
    principal: Darlehensbetrag
    rate: Jahreszinssatz (z.B. 0.035)
    years: Laufzeit in Jahren
    """
    if rate == 0:
        return principal / years
    factor = (rate) / (1 - (1 + rate) ** (-years))
    return principal * factor


def amortization_step(restschuld: float, rate: float, annuity: float) -> tuple[float, float, float]:
    """
    Eine Jahresperiode:
    - Zinsen = Restschuld * rate
    - Tilgung = Annuität - Zinsen
    - Neue Restschuld = Restschuld - Tilgung
    """
    interest = restschuld * rate
    repayment = annuity - interest
    new_rest = restschuld - repayment
    return new_rest, interest, repayment



def rent_for_year(params: RentParams, year_index: int) -> tuple[float, float, float]:
    """
    year_index: 0 = Startjahr (entspricht z.B. 2025 in deinem Verlauf)
    Gibt zurück:
    - nettokalt_monat
    - warm_monat
    - warm_jahr
    """
    # Mietsteigerung stufenweise alle X Jahre
    n_increases = year_index // params.rent_increase_interval_years
    factor = (1 + params.rent_increase_rate) ** n_increases

    net_cold_month = params.net_cold_rent_month * factor
    warm_month = net_cold_month + params.operating_costs_month
    warm_year = warm_month * 12
    return net_cold_month, warm_month, warm_year



def simulate(params: SimulationParams) -> list[dict]:
    pp = params.property_params
    lp = params.loan_params
    rp = params.rent_params

    # Annuität aus Excel übernehmen oder berechnen
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

    # Initialwerte: Wert & Restschuld Jahresanfang Jahr 0
    value_start = pp.purchase_price
    rest = lp.principal
    cum_depr = 0.0

    for i in range(params.n_years):
        year = params.start_year + i

        # Wertentwicklung Immobilie
        # -> analog "Wert der Immobilie (Jahresanfang)" / "Wertentwicklung im Jahr"
        growth = value_start * pp.value_growth_rate
        value_end = value_start + growth

        # Vermögen am Jahresanfang (vereinfacht: Wert - Restschuld)
        equity0 = value_start - rest

        # Darlehen: Annuitätsjahr
        new_rest, interest, repayment = amortization_step(rest, lp.interest_rate, annuity)

        # Miete / Kosten
        net_cold_month, warm_month, warm_year = rent_for_year(rp, i)
        mgmt_costs = rp.mgmt_costs_annual

        # Cashflow (operativ, vor Steuern):
        # Warmmiete - Bewirtschaftungskosten - Zinsen - Tilgung
        cf_op = warm_year - mgmt_costs - interest - repayment

        # Abschreibung (AfA)
        depr_year = pp.depreciation_basis * pp.depreciation_rate
        cum_depr += depr_year

        # Steuerliche Vereinfachung:
        # steuerpflichtiges Ergebnis ~ Warmmiete - mgmt_costs - Zinsen - AfA
        taxable = warm_year - mgmt_costs - interest - depr_year
        tax = max(taxable, 0) * params.tax_rate  # nur Positivbetrag besteuern

        cf_net = cf_op - tax

        # Equity Ende (vereinfacht: Wert Jahresultimo - Restschuld Jahresultimo)
        equity1 = value_end - new_rest

        # Daten sammeln
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

        # Vorbereitung nächstes Jahr
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
