// Aplica o tema antes da renderização para evitar flash de cor.
// Arquivo externo (e não inline) para funcionar com a Content-Security-Policy da API.
// PROPOSTA A: modo escuro é o padrão da identidade "Modo Festival".
(function () {
  try {
    var t = localStorage.getItem('eventpass-theme');
    document.documentElement.classList.toggle('dark', t !== 'light');
  } catch {
    document.documentElement.classList.add('dark');
  }
})();
