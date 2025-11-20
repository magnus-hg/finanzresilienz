const form = document.getElementById('rental-finder-form');
const assetsInput = document.getElementById('rental-assets');
const postalCodeInput = document.getElementById('rental-postal-code');
const interestInput = document.getElementById('rental-interest');
const repaymentInput = document.getElementById('rental-repayment');
const additionalCostInput = document.getElementById('rental-additional-costs');

const maxPriceOutput = document.getElementById('rental-max-price');
const averageRentOutput = document.getElementById('average-rent');
const listingCount = document.getElementById('listing-count');
const listingSummary = document.getElementById('listing-summary');
const rentalMessage = document.getElementById('rental-message');
const listingsMessage = document.getElementById('rental-listings-message');
const listingResults = document.getElementById('rental-listing-results');

const DEFAULT_INTEREST_PERCENT = 4;
const DEFAULT_REPAYMENT_PERCENT = 2;
const DEFAULT_ADDITIONAL_COST_PERCENT = 10.5;
const ASSUMED_EQUITY_SHARE = 0.2; // 20 % Eigenkapital neben Nebenkosten
const MARKET_RADIUS_KM = 8;
const MAX_LISTINGS = 12;
const MOCK_LISTING_BASE_URL = 'https://www.immobilienscout24.de/expose';

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function deriveTotalPrice(property, fallbackAdditionalCostRate) {
  const totalPrice = Number(property.total_price_eur);
  const additionalCosts = Number(property.additional_costs_eur);
  const additionalCostRate = Number.isFinite(property.additional_cost_rate)
    ? property.additional_cost_rate
    : fallbackAdditionalCostRate;

  if (Number.isFinite(totalPrice)) {
    return totalPrice;
  }

  if (Number.isFinite(additionalCosts) && Number.isFinite(property.price_eur)) {
    return property.price_eur + additionalCosts;
  }

  if (Number.isFinite(property.price_eur)) {
    const rate = Number.isFinite(additionalCostRate)
      ? additionalCostRate
      : DEFAULT_ADDITIONAL_COST_PERCENT / 100;
    return property.price_eur * (1 + rate);
  }

  return NaN;
}

function estimateMaxPriceFromAssets(assets, additionalCostRate) {
  const usableAssets = Math.max(Number(assets) || 0, 0);
  const costRate = Number.isFinite(additionalCostRate)
    ? Math.max(additionalCostRate, 0)
    : DEFAULT_ADDITIONAL_COST_PERCENT / 100;
  const equityFactor = costRate + ASSUMED_EQUITY_SHARE;
  if (equityFactor <= 0) return 0;
  return usableAssets / equityFactor;
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

  const { lat, lon } = results[0];
  return { lat: Number(lat), lon: Number(lon) };
}

async function fetchAverageRent(coords, radius) {
  const params = new URLSearchParams({
    latitude: coords.lat,
    longitude: coords.lon,
    radius,
  });
  const response = await fetch(`/average-rent?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Durchschnittliche Mieten konnten nicht geladen werden.');
  }
  return response.json();
}

async function fetchListings(
  coords,
  radius,
  maxPrice,
  interestRate,
  repaymentRate,
  additionalCostRate,
  availableAssets,
) {
  const params = new URLSearchParams({
    latitude: coords.lat,
    longitude: coords.lon,
    radius,
    min_price: '0',
    max_price: String(Math.max(Math.round(maxPrice), 0)),
    interest_rate: String(interestRate),
    tilgung_rate: String(repaymentRate),
    additional_cost_rate: String(Math.max(additionalCostRate, 0)),
    available_assets: String(Math.max(availableAssets, 0)),
  });

  const response = await fetch(`/properties?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Immobilienangebote konnten nicht geladen werden.');
  }
  return response.json();
}

function renderTopline(maxPrice, additionalCostRate, listingAmount) {
  if (maxPriceOutput) {
    const maxTotalCost = maxPrice * (1 + additionalCostRate);
    maxPriceOutput.textContent = `${currencyFormatter.format(Math.round(maxPrice))} (≈ ${currencyFormatter.format(
      Math.round(maxTotalCost),
    )} inkl. NK)`;
  }

  if (listingCount) {
    listingCount.textContent = Number.isFinite(listingAmount) ? listingAmount : '–';
  }
}

