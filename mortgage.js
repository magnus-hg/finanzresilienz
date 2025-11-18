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
const housingForm = document.getElementById('housing-search-form');
const housingPriceInput = document.getElementById('housing-max-price');
const housingLocationInput = document.getElementById('housing-location');
const housingRadiusInput = document.getElementById('housing-radius');
const housingMessage = document.getElementById('housing-search-message');
const housingSubmitButton = document.getElementById('housing-search-submit');
const housingPriceHint = document.getElementById('housing-price-hint');

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const savedUserData = window.userDataStore ? userDataStore.load() : {};
let housingMaxPrice = null;

function populateInitialValues() {
  if (typeof savedUserData.monthlyRate === 'number') {
    budgetInput.value = savedUserData.monthlyRate;
  }
  if (typeof savedUserData.assets === 'number') {
    assetsInput.value = savedUserData.assets;
  }
}

function initHousingSearchFromStorage() {
  if (!housingForm) return;

  disableHousingSearch();

  if (typeof savedUserData.maxPropertyPrice === 'number' && savedUserData.maxPropertyPrice > 0) {
    enableHousingSearch(savedUserData.maxPropertyPrice, {
      fromStoredCalculation: true,
    });
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
initHousingSearchFromStorage();

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

  enableHousingSearch(maxPropertyPrice, { fromStoredCalculation: false });
}

mortgageForm.addEventListener('submit', handleMortgageSubmit);

function disableHousingSearch() {
  if (!housingForm) return;
  housingMaxPrice = null;
  if (housingPriceInput) {
    housingPriceInput.value = '';
  }
  if (housingLocationInput) {
    housingLocationInput.value = '';
    housingLocationInput.disabled = true;
  }
  if (housingRadiusInput) {
    housingRadiusInput.value = '5';
    housingRadiusInput.disabled = true;
  }
  if (housingSubmitButton) {
    housingSubmitButton.disabled = true;
  }
  if (housingMessage) {
    housingMessage.textContent =
      'Berechnen Sie zunächst den maximalen Kaufpreis, um die Wohnungssuche zu starten.';
  }
}

function enableHousingSearch(price, { fromStoredCalculation } = { fromStoredCalculation: false }) {
  if (!housingForm) return;
  housingMaxPrice = price;
  if (housingPriceInput) {
    housingPriceInput.value = currencyFormatter.format(price);
  }
  if (housingLocationInput) {
    housingLocationInput.disabled = false;
  }
  if (housingRadiusInput) {
    if (!housingRadiusInput.value) {
      housingRadiusInput.value = '5';
    }
    housingRadiusInput.disabled = false;
  }
  if (housingSubmitButton) {
    housingSubmitButton.disabled = false;
  }
  if (housingMessage) {
    housingMessage.textContent = fromStoredCalculation
      ? `Maximaler Kaufpreis aus Ihrer letzten Berechnung: ${currencyFormatter.format(
          price,
        )}. Geben Sie nun einen Ort an, um passende Angebote zu sehen.`
      : `Maximaler Kaufpreis berechnet: ${currencyFormatter.format(
          price,
        )}. Geben Sie nun einen Ort an, um passende Angebote zu sehen.`;
  }
  if (housingPriceHint) {
    housingPriceHint.textContent = 'Der Wert basiert auf Ihrer aktuellen Finanzierungsberechnung.';
  }
}

function validateHousingInputs(location, radius) {
  if (!housingMaxPrice) {
    alert('Bitte berechnen Sie zuerst den maximalen Kaufpreis.');
    return false;
  }
  if (!location) {
    alert('Bitte geben Sie einen Ort oder eine Adresse ein.');
    return false;
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    alert('Bitte geben Sie einen gültigen Suchradius in Kilometern an.');
    return false;
  }
  return true;
}

async function fetchCoordinates(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=1&q=${encodeURIComponent(
    query,
  )}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'finanzresilienz-app/1.0 (+https://example.com)',
    },
  });

  if (!response.ok) {
    throw new Error('Koordinaten konnten nicht geladen werden.');
  }

  const results = await response.json();
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('Für diesen Ort wurden keine Koordinaten gefunden.');
  }

  const { lat, lon, display_name: displayName } = results[0];
  return { lat: Number(lat), lon: Number(lon), displayName };
}

function openImmobilienScout(price, coords, radius) {
  const searchParams = new URLSearchParams();
  searchParams.set('price', `-${price.toFixed(1)}`);
  const formattedLat = coords.lat.toFixed(5);
  const formattedLon = coords.lon.toFixed(5);
  searchParams.set('geocoordinates', `${formattedLat};${formattedLon};${radius.toFixed(1)}`);

  const searchUrl = `https://www.immobilienscout24.de/Suche/radius/wohnung-kaufen?${searchParams.toString()}`;
  window.open(searchUrl, '_blank');
}

async function handleHousingSearchSubmit(event) {
  event.preventDefault();
  if (!housingForm) return;

  const location = housingLocationInput ? housingLocationInput.value.trim() : '';
  const radius = housingRadiusInput ? Number(housingRadiusInput.value) || 5 : 5;

  if (!validateHousingInputs(location, radius)) {
    return;
  }

  if (housingMessage) {
    housingMessage.textContent = 'Koordinaten werden über Nominatim geladen …';
  }

  try {
    const coords = await fetchCoordinates(location);
    if (housingMessage) {
      housingMessage.textContent =
        `Koordinaten für ${coords.displayName || location} gefunden. Immobilienscout24 wird geöffnet …`;
    }
    openImmobilienScout(housingMaxPrice, coords, radius);
  } catch (error) {
    console.error(error);
    if (housingMessage) {
      housingMessage.textContent = error.message;
    }
  }
}

if (housingForm) {
  housingForm.addEventListener('submit', handleHousingSearchSubmit);
}
