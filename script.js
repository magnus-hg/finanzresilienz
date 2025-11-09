const form = document.getElementById('survey-form');
const steps = Array.from(document.querySelectorAll('.step'));
const nextBtn = document.getElementById('next');
const prevBtn = document.getElementById('prev');
const addIncomeBtn = document.getElementById('add-income');
const incomeList = document.getElementById('income-list');
const incomeTemplate = document.getElementById('income-template');
const downloadBtn = document.getElementById('download');
const summaryIncomeTotal = document.getElementById('summary-income-total');
const summaryNetIncome = document.getElementById('summary-net-income');
const summaryWealthTotal = document.getElementById('summary-wealth-total');

let currentStep = 0;

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

function showStep(index) {
  steps.forEach((step, i) => {
    step.classList.toggle('active', i === index);
  });

  prevBtn.disabled = index === 0;
  nextBtn.textContent = index === steps.length - 1 ? 'Fertig' : 'Weiter';

  if (index === steps.length - 1) {
    updateSummary();
  }
}

function validateCurrentStep() {
  const currentSection = steps[currentStep];
  const inputs = Array.from(currentSection.querySelectorAll('input, select'));

  return inputs.every((input) => {
    if (input.type === 'number') {
      if (input.value === '') {
        input.reportValidity();
        return false;
      }
    }
    if (!input.checkValidity()) {
      input.reportValidity();
      return false;
    }
    return true;
  });
}

function gatherIncomeData() {
  return Array.from(incomeList.querySelectorAll('.income-item')).map((item) => ({
    description: item.querySelector('input[name="incomeDescription"]').value,
    type: item.querySelector('select[name="incomeType"]').value,
    hoursPerMonth: parseFloat(item.querySelector('input[name="incomeHours"]').value),
    monthlyIncome: parseFloat(item.querySelector('input[name="incomeAmount"]').value),
  }));
}

function gatherFormData() {
  const data = new FormData(form);
  const personalInfo = {
    age: Number(data.get('age')),
    gender: data.get('gender'),
    education: data.get('education'),
  };

  const incomes = gatherIncomeData();

  const expenses = {
    monthlyExpenses: Number(data.get('expenses')),
  };

  const assets = {
    cash: Number(data.get('cash')),
    bank: Number(data.get('bank')),
    singleStocks: Number(data.get('stocks')),
    etfs: Number(data.get('etfs')),
    realEstate: Number(data.get('realEstate')),
    other: Number(data.get('otherAssets')),
  };

  return {
    personalInfo,
    incomes,
    expenses,
    assets,
    generatedAt: new Date().toISOString(),
  };
}

function updateSummary() {
  const data = gatherFormData();
  const totalIncome = data.incomes.reduce((sum, income) => sum + income.monthlyIncome, 0);
  const totalExpenses = data.expenses.monthlyExpenses;
  const netIncome = totalIncome - totalExpenses;
  const totalWealth = Object.values(data.assets).reduce((sum, value) => sum + value, 0);

  summaryIncomeTotal.textContent = currencyFormatter.format(totalIncome);
  summaryNetIncome.textContent = currencyFormatter.format(netIncome);
  summaryWealthTotal.textContent = currencyFormatter.format(totalWealth);
}

function createIncomeItem() {
  const clone = incomeTemplate.content.cloneNode(true);
  const item = clone.querySelector('.income-item');
  const removeBtn = item.querySelector('.remove');

  removeBtn.addEventListener('click', () => {
    item.remove();
  });

  incomeList.appendChild(clone);
}

addIncomeBtn.addEventListener('click', () => {
  createIncomeItem();
});

nextBtn.addEventListener('click', () => {
  if (!validateCurrentStep()) {
    return;
  }

  if (currentStep < steps.length - 1) {
    currentStep += 1;
    showStep(currentStep);
  } else {
    const incomes = gatherIncomeData();
    if (incomes.length === 0) {
      alert('Bitte fügen Sie mindestens eine Einkommensquelle hinzu.');
      currentStep = 1;
      showStep(currentStep);
      return;
    }
    alert('Sie können nun die Daten als JSON herunterladen.');
  }
});

prevBtn.addEventListener('click', () => {
  if (currentStep > 0) {
    currentStep -= 1;
    showStep(currentStep);
  }
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
});

downloadBtn.addEventListener('click', () => {
  if (!validateCurrentStep()) {
    return;
  }

  const incomes = gatherIncomeData();
  if (incomes.length === 0) {
    alert('Bitte fügen Sie mindestens eine Einkommensquelle hinzu.');
    currentStep = 1;
    showStep(currentStep);
    return;
  }

  const data = gatherFormData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'finanzielle-resilienz-umfrage.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

// Initialize
showStep(currentStep);
createIncomeItem();
