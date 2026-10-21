// Aplica o tema antes da renderização para evitar flash de cor.
// Arquivo externo (e não inline) para funcionar com a Content-Security-Policy da API.
(function () {
  try {
    var t = localStorage.getItem('eventpass-theme');
    var dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {
    /* armazenamento indisponível */
  }
})();
