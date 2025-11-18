const form = document.getElementById('housing-search-form');
const priceInput = document.getElementById('max-price');
const locationInput = document.getElementById('location-query');
const radiusInput = document.getElementById('search-radius');
const searchMessage = document.getElementById('search-message');

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const savedUserData = window.userDataStore ? userDataStore.load() : {};

function prefillPrice() {
  if (typeof savedUserData.maxPropertyPrice === 'number' && savedUserData.maxPropertyPrice > 0) {
    priceInput.value = Math.round(savedUserData.maxPropertyPrice);
    searchMessage.textContent = `Ihr gespeicherter Maximalpreis beträgt ${currencyFormatter.format(
      savedUserData.maxPropertyPrice,
    )}. Passen Sie den Wert bei Bedarf an.`;
  }
}

prefillPrice();

function validateInputs(price, location, radius) {
  if (!Number.isFinite(price) || price <= 0) {
    alert('Bitte geben Sie einen gültigen maximalen Kaufpreis ein.');
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
      'Accept': 'application/json',
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

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const price = Number(priceInput.value);
  const location = locationInput.value.trim();
  const radius = Number(radiusInput.value) || 5;

  if (!validateInputs(price, location, radius)) {
    return;
  }

  searchMessage.textContent = 'Koordinaten werden über Nominatim geladen …';

  try {
    const coords = await fetchCoordinates(location);
    userDataStore.save({ maxPropertyPrice: price });
    searchMessage.textContent =
      `Koordinaten für ${coords.displayName || location} gefunden. Immobilienscout24 wird geöffnet …`;
    openImmobilienScout(price, coords, radius);
  } catch (error) {
    console.error(error);
    searchMessage.textContent = error.message;
  }
});
