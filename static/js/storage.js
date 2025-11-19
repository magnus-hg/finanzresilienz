(function () {
  const STORAGE_KEY = 'finanzresilienzUserData';

  function readStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch (error) {
      console.warn('Konnte gespeicherte Daten nicht lesen:', error);
      return {};
    }
  }

  function writeStorage(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  window.userDataStore = {
    load() {
      return readStorage();
    },
    save(updates) {
      const current = readStorage();
      const next = { ...current, ...updates };
      writeStorage(next);
      return next;
    },
    clear() {
      localStorage.removeItem(STORAGE_KEY);
    },
  };
})();
