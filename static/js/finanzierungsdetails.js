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
const detailRent = document.getElementById('detail-rent');
const detailRentMeta = document.getElementById('detail-rent-meta');
const badgeLoan = document.getElementById('badge-loan');
const badgeDuration = document.getElementById('badge-duration');
const chartCanvas = document.getElementById('financing-chart');
const assetChartCanvas = document.getElementById('asset-chart');
const detailMode = document.body?.dataset?.detailMode || 'combined';
const viewDescription = document.getElementById('view-description');
const viewButtons = document.querySelectorAll('[data-view-button]');
const viewSections = document.querySelectorAll('.view-section');
const rentalCoverage = document.getElementById('rental-coverage');
const rentalCoverageMeta = document.getElementById('rental-coverage-meta');
const rentalGrossYield = document.getElementById('rental-gross-yield');
const rentalOutlook = document.getElementById('rental-outlook');
const RENT_GROWTH_RATE = 0.02;
const PROPERTY_GROWTH_RATE = 0.02;
const START_YEAR = new Date().getFullYear();
let chartInstance = null;
let assetChartInstance = null;
let currentSchedule = [];
let currentProperty = null;

function deriveTotalPrice(property) {
  const totalPrice = Number(property.total_price_eur);
  const additionalCosts = Number(property.additional_costs_eur);

  if (Number.isFinite(totalPrice)) {
    return totalPrice;
  }

  if (Number.isFinite(additionalCosts) && Number.isFinite(property.price_eur)) {
    return property.price_eur + additionalCosts;
  }

  if (Number.isFinite(property.price_eur)) {
    return property.price_eur * 1.105;
  }

  return NaN;
}

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

function isRentalScenario(property) {
  return property.property_usage === 'rental';
}

function buildYearLabels(schedule, startYear = START_YEAR) {
  return schedule.map((item) => `${startYear + item.year - 1}`);
}

function renderFinancingMessage(property) {
  const totalPrice = deriveTotalPrice(property);
  const canBuyDirectly = Number.isFinite(totalPrice) && totalPrice <= property.available_assets;
  const needsMortgage = property.mortgage_loan_amount > 0;
  const rentMonth = Number(property.estimated_rent_month);
  const monthlyRate = Number(property.mortgage_monthly_rate);
  const rentalScenario = isRentalScenario(property);

  financingStatus.classList.remove('result-positive', 'result-negative');
  financingStatus.classList.add(canBuyDirectly ? 'result-positive' : 'result-negative');

  if (canBuyDirectly) {
    financingMessage.textContent =
      'Sie können dieses Objekt vollständig mit Ihrem Eigenkapital erwerben – keine Finanzierung notwendig.';
  } else if (needsMortgage) {
    const coverageText =
      rentalScenario && Number.isFinite(rentMonth) && Number.isFinite(monthlyRate) && monthlyRate > 0
        ? `Die geschätzten Mieteinnahmen von ${currencyFormatter.format(Math.round(rentMonth))} decken etwa ${Math.round(
            (rentMonth / monthlyRate) * 100,
          )}% der Rate.`
        : 'Wir kalkulieren die Rate mit Ihren Standardannahmen zu Zins und Tilgung.';
    const rentalNote = rentalScenario ? ' Wir berücksichtigen die Mieteinnahmen im Verlauf.' : '';
    financingMessage.textContent = `Für dieses Objekt ist eine Finanzierung erforderlich.${rentalNote} ${coverageText} Die unten stehende Tilgungsplanung zeigt den Verlauf.`;
  } else {
    financingMessage.textContent = 'Bitte prüfen Sie Ihre Eingaben oder berechnen Sie das Angebot erneut.';
  }
}