function renderAverageRent(rentData, postalCode) {
  if (!averageRentOutput || !listingSummary) return;
  const average = rentData && Number.isFinite(rentData.average_rent_per_sqm) ? rentData.average_rent_per_sqm : null;
  if (average && average > 0) {
    averageRentOutput.textContent = `${currencyFormatter.format(Math.round(average))} / m²`;
    listingSummary.textContent = `Geschätzte Nettokaltmiete pro m² im Umkreis von ${postalCode}.`;
  } else {
    averageRentOutput.textContent = '–';
    listingSummary.textContent = 'Keine Mietschätzung verfügbar – bitte PLZ prüfen.';
  }
}

function renderListings(listings, options) {
  const { maxTotalCost, availableAssets, additionalCostRate } = options;
  if (!listingResults) return;
  listingResults.innerHTML = '';

  if (!Array.isArray(listings) || listings.length === 0) {
    listingsMessage.textContent = 'Keine Objekte gefunden. Bitte PLZ oder Vermögen anpassen.';
    return;
  }

  listingsMessage.textContent = `Wir zeigen ${Math.min(listings.length, MAX_LISTINGS)} zufällige Angebote in der Nähe.`;

  listings.slice(0, MAX_LISTINGS).forEach((property) => {
    const item = document.createElement('li');
    item.className = 'listing-item';

    const details = document.createElement('div');
    details.className = 'listing-details';

    const header = document.createElement('div');
    header.className = 'listing-header';

    const price = document.createElement('p');
    price.className = 'listing-price';
    const totalPrice = deriveTotalPrice(property, additionalCostRate);
    const basePriceText = currencyFormatter.format(property.price_eur);
    const totalPriceText = Number.isFinite(totalPrice)
      ? currencyFormatter.format(Math.round(totalPrice))
      : '–';
    price.textContent = basePriceText;

    const totalPriceBadge = document.createElement('span');
    totalPriceBadge.className = 'listing-total';
    totalPriceBadge.textContent = `≈ ${totalPriceText} inkl. NK`;

    header.append(price);
    if (Number.isFinite(totalPrice)) {
      header.append(totalPriceBadge);
    }

    const isAffordable = Number.isFinite(maxTotalCost) && Number.isFinite(totalPrice) ? totalPrice <= maxTotalCost : false;
    const canBuyDirectly = Number.isFinite(totalPrice) && availableAssets >= totalPrice;

    const affordability = document.createElement('span');
    affordability.className = 'listing-affordability';

    if (canBuyDirectly) {
      affordability.textContent = 'Direktkauf möglich';
      affordability.classList.add('direct');
    } else if (isAffordable) {
      affordability.textContent = 'Finanzierung möglich';
      affordability.classList.add('mortgage-needed');
    } else {
      affordability.textContent = 'Über Eigenkapitalgrenze';
      affordability.classList.add('not-affordable');
    }

    header.append(affordability);
    details.append(header);

    const address = document.createElement('p');
    address.className = 'listing-address';
    address.textContent = property.address;
    details.append(address);

    const meta = document.createElement('div');
    meta.className = 'listing-meta';
    const sqm = `${Math.round(property.living_space_sqm)} m²`;
    const rooms = `${property.rooms} Zimmer`;
    const pricePerSqm = property.price_per_sqm
      ? `${currencyFormatter.format(property.price_per_sqm)} / m²`
      : 'Preis / m² n. v.';
    meta.innerHTML = `<span>${sqm}</span><span>${rooms}</span><span>${pricePerSqm}</span>`;
    details.append(meta);

    const actions = document.createElement('div');
    actions.className = 'listing-actions';
    const mockupLink = document.createElement('a');
    mockupLink.className = 'listing-link';
    mockupLink.href = `${MOCK_LISTING_BASE_URL}/${encodeURIComponent(property.identifier)}`;
    mockupLink.target = '_blank';
    mockupLink.rel = 'noreferrer noopener';
    mockupLink.textContent = 'Exposé ansehen';

    const detailsButton = document.createElement('button');
    detailsButton.type = 'button';
    detailsButton.className = 'listing-button';
    detailsButton.textContent = 'Finanzierungsdetails';
    detailsButton.addEventListener('click', () => {
      const payload = {
        ...property,
        available_assets: availableAssets,
        property_usage: 'rental',
      };
      sessionStorage.setItem('selectedPropertyDetails', JSON.stringify(payload));
      window.location.href = '/finanzierungsdetails';
    });

    actions.append(mockupLink, detailsButton);
    details.append(actions);
    item.append(details);

    const rentalInfo = document.createElement('div');
    rentalInfo.className = 'listing-mortgage';
    const monthlyRate = Number(property.mortgage_monthly_rate);
    const estimatedRent = Number(property.estimated_rent_month);

    rentalInfo.innerHTML = `
      <p class="mortgage-title">Mieteinnahmen &amp; Rate</p>
      <div class="mortgage-metric">
        <span class="mortgage-metric-label">Geschätzte Nettokaltmiete</span>
        <strong class="mortgage-metric-value">${Number.isFinite(estimatedRent)
          ? currencyFormatter.format(Math.round(estimatedRent))
          : '–'}</strong>
      </div>
      <div class="mortgage-metric">
        <span class="mortgage-metric-label">Monatliche Rate</span>
        <strong class="mortgage-metric-value">${Number.isFinite(monthlyRate)
          ? currencyFormatter.format(Math.round(monthlyRate))
          : '–'}</strong>
      </div>
    `;

    item.append(rentalInfo);
    listingResults.append(item);
  });
}

