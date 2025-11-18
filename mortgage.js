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
}

function persistNumberInput(input, key) {
  if (!input) return;
  input.addEventListener('input', () => {
    const value = input.value === '' ? null : Number(input.value);
    userDataStore.save({ [key]: value });
  });
}

populateInitialValues();
persistNumberInput(budgetInput, 'monthlyRate');
persistNumberInput(assetsInput, 'assets');

function calculateAffordableValues(budget, assets) {
  const yearlyRate = INTEREST_RATE + REPAYMENT_RATE;
  const possibleLoan = (budget * 12) / yearlyRate;
  const totalAffordable = possibleLoan + assets;
  const maxPropertyPrice = totalAffordable / (1 + ADDITIONAL_COST_RATE);

  return {
    possibleLoan,
    totalAffordable,
    maxPropertyPrice,
  };
}

function handleMortgageSubmit(event) {
  event.preventDefault();

  const budget = Number(budgetInput.value);
  const assets = Number(assetsInput.value);

  const hasValidNumbers =
    Number.isFinite(budget) &&
    Number.isFinite(assets) &&
    budget >= 0 &&
    assets >= 0;

  if (!hasValidNumbers) {
    alert('Bitte geben Sie gültige Werte für Rate und Vermögen ein.');
    return;
  }

  const { possibleLoan, totalAffordable, maxPropertyPrice } = calculateAffordableValues(
    budget,
    assets,
  );

  totalCostOutput.textContent = currencyFormatter.format(maxPropertyPrice);
  loanAmountOutput.textContent = currencyFormatter.format(possibleLoan);
  calculatedRateOutput.textContent = currencyFormatter.format(totalAffordable);

  userDataStore.save({
    monthlyRate: budget,
    assets,
    maxPropertyPrice,
  });

  resultCard.classList.remove('result-positive', 'result-negative');
  resultCard.classList.add('result-positive');

  affordabilityMessage.textContent =
    `Mit einer monatlichen Rate von ${currencyFormatter.format(budget)} und einem Vermögen von ${currencyFormatter.format(
      assets,
    )} können Sie eine Immobilie im Wert von bis zu ${currencyFormatter.format(
      maxPropertyPrice,
    )} (zzgl. Nebenkosten) finanzieren.`;
}

mortgageForm.addEventListener('submit', handleMortgageSubmit);
