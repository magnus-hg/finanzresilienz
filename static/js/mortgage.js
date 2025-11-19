const ADDITIONAL_COST_RATE = 0.105;
const INTEREST_RATE = 0.04;
const REPAYMENT_RATE = 0.01;
const MARKET_RADIUS_KM = 8;
const MAX_LISTINGS = 5;
const MOCK_LISTING_BASE_URL = 'https://www.immobilienscout24.de/expose';

const mortgageForm = document.getElementById('mortgage-form');
const budgetInput = document.getElementById('mortgage-budget');
const assetsInput = document.getElementById('assets');
const postalCodeInput = document.getElementById('postal-code');
const totalCostOutput = document.getElementById('total-cost');
const loanAmountOutput = document.getElementById('loan-amount');
const calculatedRateOutput = document.getElementById('calculated-rate');
const affordabilityMessage = document.getElementById('affordability-message');
const resultCard = document.getElementById('result-card');
const marketInsightsCard = document.getElementById('market-insights');
const marketInsightsMessage = document.getElementById('market-insights-message');
const averagePriceValue = document.getElementById('average-price-value');
const listingsMessage = document.getElementById('listings-message');
const listingResults = document.getElementById('listing-results');

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
  if (typeof savedUserData.postalCode === 'string') {
    postalCodeInput.value = savedUserData.postalCode;
  }
}

function persistNumberInput(input, key) {
  if (!input) return;
  input.addEventListener('input', () => {
    const value = input.value === '' ? null : Number(input.value);
    userDataStore.save({ [key]: value });
  });
}

function persistTextInput(input, key) {
  if (!input) return;
  input.addEventListener('input', () => {
    const value = input.value.trim();
    userDataStore.save({ [key]: value || null });
  });
}

populateInitialValues();
persistNumberInput(budgetInput, 'monthlyRate');
persistNumberInput(assetsInput, 'assets');
persistTextInput(postalCodeInput, 'postalCode');

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

function setMarketInsightsMessage(message) {
  if (marketInsightsMessage) {
    marketInsightsMessage.textContent = message;
  }
}

function setAveragePriceDisplay(valueText) {
  if (averagePriceValue) {
    averagePriceValue.textContent = valueText;
  }
}

function renderListings(listings, fallbackMessage) {
  if (!listingResults) return;
  listingResults.innerHTML = '';

  if (!Array.isArray(listings) || listings.length === 0) {
    if (listingsMessage) {
      listingsMessage.textContent = fallbackMessage || 'Keine Immobilien gefunden.';
    }
    return;
  }

  if (listingsMessage) {
    listingsMessage.textContent = `Wir zeigen ${Math.min(
      listings.length,
      MAX_LISTINGS,
    )} zufällige Immobilienangebote in Ihrer Nähe.`;
  }

  listings.slice(0, MAX_LISTINGS).forEach((property) => {
    const item = document.createElement('li');
    item.className = 'listing-item';

    const price = document.createElement('p');
    price.className = 'listing-price';
    price.textContent = currencyFormatter.format(property.price_eur);
    item.append(price);

    const address = document.createElement('p');
    address.className = 'listing-address';
    address.textContent = property.address;
    item.append(address);

    const meta = document.createElement('div');
    meta.className = 'listing-meta';
    const sqm = `${Math.round(property.living_space_sqm)} m²`;
    const rooms = `${property.rooms} Zimmer`;
    const pricePerSqm = property.price_per_sqm
      ? `${currencyFormatter.format(property.price_per_sqm)} / m²`
      : 'Preis / m² n. v.';
    meta.innerHTML = `<span>${sqm}</span><span>${rooms}</span><span>${pricePerSqm}</span>`;
    item.append(meta);

    const actions = document.createElement('div');
    actions.className = 'listing-actions';
    const mockupLink = document.createElement('a');
    mockupLink.className = 'listing-link';
    mockupLink.href = `${MOCK_LISTING_BASE_URL}/${encodeURIComponent(property.identifier)}`;
    mockupLink.target = '_blank';
    mockupLink.rel = 'noreferrer noopener';
    mockupLink.textContent = 'Exposé ansehen';
    actions.append(mockupLink);
    item.append(actions);

    listingResults.append(item);
  });
}

function resetMarketInsights() {
  setAveragePriceDisplay('–');
  renderListings([], 'Es wurden noch keine Immobilien berechnet.');
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
    throw new Error('Für diese PLZ wurden keine Koordinaten gefunden.');
  }

  const { lat, lon, display_name: displayName } = results[0];
  return { lat: Number(lat), lon: Number(lon), displayName };
}