function sanitizeRate(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

async function handleSubmit(event) {
  event.preventDefault();

  const assets = Number(assetsInput.value);
  const postalCode = postalCodeInput.value.trim();
  const interestPercent = sanitizeRate(interestInput, DEFAULT_INTEREST_PERCENT);
  const repaymentPercent = sanitizeRate(repaymentInput, DEFAULT_REPAYMENT_PERCENT);
  const additionalCostPercent = sanitizeRate(additionalCostInput, DEFAULT_ADDITIONAL_COST_PERCENT);

  if (!postalCode || !Number.isFinite(assets) || assets < 0) {
    alert('Bitte geben Sie ein gültiges Vermögen und eine PLZ ein.');
    return;
  }

  const interestRate = interestPercent / 100;
  const repaymentRate = repaymentPercent / 100;
  const additionalCostRate = additionalCostPercent / 100;
  const maxPropertyPrice = estimateMaxPriceFromAssets(assets, additionalCostRate);
  const maxTotalCost = maxPropertyPrice * (1 + additionalCostRate);

  rentalMessage.textContent =
    'Wir prüfen Objekte, deren Kaufpreis inklusive Nebenkosten und 20 % Eigenkapital in Ihr Vermögen passen.';
  renderTopline(maxPropertyPrice, additionalCostRate, '…');
  if (listingsMessage) {
    listingsMessage.textContent = 'Lade Objekte …';
  }
  listingResults.innerHTML = '';

  try {
    const coords = await fetchCoordinates(`${postalCode}, Deutschland`);
    const [rentData, listingsData] = await Promise.all([
      fetchAverageRent(coords, MARKET_RADIUS_KM),
      fetchListings(coords, MARKET_RADIUS_KM, maxPropertyPrice, interestRate, repaymentRate, additionalCostRate, assets),
    ]);

    renderAverageRent(rentData, postalCode);
    const listings = Array.isArray(listingsData.properties) ? listingsData.properties : [];
    renderTopline(maxPropertyPrice, additionalCostRate, listings.length);
    renderListings(listings, { maxTotalCost, availableAssets: assets, additionalCostRate });
  } catch (error) {
    console.error(error);
    rentalMessage.textContent = error.message || 'Die Suche ist fehlgeschlagen.';
    averageRentOutput.textContent = '–';
    renderListings([], { maxTotalCost, availableAssets: assets, additionalCostRate });
  }
}

if (form) {
  form.addEventListener('submit', handleSubmit);
}
