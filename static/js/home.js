document.addEventListener('DOMContentLoaded', () => {
  const helpIcons = document.querySelectorAll('[data-help-key]');
  const helpTextsUrl = window.helpTextsUrl || '/static/config/help_texts.json';

  fetch(helpTextsUrl)
    .then((response) => response.json())
    .then((helpTexts) => {
      helpIcons.forEach((icon) => {
        const key = icon.dataset.helpKey;
        const text = helpTexts[key];
        if (!text) return;

        icon.setAttribute('data-tooltip', text);
        icon.setAttribute('title', text);
      });
    })
    .catch((error) => {
      console.error('Konnte Hilfetexte nicht laden:', error);
    });

  const capitalMarketData = window.capitalMarketData || [];
  const capitalMarketSelect = document.getElementById('capitalmarket-select');
  const nameTarget = document.getElementById('capitalmarket-name');
  const isinTarget = document.getElementById('capitalmarket-isin');
  const growthTarget = document.getElementById('capitalmarket-growth');
  const availableWealthInput = document.getElementById('available-wealth');
  const yearlySavingsInput = document.getElementById('yearly-savings');
  const yearsInput = document.getElementById('investment-years');
  const simulateButton = document.getElementById('simulate-portfolio');
  const chartCanvas = document.getElementById('capitalmarket-chart');
  const chartEmptyState = document.getElementById('capitalmarket-chart-empty');
  const chartNote = document.getElementById('capitalmarket-chart-note');
  const selectedProductLabel = document.getElementById('selected-product');
  const selectedReturnLabel = document.getElementById('selected-return');
  const selectedYearsLabel = document.getElementById('selected-years');
  const investedWealthBadge = document.getElementById('invested-wealth');
  const finalWealthBadge = document.getElementById('final-wealth');

  const currencyFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

  const formatPercent = (value) => `${(value * 100).toFixed(1).replace('.', ',')} %`;

  let wealthChart;

  const getSelectedProduct = () => {
    const index = Number(capitalMarketSelect?.value) || 0;
    return capitalMarketData?.[index] || {};
  };

  const updateCapitalMarketDetails = (index) => {
    const entry = capitalMarketData[index];
    if (!entry) return;

    nameTarget.textContent = entry.name || '-';
    isinTarget.textContent = entry.isin || '-';
    const growth = Number(entry.return || 0);
    growthTarget.textContent = Number.isFinite(growth) ? `${(growth * 100).toFixed(1)} % p.a.` : '-';

    updateChartMeta({
      productName: entry.name,
      expectedReturn: growth,
      years: Math.max(parseInt(yearsInput?.value, 10) || 0, 0),
    });
  };

  const updateChartMeta = ({ productName, expectedReturn, years, investedAmount, finalAmount }) => {
    if (selectedProductLabel && productName) {
      selectedProductLabel.textContent = productName;
    }

    if (selectedReturnLabel) {
      selectedReturnLabel.textContent = Number.isFinite(expectedReturn) ? formatPercent(expectedReturn) : '–';
    }

    if (selectedYearsLabel) {
      selectedYearsLabel.textContent = years ? `${years} Jahre` : '–';
    }

    if (investedWealthBadge) {
      investedWealthBadge.textContent =
        typeof investedAmount === 'number'
          ? `Investiertes Vermögen: ${currencyFormatter.format(investedAmount)}`
          : 'Investiertes Vermögen: –';
    }

    if (finalWealthBadge) {
      finalWealthBadge.textContent =
        typeof finalAmount === 'number'
          ? `Endvermögen: ${currencyFormatter.format(finalAmount)}`
          : 'Endvermögen: –';
    }

    if (chartNote && Number.isFinite(expectedReturn)) {
      chartNote.textContent =
        'Die Berechnung nimmt an, dass Ihr verfügbarer Betrag im ersten Jahr gemeinsam mit Ihrer Sparrate investiert wird und das gesamte Vermögen jedes Jahr um ' +
        formatPercent(expectedReturn) +
        ' wächst.';
    }
  };

  const drawLineChart = (points = []) => {
    if (!chartCanvas) return;

    if (!points.length) {
      if (chartEmptyState) {
        chartEmptyState.hidden = false;
      }
      if (wealthChart) {
        wealthChart.data.labels = [];
        wealthChart.data.datasets[0].data = [];
        wealthChart.update();
      }
      return;
    }

    if (chartEmptyState) {
      chartEmptyState.hidden = true;
    }

    const currentYear = new Date().getFullYear();
    const labels = points.map((point) => `${currentYear + point.year}`);
    const data = points.map((point) => Number(point.value));

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
                label: (context) => `Vermögen: ${currencyFormatter.format(context.parsed.y)}`,
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
  };

  const parseNumberInput = (input) => {
    if (!input) return 0;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : 0;
  };

  const hasFilledRequiredInputs = () =>
    Boolean(availableWealthInput?.value?.trim()) && Boolean(yearlySavingsInput?.value?.trim());

  let autoRunTimeout;

  const scheduleSimulation = () => {
    if (!hasFilledRequiredInputs()) {
      drawLineChart([]);
      const selectedProduct = getSelectedProduct();
      updateChartMeta({
        productName: selectedProduct.name,
        expectedReturn: Number(selectedProduct.return || 0),
        years: Math.max(parseInt(yearsInput?.value, 10) || 0, 0),
      });
      return;
    }

    window.clearTimeout(autoRunTimeout);
    autoRunTimeout = window.setTimeout(runSimulation, 250);
  };

  const runSimulation = () => {
    if (!capitalMarketSelect) return;

    const selectedProduct = getSelectedProduct();
    const expectedReturn = Number(selectedProduct.return || 0);

    const payload = {
      product_index: Number(capitalMarketSelect.value) || 0,
      available_wealth: parseNumberInput(availableWealthInput),
      yearly_savings: parseNumberInput(yearlySavingsInput),
      years: Math.max(parseInt(yearsInput?.value, 10) || 0, 1),
    };

    fetch('/api/capitalmarket/simulation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((response) => response.json())
      .then((data) => {
        const points = Array.isArray(data.timeseries) ? data.timeseries : [];
        const lastPoint = points[points.length - 1];
        const investedAmount = payload.available_wealth + payload.yearly_savings * payload.years;

        drawLineChart(points);
        updateChartMeta({
          productName: selectedProduct.name,
          expectedReturn,
          years: payload.years,
          investedAmount,
          finalAmount: lastPoint ? lastPoint.value : null,
        });
      })
      .catch((error) => {
        console.error('Simulation fehlgeschlagen:', error);
        drawLineChart([]);
      });
  };

  if (
    capitalMarketSelect &&
    nameTarget &&
    isinTarget &&
    growthTarget &&
    Array.isArray(capitalMarketData) &&
    capitalMarketData.length > 0
  ) {
    capitalMarketSelect.addEventListener('change', (event) => {
      const index = Number(event.target.value) || 0;
      updateCapitalMarketDetails(index);
      scheduleSimulation();
    });

    capitalMarketSelect.value = '0';
    updateCapitalMarketDetails(0);
  }

  if (simulateButton) {
    simulateButton.addEventListener('click', runSimulation);
  }

  if (availableWealthInput) {
    availableWealthInput.addEventListener('input', scheduleSimulation);
  }

  if (yearlySavingsInput) {
    yearlySavingsInput.addEventListener('input', scheduleSimulation);
  }

  if (yearsInput) {
    yearsInput.addEventListener('input', scheduleSimulation);
  }

  updateChartMeta({
    productName: capitalMarketData?.[0]?.name,
    expectedReturn: Number(capitalMarketData?.[0]?.return || 0),
    years: Math.max(parseInt(yearsInput?.value, 10) || 0, 0),
  });
  drawLineChart([]);
});