function renderRentalKPIs(property) {
  if (!rentalCoverage || !rentalGrossYield) return;

  const rentMonth = Number(property.estimated_rent_month);
  const monthlyRate = Number(property.mortgage_monthly_rate);
  const totalPrice = deriveTotalPrice(property);

  if (Number.isFinite(rentMonth) && Number.isFinite(monthlyRate) && monthlyRate > 0) {
    const coverage = Math.min((rentMonth / monthlyRate) * 100, 9999);
    rentalCoverage.textContent = `${numberFormatter.format(coverage)} %`;
    rentalCoverageMeta.textContent = `Mieteinnahmen von ${currencyFormatter.format(
      Math.round(rentMonth),
    )} decken ${numberFormatter.format(coverage)} % der Rate von ${currencyFormatter.format(
      Math.round(monthlyRate),
    )}.`;
  } else if (!Number.isFinite(rentMonth)) {
    rentalCoverage.textContent = '–';
    rentalCoverageMeta.textContent = 'Keine Mietschätzung verfügbar.';
  } else {
    rentalCoverage.textContent = '–';
    rentalCoverageMeta.textContent = 'Keine Rate berechnet.';
  }

  const annualRent = Number.isFinite(rentMonth) ? rentMonth * 12 : NaN;
  if (Number.isFinite(annualRent) && Number.isFinite(totalPrice) && totalPrice > 0) {
    const grossYield = Math.min((annualRent / totalPrice) * 100, 9999);
    rentalGrossYield.textContent = `${numberFormatter.format(grossYield)} %`;
  } else {
    rentalGrossYield.textContent = '–';
  }

  if (rentalOutlook) {
    const rentalScenario = isRentalScenario(property);
    rentalOutlook.textContent = rentalScenario
      ? 'Vermietungssicht: Wir zeigen, wie Mieteinnahmen Rate und Rendite beeinflussen.'
      : 'Eigennutzung vorausgewählt – Vermietungssicht blendet hypothetische Mieteinnahmen ein.';
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
  const totalPrice = deriveTotalPrice(property);
  const basePriceText = currencyFormatter.format(property.price_eur || 0);
  const totalPriceText = Number.isFinite(totalPrice)
    ? currencyFormatter.format(Math.round(totalPrice))
    : currencyFormatter.format(property.price_eur || 0);
  detailPrice.textContent = `${basePriceText} (≈ ${totalPriceText} inkl. Nebenkosten)`;
  detailAssets.textContent = currencyFormatter.format(property.available_assets || 0);
  detailLoan.textContent = currencyFormatter.format(property.mortgage_loan_amount || 0);
  detailRate.textContent = currencyFormatter.format(property.mortgage_monthly_rate || 0);

  const rentalScenario = isRentalScenario(property);
  if (detailRent) {
    if (rentalScenario) {
      const estimatedRent = Number(property.estimated_rent_month);
      detailRent.textContent = Number.isFinite(estimatedRent)
        ? `${currencyFormatter.format(Math.round(estimatedRent))} / Monat`
        : '–';
    } else {
      detailRent.textContent = 'Nicht relevant (Eigennutzung)';
    }
  }
  if (detailRentMeta) {
    if (!rentalScenario) {
      detailRentMeta.textContent = 'Bei Eigennutzung fallen keine Mieteinnahmen an.';
    } else if (Number.isFinite(property.estimated_rent_per_sqm) && property.estimated_rent_per_sqm > 0) {
      detailRentMeta.textContent = `≈ ${currencyFormatter.format(property.estimated_rent_per_sqm)} pro m² • Größe: ${numberFormatter.format(
        property.living_space_sqm || 0,
      )} m²`;
    } else {
      detailRentMeta.textContent = 'Keine Mietschätzung verfügbar.';
    }
  }
}

function renderSummary(property) {
  const address = property.address || 'Unbekannte Adresse';
  const rooms = property.rooms ? `${property.rooms} Zimmer` : 'Zimmerzahl n. v.';
  const size = property.living_space_sqm
    ? `${numberFormatter.format(property.living_space_sqm)} m²`
    : 'Fläche n. v.';
  const usage = isRentalScenario(property) ? 'Vermietungsszenario' : 'Eigennutzung';
  summary.textContent = `${address} • ${rooms} • ${size} • ${usage}`;
}

function updateViewDescription(view, property) {
  if (!viewDescription) return;
  const scenarioText = view === 'rental'
    ? 'Sie betrachten das Objekt als Kapitalanlage.'
    : 'Sie betrachten das Objekt für die Eigennutzung.';
  const dataOrigin = isRentalScenario(property)
    ? 'Das Objekt wurde mit Vermietungsparametern berechnet.'
    : 'Das Objekt wurde mit Parametern zur Eigennutzung berechnet.';
  const fixedContext = detailMode === 'owner'
    ? 'Die Seite konzentriert sich auf die Eigennutzung.'
    : detailMode === 'rental'
      ? 'Die Seite konzentriert sich auf die Vermietung.'
      : '';
  viewDescription.textContent = `${scenarioText} ${dataOrigin} ${fixedContext}`.trim();
}

function setView(view, property) {
  viewButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.viewButton === view);
  });

  viewSections.forEach((section) => {
    const target = section.dataset.view;
    const shouldHide = target && target !== view;
    section.classList.toggle('is-hidden', shouldHide);
  });

  updateViewDescription(view, property);
  renderChart(currentSchedule, property, view);
  renderAssetChart(currentSchedule, property);
}

