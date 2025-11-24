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
});
