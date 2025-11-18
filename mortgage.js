const PROPERTY_PRICE = 500000;
const ADDITIONAL_COST_RATE = 0.105;
const INTEREST_RATE = 0.04;
const REPAYMENT_RATE = 0.01;

const mortgageForm = document.getElementById('mortgage-form');
const budgetInput = document.getElementById('mortgage-budget');
const assetsInput = document.getElementById('assets');
const totalCostOutput = document.getElementById('total-cost');
const loanAmountOutput = document.getElementById('loan-amount');
const calculatedRateOutput = document.getElementById('calculated-rate');
const affordabilityMessage = document.getElementById('affordability-message');

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const TOTAL_COST = PROPERTY_PRICE * (1 + ADDITIONAL_COST_RATE);

totalCostOutput.textContent = currencyFormatter.format(TOTAL_COST);

function handleMortgageSubmit(event) {
  event.preventDefault();

  const budget = Number(budgetInput.value);
  const assets = Number(assetsInput.value);

  if (!Number.isFinite(budget) || !Number.isFinite(assets) || budget < 0 || assets < 0) {
    alert('Bitte geben Sie gültige Werte für Rate und Vermögen ein.');
    return;
  }

  const loanAmount = Math.max(TOTAL_COST - assets, 0);
  const yearlyRate = INTEREST_RATE + REPAYMENT_RATE;
  const monthlyRate = loanAmount * yearlyRate / 12;

  loanAmountOutput.textContent = currencyFormatter.format(loanAmount);
  calculatedRateOutput.textContent = currencyFormatter.format(monthlyRate);

  if (loanAmount === 0) {
    affordabilityMessage.textContent =
      'Ihr Vermögen deckt die Gesamtkosten vollständig. Sie benötigen kein Darlehen.';
    return;
  }

  if (monthlyRate <= budget) {
    affordabilityMessage.textContent =
      `Ja, die Immobilie ist finanzierbar. Die erforderliche Monatsrate von ${currencyFormatter.format(
        monthlyRate
      )} liegt innerhalb Ihrer verfügbaren Rate von ${currencyFormatter.format(budget)}.`;
  } else {
    affordabilityMessage.textContent =
      `Nein, die Immobilie übersteigt Ihr Budget. Sie benötigen eine Monatsrate von ${currencyFormatter.format(
        monthlyRate
      )}, was über Ihrer verfügbaren Rate von ${currencyFormatter.format(budget)} liegt.`;
  }
}

mortgageForm.addEventListener('submit', handleMortgageSubmit);
