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

  const updateCapitalMarketDetails = (index) => {
    const entry = capitalMarketData[index];
    if (!entry) return;

    nameTarget.textContent = entry.name || '-';
    isinTarget.textContent = entry.isin || '-';
    const growth = Number(entry.return || 0);
    growthTarget.textContent = Number.isFinite(growth) ? `${(growth * 100).toFixed(1)} % p.a.` : '-';
  };

  const drawLineChart = (points = []) => {
    if (!chartCanvas) return;

    const ctx = chartCanvas.getContext('2d');
    const width = chartCanvas.clientWidth || 640;
    const height = chartCanvas.clientHeight || 320;

    chartCanvas.width = width;
    chartCanvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (!points.length) {
      if (chartEmptyState) {
        chartEmptyState.hidden = false;
      }
      return;
    }

    if (chartEmptyState) {
      chartEmptyState.hidden = true;
    }

    const padding = 48;
    const maxValue = Math.max(...points.map((p) => p.value), 0);
    const minValue = Math.min(...points.map((p) => p.value), 0);
    const valueRange = Math.max(maxValue - minValue, 1);
    const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

    const projectX = (index) => padding + index * xStep;
    const projectY = (value) =>
      height - padding - ((value - minValue) / valueRange) * (height - padding * 2);

    ctx.strokeStyle = '#2f81f7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = projectX(index);
      const y = projectY(point.value);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    ctx.fillStyle = '#2f81f7';
    points.forEach((point, index) => {
      const x = projectX(index);
      const y = projectY(point.value);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = 'rgba(240, 246, 252, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding / 2);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding / 2, height - padding);
    ctx.stroke();

    ctx.fillStyle = '#8b949e';
    ctx.font = '12px Inter, system-ui, sans-serif';
    const maxLabel = `${maxValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;
    const minLabel = `${minValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;
    ctx.fillText(maxLabel, padding, padding / 2 + 8);
    ctx.fillText(minLabel, padding, height - padding + 16);

    const lastPoint = points[points.length - 1];
    ctx.fillStyle = '#f0f6fc';
    ctx.font = '14px Inter, system-ui, sans-serif';
    ctx.fillText(
      `Jahr ${lastPoint.year}: ${lastPoint.value.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`,
      padding,
      padding,
    );
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
      return;
    }

    window.clearTimeout(autoRunTimeout);
    autoRunTimeout = window.setTimeout(runSimulation, 250);
  };

  const runSimulation = () => {
    if (!capitalMarketSelect) return;

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
        drawLineChart(points);
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

  drawLineChart([]);
});
