const RETIREMENT_AGE = 67;
const RETURN_RATE = 0.08;

const form = document.getElementById('projection-form');
const ageInput = document.getElementById('age');
const incomeInput = document.getElementById('income');
const yearsOutput = document.getElementById('years-to-retirement');
const annualInvestmentOutput = document.getElementById('annual-investment');
const finalWealthOutput = document.getElementById('final-wealth');
const investedWealthOutput = document.getElementById('invested-wealth');
const chartCanvas = document.getElementById('wealth-chart');

const savedUserData = window.userDataStore ? userDataStore.load() : {};

function populateInitialValues() {
  if (typeof savedUserData.age === 'number') {
    ageInput.value = savedUserData.age;
  }
  if (typeof savedUserData.monthlyRate === 'number') {
    incomeInput.value = savedUserData.monthlyRate;
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
persistNumberInput(incomeInput, 'monthlyRate');

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

let wealthChart;

function calculateProjection(age, monthlyIncome) {
  const yearsToRetirement = Math.max(RETIREMENT_AGE - age, 0);
  const annualContribution = monthlyIncome * 12;
  const dataPoints = [];
  const currentYear = new Date().getFullYear();

  let wealth = 0;
  for (let year = 1; year <= yearsToRetirement; year += 1) {
    wealth = (wealth + annualContribution) * (1 + RETURN_RATE);
    dataPoints.push({
      label: `Alter ${age + year}`,
      year,
      calendarYear: currentYear + year,
      wealth,
    });
  }

  const totalInvested = annualContribution * yearsToRetirement;

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
  const hasValidValues =
    Number.isFinite(age) && Number.isFinite(income) && age > 0 && income >= 0;

  if (!hasValidValues) {
    if (!silent) {
      alert('Bitte geben Sie gültige Werte für Alter und Einkommen ein.');
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

  const projection = calculateProjection(age, income);
  updateOutputs(projection);
  updateChart(projection.dataPoints);
  return true;
}

function handleFormSubmit(event) {
  event.preventDefault();
  const age = Number(ageInput.value);
  const income = Number(incomeInput.value);

  if (!runProjection(age, income)) {
    return;
  }

  userDataStore.save({ age, monthlyRate: income });
}

const hasPrefilledValues = ageInput.value !== '' && incomeInput.value !== '';
if (hasPrefilledValues) {
  const initialAge = Number(ageInput.value);
  const initialIncome = Number(incomeInput.value);
  runProjection(initialAge, initialIncome, { silent: true });
}

form.addEventListener('submit', handleFormSubmit);
