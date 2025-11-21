(function () {
  const form = document.getElementById('tax-form');
  const filingStatusInput = document.getElementById('filing-status');
  const zveInput = document.getElementById('zve');
  const zveLabel = document.getElementById('zve-label');
  const incomeHint = document.getElementById('income-hint');
  const taxAmountEl = document.getElementById('tax-amount');
  const avgRateEl = document.getElementById('avg-rate');
  const marginalRateEl = document.getElementById('marginal-rate');
  const chartCanvas = document.getElementById('tax-chart');
  let taxChart;

  const currencyFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  });

  function formatPercentage(value) {
    return `${value.toFixed(2)} %`;
  }

  function buildChart(curve = [], currentZve = 0, avgRate = 0, marginalRate = 0) {
    if (!chartCanvas || typeof Chart === 'undefined') return;

    const avgDataset = curve.map((point) => ({ x: point.zve, y: point.avg_rate }));
    const marginalDataset = curve.map((point) => ({ x: point.zve, y: point.marginal_rate }));

    const userAvgPoint = [{ x: currentZve, y: avgRate }];
    const userMarginalPoint = [{ x: currentZve, y: marginalRate }];

    const data = {
      datasets: [
        {
          label: 'Durchschnittssteuersatz',
          data: avgDataset,
          borderColor: '#2E7CF6',
          backgroundColor: 'rgba(46, 124, 246, 0.08)',
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.2,
        },
        {
          label: 'Grenzsteuersatz',
          data: marginalDataset,
          borderColor: '#FF8C42',
          backgroundColor: 'rgba(255, 140, 66, 0.08)',
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [6, 3],
          tension: 0.2,
        },
        {
          label: 'Ihr Durchschnittssteuersatz',
          data: userAvgPoint,
          borderColor: '#1B4F9C',
          backgroundColor: '#1B4F9C',
          pointRadius: 6,
          pointHoverRadius: 7,
          type: 'scatter',
        },
        {
          label: 'Ihr Grenzsteuersatz',
          data: userMarginalPoint,
          borderColor: '#C55B11',
          backgroundColor: '#C55B11',
          pointRadius: 6,
          pointHoverRadius: 7,
          type: 'scatter',
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label(context) {
              const value = context.parsed.y ?? 0;
              const income = context.parsed.x ?? 0;
              return `${context.dataset.label}: ${formatPercentage(value)} bei ${income.toLocaleString('de-DE')} €`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          title: {
            display: true,
            text: 'Zu versteuerndes Einkommen (EUR)',
          },
          ticks: {
            callback(value) {
              return Number(value).toLocaleString('de-DE');
            },
          },
        },
        y: {
          title: {
            display: true,
            text: 'Steuersatz (%)',
          },
          suggestedMin: 0,
          suggestedMax: 50,
          ticks: {
            callback(value) {
              return `${value} %`;
            },
          },
        },
      },
    };

    if (taxChart) {
      taxChart.data = data;
      taxChart.options = options;
      taxChart.update();
      return;
    }

    taxChart = new Chart(chartCanvas, {
      type: 'line',
      data,
      options,
    });
  }

  function populateFromStorage() {
    const stored = window.userDataStore?.load?.() || {};
    if (stored.zve !== undefined) {
      zveInput.value = stored.zve;
    }
    if (stored.filing_status) {
      filingStatusInput.value = stored.filing_status;
    }
    updateIncomeCopy();
  }

  function updateIncomeCopy() {
    const isMarried = filingStatusInput.value === 'married';
    zveLabel.textContent = isMarried
      ? 'Gemeinsames zu versteuerndes Einkommen (zvE) in EUR'
      : 'Zu versteuerndes Einkommen (zvE) in EUR';
    incomeHint.textContent = isMarried
      ? 'Geben Sie Ihr gemeinsames zvE (Summe beider Partner:innen) ein.'
      : 'Geben Sie Ihr persönliches zvE ein.';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const zve = parseFloat(zveInput.value);
    const filingStatus = filingStatusInput.value || 'single';
    if (Number.isNaN(zve) || zve < 0) {
      alert('Bitte ein gültiges zu versteuerndes Einkommen eingeben.');
      return;
    }

    try {
      const response = await fetch('/api/tax', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ zve, filing_status: filingStatus, partner_zve: 0 }),
      });

      if (!response.ok) {
        throw new Error('Fehler bei der Berechnung.');
      }

      const data = await response.json();
      taxAmountEl.textContent = currencyFormatter.format(data.est);
      avgRateEl.textContent = formatPercentage(data.avg_rate);
      marginalRateEl.textContent = formatPercentage(data.marginal_rate);

      buildChart(data.curve, data.zve, data.avg_rate, data.marginal_rate);
      window.userDataStore?.save?.({
        zve,
        filing_status: filingStatus,
      });
    } catch (error) {
      console.error(error);
      alert('Die Steuerberechnung ist fehlgeschlagen. Bitte erneut versuchen.');
    }
  }

  populateFromStorage();
  filingStatusInput.addEventListener('change', updateIncomeCopy);
  form.addEventListener('submit', handleSubmit);
})();
