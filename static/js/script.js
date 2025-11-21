const RETIREMENT_AGE = 67;

const form = document.getElementById('projection-form');
const ageInput = document.getElementById('age');
const initialWealthInput = document.getElementById('initial-wealth');
const incomeInput = document.getElementById('income');
const etfSelect = document.getElementById('etf-choice');
const yearsOutput = document.getElementById('years-to-retirement');
const annualInvestmentOutput = document.getElementById('annual-investment');
const finalWealthOutput = document.getElementById('final-wealth');
const investedWealthOutput = document.getElementById('invested-wealth');
const chartCanvas = document.getElementById('wealth-chart');
const chartNote = document.getElementById('chart-note');
const selectedEtfLabel = document.getElementById('selected-etf');
const selectedReturnLabel = document.getElementById('selected-return');

const savedUserData = window.userDataStore ? userDataStore.load() : {};

function populateInitialValues() {
  if (typeof savedUserData.age === 'number') {
    ageInput.value = savedUserData.age;
  }
  if (typeof savedUserData.initialWealth === 'number') {
    initialWealthInput.value = savedUserData.initialWealth;
  }
  if (typeof savedUserData.monthlyRate === 'number') {
    incomeInput.value = savedUserData.monthlyRate;
  }
  if (typeof savedUserData.etfIsin === 'string' && etfSelect) {
    const matchingOption = Array.from(etfSelect.options).find(
      (option) => option.value === savedUserData.etfIsin,
    );
    if (matchingOption) {
      etfSelect.value = savedUserData.etfIsin;
    }
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
persistNumberInput(ageInput, 'age');
persistNumberInput(initialWealthInput, 'initialWealth');
persistNumberInput(incomeInput, 'monthlyRate');
if (etfSelect) {
  etfSelect.addEventListener('change', () => {
    userDataStore.save({ etfIsin: etfSelect.value });
    triggerProjectionFromInputs();
  });
}

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

let wealthChart;

function formatPercent(value) {
  return `${(value * 100).toFixed(1).replace('.', ',')} %`;
}

function getSelectedReturnRate() {
  if (!etfSelect) return 0.08;
  const selectedOption = etfSelect.options[etfSelect.selectedIndex];
  const rate = Number(selectedOption?.dataset.returnRate);
  return Number.isFinite(rate) ? rate : 0.08;
}

function getSelectedEtfName() {
  if (!etfSelect) return 'ETF';
  const selectedOption = etfSelect.options[etfSelect.selectedIndex];
  return selectedOption?.dataset.label || selectedOption?.textContent || 'ETF';
}

function calculateProjection(age, monthlyIncome, returnRate, initialWealth = 0) {
  const yearsToRetirement = Math.max(RETIREMENT_AGE - age, 0);
  const annualContribution = monthlyIncome * 12;
  const dataPoints = [];
  const currentYear = new Date().getFullYear();

  let wealth = initialWealth;
  for (let year = 1; year <= yearsToRetirement; year += 1) {
    wealth = (wealth + annualContribution) * (1 + returnRate);
    dataPoints.push({
      label: `Alter ${age + year}`,
      year,
      calendarYear: currentYear + year,
      wealth,
    });
  }

  const totalInvested = initialWealth + annualContribution * yearsToRetirement;

  return {
    yearsToRetirement,
    annualContribution,
    dataPoints,
    finalWealth: wealth,
    totalInvested,
  };
}

function updateOutputs({
  yearsToRetirement,
  annualContribution,
  finalWealth,
  totalInvested,
}) {
  yearsOutput.textContent = yearsToRetirement ? yearsToRetirement : '0';
  annualInvestmentOutput.textContent = currencyFormatter.format(annualContribution);
  finalWealthOutput.textContent =
    typeof finalWealth === 'number'
      ? `Endvermögen: ${currencyFormatter.format(finalWealth)}`
      : '–';
  investedWealthOutput.textContent =
    typeof totalInvested === 'number'
      ? `Investiertes Vermögen: ${currencyFormatter.format(totalInvested)}`
      : '–';
}

function updateChart(dataPoints) {
  const labels = dataPoints.map((point) => `${point.calendarYear}`);
  const data = dataPoints.map((point) => Number(point.wealth.toFixed(2)));

  if (!wealthChart) {
    wealthChart = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Prognostiziertes Vermögen',
            data,
            borderColor: '#2f81f7',
            backgroundColor: 'rgba(47, 129, 247, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            ticks: {
              callback: (value) => `${value.toLocaleString('de-DE')} €`,
            },
            grid: { color: 'rgba(240, 246, 252, 0.08)' },
          },
          x: {
            grid: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) =>
                `Vermögen: ${currencyFormatter.format(context.parsed.y)}`,
            },
          },
        },
      },
    });
  } else {
    wealthChart.data.labels = labels;
    wealthChart.data.datasets[0].data = data;
    wealthChart.update();
  }
}

