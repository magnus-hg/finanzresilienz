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

  const updateCapitalMarketDetails = (index) => {
    const entry = capitalMarketData[index];
    if (!entry) return;

    nameTarget.textContent = entry.name || '-';
    isinTarget.textContent = entry.isin || '-';
    growthTarget.textContent = entry.return || '-';
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
    });

    capitalMarketSelect.value = '0';
    updateCapitalMarketDetails(0);
  }
});
