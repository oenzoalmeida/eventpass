/**
 * Trava padrão da suíte E2E: só aceita alvo em loopback (localhost, 127.0.0.1,
 * [::1]) sobre http/https, sem credenciais embutidas na URL. Não há variável de
 * ambiente nem flag que libere host remoto: a suíte cria eventos e inscrições.
 * Alvo remoto controlado exige mudança de código revisada, nunca configuração.
 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export function assertLocalTarget(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('BASE_URL inválida: a suíte E2E só roda contra alvo local.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !LOOPBACK.has(url.hostname)) {
    throw new Error(
      `Alvo recusado (${url.hostname || 'desconhecido'}): a suíte E2E só roda contra localhost, 127.0.0.1 ou [::1].`,
    );
  }
  return url.origin;
}
