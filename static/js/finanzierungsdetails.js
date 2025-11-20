const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 2,
});

const PROPERTY_STORAGE_KEY = 'selectedPropertyDetails';

const summary = document.getElementById('property-summary');
const financingStatus = document.getElementById('financing-status');
const financingMessage = document.getElementById('financing-message');
const detailPrice = document.getElementById('detail-price');
const detailAssets = document.getElementById('detail-assets');
const detailLoan = document.getElementById('detail-loan');
const detailRate = document.getElementById('detail-rate');
const badgeLoan = document.getElementById('badge-loan');
const badgeDuration = document.getElementById('badge-duration');
const chartCanvas = document.getElementById('financing-chart');

function loadSelectedProperty() {
  const stored = sessionStorage.getItem(PROPERTY_STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error('Konnte gespeicherte Immobilie nicht parsen.', error);
    return null;
  }
}

function calculateSchedule(principal, interestRate, tilgungRate, maxYears = 100) {
  if (!Number.isFinite(principal) || principal < 0) return [];
  if (!Number.isFinite(interestRate) || !Number.isFinite(tilgungRate)) return [];
  const annuity = principal * (interestRate + tilgungRate);
  if (annuity <= principal * interestRate) return [];

  const schedule = [];
  let balance = principal;
  let year = 1;
  while (balance > 0 && year <= maxYears) {
    const interestPaid = balance * interestRate;
    let principalPaid = annuity - interestPaid;
    let payment = annuity;

    if (principalPaid > balance) {
      principalPaid = balance;
      payment = interestPaid + principalPaid;
    }

    balance -= principalPaid;
    if (Math.abs(balance) < 0.01) balance = 0;

    schedule.push({
      year,
      interestPaid,
      principalPaid,
      remainingPrincipal: balance,
      payment,
    });

    if (balance <= 0) break;
    year += 1;
  }

  return schedule;
}

function renderFinancingMessage({ price_eur, available_assets, mortgage_loan_amount }) {
  const canBuyDirectly = price_eur <= available_assets;
  const needsMortgage = mortgage_loan_amount > 0;

  financingStatus.classList.remove('result-positive', 'result-negative');
  financingStatus.classList.add(canBuyDirectly ? 'result-positive' : 'result-negative');

  if (canBuyDirectly) {
    financingMessage.textContent =
      'Sie können dieses Objekt vollständig mit Ihrem Eigenkapital erwerben – keine Finanzierung notwendig.';
  } else if (needsMortgage) {
    financingMessage.textContent =
      'Für dieses Objekt ist eine Finanzierung erforderlich. Die unten stehende Tilgungsplanung zeigt den Verlauf.';
  } else {
    financingMessage.textContent = 'Bitte prüfen Sie Ihre Eingaben oder berechnen Sie das Angebot erneut.';
  }
}

function renderBadges(property, schedule) {
  const loanText = Number.isFinite(property.mortgage_loan_amount)
    ? `Darlehen: ${currencyFormatter.format(property.mortgage_loan_amount)}`
    : 'Darlehenssumme unbekannt';
  const durationText = schedule.length > 0 ? `Abbezahlt in ca. ${schedule.length} Jahren` : 'Keine Laufzeit berechnet';

  badgeLoan.textContent = loanText;
  badgeDuration.textContent = durationText;
}

function renderStats(property) {
  detailPrice.textContent = currencyFormatter.format(property.price_eur || 0);
  detailAssets.textContent = currencyFormatter.format(property.available_assets || 0);
  detailLoan.textContent = currencyFormatter.format(property.mortgage_loan_amount || 0);
  detailRate.textContent = currencyFormatter.format(property.mortgage_monthly_rate || 0);
}

function renderSummary(property) {
  const address = property.address || 'Unbekannte Adresse';
  const rooms = property.rooms ? `${property.rooms} Zimmer` : 'Zimmerzahl n. v.';
  const size = property.living_space_sqm
    ? `${numberFormatter.format(property.living_space_sqm)} m²`
    : 'Fläche n. v.';
  summary.textContent = `${address} • ${rooms} • ${size}`;
}

function buildChartData(schedule) {
  return {
    labels: schedule.map((item) => `Jahr ${item.year}`),
    datasets: [
      {
        type: 'bar',
        label: 'Zinsanteil',
        data: schedule.map((item) => Math.round(item.interestPaid)),
        backgroundColor: 'rgba(234, 88, 12, 0.6)',
        stack: 'payments',
      },
      {
        type: 'bar',
        label: 'Tilgung',
        data: schedule.map((item) => Math.round(item.principalPaid)),
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        stack: 'payments',
      },
      {
        type: 'line',
        label: 'Restschuld',
        data: schedule.map((item) => Math.round(item.remainingPrincipal)),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.2,
        yAxisID: 'y',
      },
    ],
  };
}

function renderChart(schedule) {
  if (!chartCanvas || schedule.length === 0) return;

  const chartData = buildChartData(schedule);
  const ctx = chartCanvas.getContext('2d');
  if (!ctx) return;

  return new Chart(ctx, {
    data: chartData,
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed.y;
              return `${context.dataset.label}: ${currencyFormatter.format(value)}`;
            },
          },
        },
      },
      scales: {
        x: { stacked: true },
        y: {
          stacked: true,
          title: { display: true, text: 'EUR pro Jahr' },
          ticks: {
            callback: (value) => currencyFormatter.format(value),
          },
        },
      },
    },
  });
}

function initFinancingDetails() {
  const property = loadSelectedProperty();
  if (!property) {
    summary.textContent =
      'Es wurden keine Finanzierungsdetails gefunden. Bitte wählen Sie ein Objekt auf der Immobilienrechner-Seite aus.';
    financingMessage.textContent = 'Keine Daten vorhanden.';
    return;
  }

  renderSummary(property);
  renderFinancingMessage(property);
  renderStats(property);

  const schedule = calculateSchedule(
    property.mortgage_loan_amount,
    property.mortgage_interest_rate,
    property.mortgage_tilgung_rate,
  );
  renderBadges(property, schedule);
  renderChart(schedule);
}

initFinancingDetails();
