const form = document.getElementById('buy-to-let-form');
const warmRentYear1 = document.getElementById('warm-rent-year1');
const cashflowYear1 = document.getElementById('cashflow-year1');
const cashflowAfterTax = document.getElementById('cashflow-after-tax');
const equityFinal = document.getElementById('equity-final');
const loanRestFinal = document.getElementById('loan-rest-final');
const propertyValueFinal = document.getElementById('property-value-final');
const resultMessage = document.getElementById('result-message');
const resultNote = document.getElementById('result-note');
const tableBody = document.getElementById('projection-body');
const totalInvestment = document.getElementById('total-investment');
const totalAfterTax = document.getElementById('total-after-tax');

const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const euroPrecise = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

function getNumber(id, fallback = 0) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  const value = parseFloat(el.value);
  return Number.isFinite(value) ? value : fallback;
}

function buildPayload() {
  const purchasePrice = getNumber('purchase-price', 0);
  const transactionCostsPercent = getNumber('transaction-costs', 10.5) / 100;
  const valueGrowthRate = getNumber('value-growth', 2) / 100;
  const depreciationBasis = getNumber('depreciation-basis', purchasePrice * 0.8);
  const depreciationRate = getNumber('depreciation-rate', 2) / 100;

  const loanPrincipal = getNumber('loan-principal', purchasePrice * 0.8);
  const loanInterestRate = getNumber('loan-interest', 3.5) / 100;
  const loanYears = Math.max(Math.round(getNumber('loan-years', 25)), 1);
  const annuity = getNumber('loan-annuity', 0);

  const netColdRent = getNumber('net-cold-rent', 0);
  const operatingCosts = getNumber('operating-costs', 0);
  const mgmtCosts = getNumber('mgmt-costs', 0);
  const rentIncrease = getNumber('rent-increase', 0) / 100;
  const rentInterval = Math.max(Math.round(getNumber('rent-interval', 3)), 1);

  const taxRate = getNumber('tax-rate', 0) / 100;
  const startYear = Math.max(Math.round(getNumber('start-year', new Date().getFullYear())), 2024);
  const nYears = Math.max(Math.round(getNumber('n-years', 20)), 1);

  return {
    purchase_price: purchasePrice,
    transaction_cost_factor: transactionCostsPercent,
    value_growth_rate: valueGrowthRate,
    depreciation_basis: depreciationBasis,
    depreciation_rate: depreciationRate,
    loan_principal: loanPrincipal,
    loan_interest_rate: loanInterestRate,
    loan_years: loanYears,
    loan_annuity: annuity > 0 ? annuity : null,
    net_cold_rent_month: netColdRent,
    operating_costs_month: operatingCosts,
    mgmt_costs_annual: mgmtCosts,
    rent_increase_rate: rentIncrease,
    rent_increase_interval_years: rentInterval,
    tax_rate: taxRate,
    start_year: startYear,
    n_years: nYears,
  };
}

function setText(element, value) {
  if (!element) return;
  element.textContent = value;
}

function renderResultCard(summary) {
  if (!resultNote || !resultMessage) return;
  if (typeof summary.cashflow_year1 !== 'number') {
    resultNote.classList.remove('result-positive', 'result-negative');
    resultMessage.textContent = 'Bitte gültige Werte eingeben und erneut simulieren.';
    return;
  }

  const positive = summary.cashflow_after_tax_year1 >= 0;
  resultNote.classList.remove('result-positive', 'result-negative');
  resultNote.classList.add(positive ? 'result-positive' : 'result-negative');
  const tone = positive ? 'positiven' : 'negativen';
  resultMessage.textContent = `Im Startjahr ergibt sich ein ${tone} Cashflow nach Steuern von ${euro.format(
    Math.round(summary.cashflow_after_tax_year1)
  )}. Die Summe aller Cashflows nach Steuern über die Laufzeit beträgt ${euroPrecise.format(
    summary.total_cashflow_after_tax
  )}.`;
}

function renderSummary(summary, totalInvestmentValue) {
  if (!summary) return;

  setText(warmRentYear1, euro.format(Math.round(summary.warm_rent_year1)));
  setText(cashflowYear1, euro.format(Math.round(summary.cashflow_year1)));
  setText(cashflowAfterTax, euro.format(Math.round(summary.cashflow_after_tax_year1)));
  setText(equityFinal, euro.format(Math.round(summary.equity_final)));
  setText(loanRestFinal, euro.format(Math.round(summary.loan_rest_final)));
  setText(propertyValueFinal, euro.format(Math.round(summary.property_value_final)));

  if (totalInvestment) {
    setText(totalInvestment, `Gesamtinvestition ≈ ${euro.format(Math.round(totalInvestmentValue))}`);
  }
  if (totalAfterTax) {
    setText(
      totalAfterTax,
      `Cashflows nach Steuer gesamt ${euroPrecise.format(summary.total_cashflow_after_tax)}`
    );
  }

  renderResultCard(summary);
}

function renderTable(records) {
  if (!tableBody) return;
  tableBody.innerHTML = '';

  if (!Array.isArray(records) || records.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.className = 'muted';
    cell.textContent = 'Keine Daten verfügbar.';
    row.append(cell);
    tableBody.append(row);
    return;
  }

  records.slice(0, 25).forEach((rowData) => {
    const row = document.createElement('tr');

    const cells = [
      rowData.year,
      euro.format(Math.round(rowData.warm_rent_year)),
      euro.format(Math.round(rowData.interest_paid)),
      euro.format(Math.round(rowData.principal_paid)),
      euro.format(Math.round(rowData.taxes)),
      euro.format(Math.round(rowData.cashflow_after_tax)),
      euro.format(Math.round(rowData.equity_end)),
    ];

    cells.forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });

    tableBody.append(row);
  });
}

async function runSimulation(event) {
  event.preventDefault();
  const payload = buildPayload();

  try {
    const response = await fetch('/api/vermietung/simulation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Serverantwort fehlgeschlagen.');
    }

    const data = await response.json();
    renderSummary(data.summary, data.total_investment_cost);
    renderTable(data.records);
  } catch (error) {
    console.error(error);
    setText(resultMessage, 'Die Simulation ist fehlgeschlagen. Bitte prüfen Sie Ihre Eingaben.');
    if (resultNote) {
      resultNote.classList.remove('result-positive');
      resultNote.classList.add('result-negative');
    }
  }
}

if (form) {
  form.addEventListener('submit', runSimulation);
}