function runProjection(age, income, { silent = false } = {}) {
  const initialWealthValue =
    initialWealthInput?.value === '' || initialWealthInput?.value == null
      ? 0
      : Number(initialWealthInput.value);
    const hasValidValues =
      Number.isFinite(age) &&
      Number.isFinite(income) &&
      Number.isFinite(initialWealthValue) &&
      age > 0 &&
      income >= 0 &&
      initialWealthValue >= 0;

    if (!hasValidValues) {
      if (!silent) {
        alert('Bitte geben Sie gültige Werte für Alter, Sparrate und Startvermögen ein.');
      }
      return false;
    }

  if (age >= RETIREMENT_AGE) {
    yearsOutput.textContent = '0';
    annualInvestmentOutput.textContent = currencyFormatter.format(income * 12);
    finalWealthOutput.textContent =
      'Sie haben das Rentenalter bereits erreicht. Keine Projektion verfügbar.';
    investedWealthOutput.textContent = 'Investiertes Vermögen: –';
    if (wealthChart) {
      wealthChart.data.labels = [];
      wealthChart.data.datasets[0].data = [];
      wealthChart.update();
    }
    return true;
  }

  const returnRate = getSelectedReturnRate();
  const etfName = getSelectedEtfName();
  const projection = calculateProjection(
    age,
    income,
    returnRate,
    Number.isFinite(initialWealthValue) ? initialWealthValue : 0,
  );
  updateOutputs(projection);
  updateChart(projection.dataPoints);
  if (chartNote) {
    chartNote.textContent =
      'Die Berechnung nimmt an, dass Ihr verfügbarer Betrag einmal pro Jahr investiert wird, ein optionales Startvermögen im ersten Jahr investiert wird und das gesamte Vermögen jedes Jahr um ' +
      formatPercent(returnRate) +
      ' wächst.';
  }
  if (selectedEtfLabel) {
    selectedEtfLabel.textContent = etfName;
  }
  if (selectedReturnLabel) {
    selectedReturnLabel.textContent = formatPercent(returnRate);
  }
  return true;
}

function triggerProjectionFromInputs() {
  const age = Number(ageInput.value);
  const income = Number(incomeInput.value);
  runProjection(age, income, { silent: true });
}

function handleFormSubmit(event) {
  event.preventDefault();
  const age = Number(ageInput.value);
  const income = Number(incomeInput.value);

  if (!runProjection(age, income)) {
    return;
  }

  const initialWealth = Number(initialWealthInput?.value) || 0;
  userDataStore.save({ age, monthlyRate: income, initialWealth });
}

const hasPrefilledValues = ageInput.value !== '' && incomeInput.value !== '';
if (hasPrefilledValues) {
  triggerProjectionFromInputs();
} else if (etfSelect) {
  // Ensure selected ETF information is reflected even before the first submit
  selectedEtfLabel.textContent = getSelectedEtfName();
  selectedReturnLabel.textContent = formatPercent(getSelectedReturnRate());
}

form.addEventListener('submit', handleFormSubmit);
