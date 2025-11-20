(function () {
  const form = document.getElementById('tax-form');
  const zveInput = document.getElementById('zve');
  const taxAmountEl = document.getElementById('tax-amount');
  const avgRateEl = document.getElementById('avg-rate');
  const marginalRateEl = document.getElementById('marginal-rate');

  const currencyFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  });

  function formatPercentage(value) {
    return `${value.toFixed(2)} %`;
  }

  function populateFromStorage() {
    const stored = window.userDataStore?.load?.() || {};
    if (stored.zve !== undefined) {
      zveInput.value = stored.zve;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const zve = parseFloat(zveInput.value);
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
        body: JSON.stringify({ zve }),
      });

      if (!response.ok) {
        throw new Error('Fehler bei der Berechnung.');
      }

      const data = await response.json();
      taxAmountEl.textContent = currencyFormatter.format(data.est);
      avgRateEl.textContent = formatPercentage(data.avg_rate);
      marginalRateEl.textContent = formatPercentage(data.marginal_rate);

      window.userDataStore?.save?.({ zve });
    } catch (error) {
      console.error(error);
      alert('Die Steuerberechnung ist fehlgeschlagen. Bitte erneut versuchen.');
    }
  }

  populateFromStorage();
  form.addEventListener('submit', handleSubmit);
})();