async function fetchListings(coords, radius, maxPrice) {
  if (!Number.isFinite(maxPrice) || maxPrice <= 0) {
    return { properties: [] };
  }
  const params = new URLSearchParams({
    latitude: coords.lat,
    longitude: coords.lon,
    radius,
    min_price: '0',
    max_price: String(Math.round(maxPrice)),
  });
  const response = await fetch(`/properties?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Beispielangebote konnten nicht geladen werden.');
  }
  return response.json();
}

async function fetchAveragePrice(coords, radius, maxPrice, samples = 5) {
  if (!Number.isFinite(maxPrice) || maxPrice <= 0) {
    return null;
  }

  const params = new URLSearchParams({
    latitude: coords.lat,
    longitude: coords.lon,
    radius,
    min_price: '0',
    max_price: String(Math.round(maxPrice)),
    samples: String(samples),
  });

  const response = await fetch(`/average-price?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Durchschnittspreise konnten nicht geladen werden.');
  }

  return response.json();
}

async function updateMarketInsights({ postalCode, maxPropertyPrice, fromStorage = false }) {
  if (!marketInsightsCard) return;

  if (!postalCode) {
    setMarketInsightsMessage('Bitte geben Sie Ihre PLZ an, um Marktdaten zu laden.');
    resetMarketInsights();
    return;
  }

  if (!Number.isFinite(maxPropertyPrice) || maxPropertyPrice <= 0) {
    setMarketInsightsMessage('Berechnen Sie zuerst den maximalen Kaufpreis, um Marktdaten zu erhalten.');
    resetMarketInsights();
    return;
  }

  setMarketInsightsMessage(
    fromStorage
      ? 'Marktdaten werden anhand Ihrer zuletzt eingegebenen Werte geladen …'
      : 'Wir ermitteln Durchschnittspreise und passende Immobilien …',
  );
  setAveragePriceDisplay('…');
  renderListings([], 'Beispielangebote werden geladen …');

  try {
    const coords = await fetchCoordinates(`${postalCode}, Deutschland`);
    const [listingsData, averageData] = await Promise.all([
      fetchListings(coords, MARKET_RADIUS_KM, maxPropertyPrice),
      fetchAveragePrice(coords, MARKET_RADIUS_KM, maxPropertyPrice),
    ]);

    const listings = Array.isArray(listingsData.properties) ? listingsData.properties : [];

    if (
      averageData &&
      Number.isFinite(averageData.average_price_per_sqm) &&
      averageData.average_price_per_sqm > 0
    ) {
      setAveragePriceDisplay(
        `${currencyFormatter.format(Math.round(averageData.average_price_per_sqm))} / m²`,
      );
      const observationCount =
        typeof averageData.observations === 'number' && averageData.observations > 0
          ? averageData.observations
          : typeof averageData.samples === 'number'
            ? averageData.samples
            : 5;
      setMarketInsightsMessage(
        `Ø Kaufpreis pro m² aus ${observationCount} Angebotswerten (${averageData.samples} Stichproben) im ${MARKET_RADIUS_KM}-km-Radius um ${postalCode}.`,
      );
    } else {
      setAveragePriceDisplay('–');
      setMarketInsightsMessage('Keine Durchschnittspreise verfügbar.');
    }

    if (listings.length === 0) {
      renderListings(
        [],
        'Keine passenden Beispielangebote gefunden. Bitte passen Sie Ihr Budget oder die PLZ an.',
      );
    } else {
      renderListings(listings, '');
    }
  } catch (error) {
    console.error(error);
    setMarketInsightsMessage(error.message || 'Marktdaten konnten nicht geladen werden.');
    setAveragePriceDisplay('–');
    renderListings([], 'Marktdaten konnten nicht geladen werden.');
  }
}

function handleMortgageSubmit(event) {
  event.preventDefault();

  const budget = Number(budgetInput.value);
  const assets = Number(assetsInput.value);
  const postalCode = postalCodeInput.value.trim();

  const hasValidNumbers =
    Number.isFinite(budget) &&
    Number.isFinite(assets) &&
    budget >= 0 &&
    assets >= 0 &&
    postalCode.length > 0;

  if (!hasValidNumbers) {
    alert('Bitte geben Sie gültige Werte für Rate, Vermögen und PLZ ein.');
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
    postalCode,
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

  updateMarketInsights({ postalCode, maxPropertyPrice, fromStorage: false });
}

mortgageForm.addEventListener('submit', handleMortgageSubmit);

function initMarketInsightsFromStorage() {
  if (!marketInsightsCard) return;
  const postalCode = typeof savedUserData.postalCode === 'string' ? savedUserData.postalCode : '';
  const maxPrice = typeof savedUserData.maxPropertyPrice === 'number' ? savedUserData.maxPropertyPrice : null;
  if (postalCode && typeof maxPrice === 'number' && maxPrice > 0) {
    updateMarketInsights({ postalCode, maxPropertyPrice: maxPrice, fromStorage: true });
  }
}

initMarketInsightsFromStorage();