function buildChartData(schedule, options = {}) {
  const { annualRent = 0, showRentLine = false, rentGrowthRate = RENT_GROWTH_RATE } = options;
  const datasets = [
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
      stack: 'balances',
      yAxisID: 'y',
    },
  ];

  if (showRentLine && Number.isFinite(annualRent) && annualRent > 0) {
    const rentSeries = schedule.map((item, index) => Math.round(annualRent * (1 + rentGrowthRate) ** index));
    datasets.push({
      type: 'line',
      label: 'Mieteinnahmen p.a.',
      data: rentSeries,
      borderColor: 'rgba(234, 179, 8, 1)',
      borderDash: [6, 6],
      tension: 0.1,
      stack: 'rent',
      yAxisID: 'y',
    });
  }

  return {
    labels: buildYearLabels(schedule),
    datasets,
  };
}

function renderChart(schedule, property, view) {
  if (!chartCanvas || schedule.length === 0) return;

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const rentalScenario = isRentalScenario(property);
  const annualRent =
    rentalScenario && property && Number.isFinite(property.estimated_rent_month)
      ? property.estimated_rent_month * 12
      : 0;
  const chartData = buildChartData(schedule, {
    annualRent,
    showRentLine: view === 'rental' && rentalScenario,
    rentGrowthRate: RENT_GROWTH_RATE,
  });
  const ctx = chartCanvas.getContext('2d');
  if (!ctx) return;

  chartInstance = new Chart(ctx, {
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

function buildAssetProgressData(schedule, property) {
  const purchasePrice = Number(property.price_eur) || 0;
  const availableAssets = Number(property.available_assets) || 0;
  const additionalCosts = Number(property.additional_costs_eur) || 0;
  const baseAssets = Math.round(availableAssets - additionalCosts);
  const rentalScenario = isRentalScenario(property);
  const annualRent =
    rentalScenario && Number.isFinite(property.estimated_rent_month)
      ? property.estimated_rent_month * 12
      : 0;

  let cumulativePrincipal = 0;
  let cumulativeGrowth = 0;
  let cumulativeRent = 0;

  const baseSeries = [];
  const principalSeries = [];
  const growthSeries = [];
  const rentSeries = [];

  schedule.forEach((item, index) => {
    cumulativePrincipal += Number(item.principalPaid) || 0;
    cumulativeGrowth = purchasePrice * ((1 + PROPERTY_GROWTH_RATE) ** (index + 1) - 1);

    if (annualRent > 0) {
      const rentThisYear = annualRent * (1 + RENT_GROWTH_RATE) ** index;
      cumulativeRent += rentThisYear;
    }

    baseSeries.push(baseAssets);
    principalSeries.push(Math.round(cumulativePrincipal));
    growthSeries.push(Math.round(cumulativeGrowth));
    if (annualRent > 0) {
      rentSeries.push(Math.round(cumulativeRent));
    }
  });

  const datasets = [
    {
      type: 'bar',
      label: 'Startvermögen nach Nebenkosten',
      data: baseSeries,
      backgroundColor: 'rgba(59, 130, 246, 0.25)',
      stack: 'wealth',
    },
    {
      type: 'bar',
      label: 'Kumulierte Tilgung',
      data: principalSeries,
      backgroundColor: 'rgba(16, 185, 129, 0.7)',
      stack: 'wealth',
    },
    {
      type: 'bar',
      label: 'Wertzuwachs (2 % p.a.)',
      data: growthSeries,
      backgroundColor: 'rgba(234, 179, 8, 0.7)',
      stack: 'wealth',
    },
  ];

  if (rentSeries.length > 0) {
    datasets.push({
      type: 'bar',
      label: 'Kumulierte Mieteinnahmen',
      data: rentSeries,
      backgroundColor: 'rgba(168, 85, 247, 0.55)',
      stack: 'wealth',
    });
  }

  return {
    labels: buildYearLabels(schedule),
    datasets,
  };
}

function renderAssetChart(schedule, property) {
  if (!assetChartCanvas || schedule.length === 0) return;

  if (assetChartInstance) {
    assetChartInstance.destroy();
    assetChartInstance = null;
  }

  const ctx = assetChartCanvas.getContext('2d');
  if (!ctx) return;

  const chartData = buildAssetProgressData(schedule, property);

  assetChartInstance = new Chart(ctx, {
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
          title: { display: true, text: 'Kumulierte Vermögensbestandteile (EUR)' },
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
  renderRentalKPIs(property);

  const schedule = calculateSchedule(
    property.mortgage_loan_amount,
    property.mortgage_interest_rate,
    property.mortgage_tilgung_rate,
  );
  renderBadges(property, schedule);
  currentSchedule = schedule;
  currentProperty = property;

  const defaultView = isRentalScenario(property) ? 'rental' : 'owner';
  const enforcedView = detailMode === 'owner' || detailMode === 'rental'
    ? detailMode
    : defaultView;
  renderChart(currentSchedule, currentProperty, enforcedView);
  renderAssetChart(currentSchedule, currentProperty);
  setView(enforcedView, property);
  viewButtons.forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.viewButton, property));
  });
}

initFinancingDetails();
