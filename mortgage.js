const PROPERTY_DEFAULT_PRICE = 500000;
const ADDITIONAL_COST_RATE = 0.105;
const INTEREST_RATE = 0.04;
const REPAYMENT_RATE = 0.01;

const mortgageForm = document.getElementById('mortgage-form');
const budgetInput = document.getElementById('mortgage-budget');
const assetsInput = document.getElementById('assets');
const propertyPriceInput = document.getElementById('property-price');
const totalCostOutput = document.getElementById('total-cost');
const loanAmountOutput = document.getElementById('loan-amount');
const calculatedRateOutput = document.getElementById('calculated-rate');
const affordabilityMessage = document.getElementById('affordability-message');
const resultCard = document.getElementById('result-card');

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const savedUserData = window.userDataStore ? userDataStore.load() : {};

function populateInitialValues() {
  if (typeof savedUserData.monthlyRate === 'number') {
    budgetInput.value = savedUserData.monthlyRate;
  }
  if (typeof savedUserData.assets === 'number') {
    assetsInput.value = savedUserData.assets;
  }
  if (typeof savedUserData.propertyPrice === 'number' && savedUserData.propertyPrice > 0) {
    propertyPriceInput.value = savedUserData.propertyPrice;
  }
}

function getPropertyPrice() {
  const value = Number(propertyPriceInput.value);
  return Number.isFinite(value) && value > 0 ? value : PROPERTY_DEFAULT_PRICE;
}

function getTotalCost(price) {
  return price * (1 + ADDITIONAL_COST_RATE);
}

function updateTotalCostDisplay() {
  const totalCost = getTotalCost(getPropertyPrice());
  totalCostOutput.textContent = currencyFormatter.format(totalCost);
  return totalCost;
}

function persistNumberInput(input, key) {
  if (!input) return;
  input.addEventListener('input', () => {
    const value = input.value === '' ? null : Number(input.value);
    userDataStore.save({ [key]: value });
  });
}

populateInitialValues();
updateTotalCostDisplay();
persistNumberInput(budgetInput, 'monthlyRate');
persistNumberInput(assetsInput, 'assets');
persistNumberInput(propertyPriceInput, 'propertyPrice');

propertyPriceInput.addEventListener('input', () => {
  updateTotalCostDisplay();
});

function handleMortgageSubmit(event) {
  event.preventDefault();

  const budget = Number(budgetInput.value);
  const assets = Number(assetsInput.value);
  const propertyPrice = getPropertyPrice();

  const hasValidNumbers =
    Number.isFinite(budget) &&
    Number.isFinite(assets) &&
    budget >= 0 &&
    assets >= 0;

  if (!hasValidNumbers) {
    alert('Bitte geben Sie gültige Werte für Rate, Vermögen und Kaufpreis ein.');
    return;
  }

  const totalCost = getTotalCost(propertyPrice);
  const loanAmount = Math.max(totalCost - assets, 0);
  const yearlyRate = INTEREST_RATE + REPAYMENT_RATE;
  const monthlyRate = loanAmount * yearlyRate / 12;

  loanAmountOutput.textContent = currencyFormatter.format(loanAmount);
  calculatedRateOutput.textContent = currencyFormatter.format(monthlyRate);

  userDataStore.save({
    monthlyRate: budget,
    assets,
    propertyPrice,
  });

  resultCard.classList.remove('result-positive', 'result-negative');

  if (loanAmount === 0) {
    affordabilityMessage.textContent =
      'Ihr Vermögen deckt die Gesamtkosten vollständig. Sie benötigen kein Darlehen.';
    resultCard.classList.add('result-positive');
    return;
  }

  if (monthlyRate <= budget) {
    affordabilityMessage.textContent =
      `Ja, die Immobilie ist finanzierbar. Die erforderliche Monatsrate von ${currencyFormatter.format(
        monthlyRate
      )} liegt innerhalb Ihrer verfügbaren Rate von ${currencyFormatter.format(budget)}.`;
    resultCard.classList.add('result-positive');
  } else {
    affordabilityMessage.textContent =
      `Nein, die Immobilie übersteigt Ihr Budget. Sie benötigen eine Monatsrate von ${currencyFormatter.format(
        monthlyRate
      )}, was über Ihrer verfügbaren Rate von ${currencyFormatter.format(budget)} liegt.`;
    resultCard.classList.add('result-negative');
  }
}

mortgageForm.addEventListener('submit', handleMortgageSubmit);
