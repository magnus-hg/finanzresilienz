const DEFAULT_ADDITIONAL_COST_PERCENT = 10.5;
const DEFAULT_INTEREST_PERCENT = 4;
const DEFAULT_REPAYMENT_PERCENT = 1;
const MARKET_RADIUS_KM = 8;
const MAX_LISTINGS = 10;
const MOCK_LISTING_BASE_URL = 'https://www.immobilienscout24.de/expose';

const mortgageForm = document.getElementById('mortgage-form');
const budgetInput = document.getElementById('mortgage-budget');
const assetsInput = document.getElementById('assets');
const interestInput = document.getElementById('interest-rate');
const repaymentInput = document.getElementById('repayment-rate');
const additionalCostInput = document.getElementById('additional-costs');
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

function deriveTotalPrice(property, fallbackAdditionalCostRate) {
  const additionalCosts = Number(property.additional_costs_eur);
  const totalPrice = Number(property.total_price_eur);
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

function populateInitialValues() {
  if (typeof savedUserData.monthlyRate === 'number') {
    budgetInput.value = savedUserData.monthlyRate;
  }
  if (typeof savedUserData.assets === 'number') {
    assetsInput.value = savedUserData.assets;
  }
  if (interestInput) {
    if (typeof savedUserData.interestRatePercent === 'number') {
      interestInput.value = savedUserData.interestRatePercent;
    } else if (!interestInput.value) {
      interestInput.value = DEFAULT_INTEREST_PERCENT;
    }
  }
  if (repaymentInput) {
    if (typeof savedUserData.repaymentRatePercent === 'number') {
      repaymentInput.value = savedUserData.repaymentRatePercent;
    } else if (!repaymentInput.value) {
      repaymentInput.value = DEFAULT_REPAYMENT_PERCENT;
    }
  }
  if (additionalCostInput) {
    if (typeof savedUserData.additionalCostPercent === 'number') {
      additionalCostInput.value = savedUserData.additionalCostPercent;
    } else if (!additionalCostInput.value) {
      additionalCostInput.value = DEFAULT_ADDITIONAL_COST_PERCENT;
    }
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
persistNumberInput(interestInput, 'interestRatePercent');
persistNumberInput(repaymentInput, 'repaymentRatePercent');
persistNumberInput(additionalCostInput, 'additionalCostPercent');
persistTextInput(postalCodeInput, 'postalCode');

function calculateAffordableValues(budget, assets, interestRate, repaymentRate, additionalCostRate) {
  const yearlyRate = interestRate + repaymentRate;
  if (yearlyRate <= 0) {
    throw new Error('Zins und Tilgung müssen größer als 0 sein.');
  }
  const possibleLoan = (budget * 12) / yearlyRate;
  const totalAffordable = possibleLoan + assets;
  const totalCostRate = Number.isFinite(additionalCostRate)
    ? Math.max(additionalCostRate, 0)
    : DEFAULT_ADDITIONAL_COST_PERCENT / 100;
  const maxPropertyPrice = totalAffordable / (1 + totalCostRate);
  const maxTotalCost = maxPropertyPrice * (1 + totalCostRate);

  return {
    possibleLoan,
    totalAffordable,
    maxPropertyPrice,
    maxTotalCost,
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

function renderListings(listings, fallbackMessage, options = {}) {
  const { maxPropertyPrice, maxTotalCost, availableAssets = 0, additionalCostRate } = options;
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

    const totalCostRate = Number.isFinite(additionalCostRate)
      ? Math.max(additionalCostRate, 0)
      : DEFAULT_ADDITIONAL_COST_PERCENT / 100;
    const priceCap = Number.isFinite(maxTotalCost)
      ? maxTotalCost
      : Number.isFinite(maxPropertyPrice)
        ? maxPropertyPrice * (1 + totalCostRate)
        : NaN;
    const canBuyDirectly = Number.isFinite(totalPrice) && availableAssets >= totalPrice;
    const isWithinBudget = Number.isFinite(priceCap) ? totalPrice <= priceCap : true;
    const needsMortgage = !canBuyDirectly && property.mortgage_loan_amount > 0;

    const affordability = document.createElement('span');
    affordability.className = 'listing-affordability';

    if (canBuyDirectly) {
      affordability.textContent = 'Direktkauf möglich';
      affordability.classList.add('direct');
      affordability.title = 'Ihr Eigenkapital deckt den gesamten Kaufpreis.';
    } else if (needsMortgage && isWithinBudget) {
      affordability.textContent = 'Finanzierung möglich';
      affordability.classList.add('mortgage-needed');
      affordability.title = 'Finanzierung erforderlich, aber innerhalb Ihrer Budgetvorgaben.';
    } else {
      affordability.textContent = 'Über Budget';
      affordability.classList.add('not-affordable');
      affordability.title = 'Preis übersteigt Ihren maximalen Immobilienpreis.';
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
        property_usage: 'owner-occupied',
      };
      sessionStorage.setItem('selectedPropertyDetails', JSON.stringify(payload));
      window.location.href = '/finanzierungsdetails/eigenheim';
    });

    actions.append(mockupLink, detailsButton);
    details.append(actions);

    item.append(details);

    const mortgageInfo = document.createElement('div');
    mortgageInfo.className = 'listing-mortgage';
    const payoffYears = Number(property.mortgage_years);
    const totalInterest = Number(property.mortgage_total_interest);
    const totalPaid = Number(property.mortgage_total_paid);
    const monthlyRate = Number(property.mortgage_monthly_rate);
    const loanAmount = Number(property.mortgage_loan_amount);

    const payoffText = Number.isFinite(payoffYears) ? `${payoffYears} Jahren` : '–';
    const monthlyRateText = Number.isFinite(monthlyRate)
      ? currencyFormatter.format(Math.round(monthlyRate))
      : '–';
    const loanAmountText = Number.isFinite(loanAmount)
      ? currencyFormatter.format(Math.round(loanAmount))
      : '–';
    const interestText = Number.isFinite(totalInterest)
      ? currencyFormatter.format(Math.round(totalInterest))
      : '–';
    const totalPaidText = Number.isFinite(totalPaid)
      ? currencyFormatter.format(Math.round(totalPaid))
      : '–';

    mortgageInfo.innerHTML = `
      <p class="mortgage-title">Tilgungsübersicht</p>
      <div class="mortgage-metric">
        <span class="mortgage-metric-label">Darlehenshöhe</span>
        <strong class="mortgage-metric-value">${loanAmountText}</strong>
      </div>
      <div class="mortgage-metric">
        <span class="mortgage-metric-label">Monatliche Rate</span>
        <strong class="mortgage-metric-value">${monthlyRateText}</strong>
      </div>
      <div class="mortgage-metric">
        <span class="mortgage-metric-label">Abbezahlt in</span>
        <strong class="mortgage-metric-value">${payoffText}</strong>
      </div>
      <div class="mortgage-metric">
        <span class="mortgage-metric-label">Bank erhält</span>
        <strong class="mortgage-metric-value">${interestText}</strong>
      </div>
      <div class="mortgage-metric">
        <span class="mortgage-metric-label">Gesamtsumme</span>
        <strong class="mortgage-metric-value">${totalPaidText}</strong>
      </div>
    `;

    item.append(mortgageInfo);

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

async function fetchListings(
  coords,
  radius,
  maxPrice,
  rates = {},
  availableAssets = 0,
  additionalCostRate = DEFAULT_ADDITIONAL_COST_PERCENT / 100,
) {
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
  if (rates && Number.isFinite(rates.interestRate)) {
    params.set('interest_rate', String(rates.interestRate));
  }
  if (rates && Number.isFinite(rates.repaymentRate)) {
    params.set('tilgung_rate', String(rates.repaymentRate));
  }
  if (Number.isFinite(availableAssets) && availableAssets > 0) {
    params.set('available_assets', String(Math.max(availableAssets, 0)));
  }
  if (Number.isFinite(additionalCostRate)) {
    params.set('additional_cost_rate', String(Math.max(additionalCostRate, 0)));
  }
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

async function updateMarketInsights({
  postalCode,
  maxPropertyPrice,
  maxTotalCost,
  rates = {},
  availableAssets = 0,
  additionalCostRate = DEFAULT_ADDITIONAL_COST_PERCENT / 100,
  fromStorage = false,
}) {
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

  const appliedRates = {
    interestRate: Number.isFinite(rates.interestRate)
      ? rates.interestRate
      : DEFAULT_INTEREST_PERCENT / 100,
    repaymentRate: Number.isFinite(rates.repaymentRate)
      ? rates.repaymentRate
      : DEFAULT_REPAYMENT_PERCENT / 100,
  };
  const sanitizedAssets = Number.isFinite(availableAssets) ? Math.max(availableAssets, 0) : 0;
  const totalCostRate = Number.isFinite(additionalCostRate)
    ? Math.max(additionalCostRate, 0)
    : DEFAULT_ADDITIONAL_COST_PERCENT / 100;
  const totalCostCap = Number.isFinite(maxTotalCost)
    ? maxTotalCost
    : Number.isFinite(maxPropertyPrice)
      ? maxPropertyPrice * (1 + totalCostRate)
      : NaN;

  try {
    const coords = await fetchCoordinates(`${postalCode}, Deutschland`);
    const [listingsData, averageData] = await Promise.all([
      fetchListings(
        coords,
        MARKET_RADIUS_KM,
        maxPropertyPrice,
        appliedRates,
        sanitizedAssets,
        totalCostRate,
      ),
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
        {
          maxPropertyPrice,
          maxTotalCost: totalCostCap,
          availableAssets: sanitizedAssets,
          additionalCostRate: totalCostRate,
        },
      );
    } else {
      renderListings(listings, '', {
        maxPropertyPrice,
        maxTotalCost: totalCostCap,
        availableAssets: sanitizedAssets,
        additionalCostRate: totalCostRate,
      });
    }
  } catch (error) {
    console.error(error);
    setMarketInsightsMessage(error.message || 'Marktdaten konnten nicht geladen werden.');
    setAveragePriceDisplay('–');
    renderListings([], 'Marktdaten konnten nicht geladen werden.', {
      maxPropertyPrice,
      maxTotalCost: totalCostCap,
      availableAssets: sanitizedAssets,
      additionalCostRate: totalCostRate,
    });
  }
}

function handleMortgageSubmit(event) {
  event.preventDefault();

  const budget = Number(budgetInput.value);
  const assets = Number(assetsInput.value);
  const interestPercent = Number(interestInput.value);
  const repaymentPercent = Number(repaymentInput.value);
  const additionalCostPercent = Number(additionalCostInput.value);
  const postalCode = postalCodeInput.value.trim();
  const interestRate = interestPercent / 100;
  const repaymentRate = repaymentPercent / 100;
  const additionalCostRate = additionalCostPercent / 100;

  const hasValidNumbers =
    Number.isFinite(budget) &&
    Number.isFinite(assets) &&
    Number.isFinite(interestPercent) &&
    Number.isFinite(repaymentPercent) &&
    Number.isFinite(additionalCostPercent) &&
    budget >= 0 &&
    assets >= 0 &&
    interestPercent >= 0 &&
    repaymentPercent > 0 &&
    additionalCostPercent >= 0 &&
    postalCode.length > 0;

  if (!hasValidNumbers) {
    alert('Bitte geben Sie gültige Werte für Rate, Vermögen, Zins, Tilgung und PLZ ein.');
    return;
  }

  let affordableValues;
  try {
    affordableValues = calculateAffordableValues(
      budget,
      assets,
      interestRate,
      repaymentRate,
      additionalCostRate,
    );
  } catch (error) {
    alert(error.message);
    return;
  }
  const { possibleLoan, totalAffordable, maxPropertyPrice, maxTotalCost } = affordableValues;

  const basePriceText = currencyFormatter.format(maxPropertyPrice);
  const totalCostText = currencyFormatter.format(maxTotalCost);

  totalCostOutput.textContent = `${basePriceText} (≈ ${totalCostText} inkl. Nebenkosten)`;
  loanAmountOutput.textContent = currencyFormatter.format(possibleLoan);
  calculatedRateOutput.textContent = currencyFormatter.format(totalAffordable);

  userDataStore.save({
    monthlyRate: budget,
    assets,
    postalCode,
    maxPropertyPrice,
    maxTotalCost,
    interestRatePercent: interestPercent,
    repaymentRatePercent: repaymentPercent,
    additionalCostPercent: additionalCostPercent,
    interestRate,
    repaymentRate,
    additionalCostRate,
  });

  resultCard.classList.remove('result-positive', 'result-negative');
  resultCard.classList.add('result-positive');

  const interestPercentText = interestPercent.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  const repaymentPercentText = repaymentPercent.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  affordabilityMessage.textContent =
    `Mit einer monatlichen Rate von ${currencyFormatter.format(budget)} und einem Vermögen von ${currencyFormatter.format(
      assets,
    )} bei ${interestPercentText}% Zins und ${repaymentPercentText}% Tilgung sowie ${additionalCostPercent.toLocaleString(
      'de-DE',
      { maximumFractionDigits: 1 },
    )}% Nebenkosten können Sie eine Immobilie im Wert von bis zu ${basePriceText} (ca. ${totalCostText} inkl. Nebenkosten) finanzieren.`;

  updateMarketInsights({
    postalCode,
    maxPropertyPrice,
    maxTotalCost,
    rates: { interestRate, repaymentRate },
    availableAssets: assets,
    additionalCostRate,
    fromStorage: false,
  });
}

mortgageForm.addEventListener('submit', handleMortgageSubmit);

function initMarketInsightsFromStorage() {
  if (!marketInsightsCard) return;
  const postalCode = typeof savedUserData.postalCode === 'string' ? savedUserData.postalCode : '';
  const maxPrice = typeof savedUserData.maxPropertyPrice === 'number' ? savedUserData.maxPropertyPrice : null;
  const maxTotalCost = typeof savedUserData.maxTotalCost === 'number' ? savedUserData.maxTotalCost : null;
  const storedInterestRate =
    typeof savedUserData.interestRate === 'number'
      ? savedUserData.interestRate
      : typeof savedUserData.interestRatePercent === 'number'
        ? savedUserData.interestRatePercent / 100
        : DEFAULT_INTEREST_PERCENT / 100;
  const storedRepaymentRate =
    typeof savedUserData.repaymentRate === 'number'
      ? savedUserData.repaymentRate
      : typeof savedUserData.repaymentRatePercent === 'number'
        ? savedUserData.repaymentRatePercent / 100
        : DEFAULT_REPAYMENT_PERCENT / 100;
  const storedAdditionalCostRate =
    typeof savedUserData.additionalCostRate === 'number'
      ? savedUserData.additionalCostRate
      : typeof savedUserData.additionalCostPercent === 'number'
        ? savedUserData.additionalCostPercent / 100
        : DEFAULT_ADDITIONAL_COST_PERCENT / 100;
  if (postalCode && typeof maxPrice === 'number' && maxPrice > 0) {
    const storedAssets =
      typeof savedUserData.assets === 'number' && savedUserData.assets > 0
        ? savedUserData.assets
        : 0;
    updateMarketInsights({
      postalCode,
      maxPropertyPrice: maxPrice,
      maxTotalCost,
      rates: { interestRate: storedInterestRate, repaymentRate: storedRepaymentRate },
      availableAssets: storedAssets,
      additionalCostRate: storedAdditionalCostRate,
      fromStorage: true,
    });
  }
}

initMarketInsightsFromStorage();
