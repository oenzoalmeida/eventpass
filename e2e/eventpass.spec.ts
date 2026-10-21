import { test, expect } from '@playwright/test';
test('admin creates event; visitor registers; QR check-in, ranking, report and CSV work', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/admin');
  await page.getByLabel('E-mail').fill('admin@exemplo.test');
  await page.getByLabel('Senha').fill('senha-de-teste-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible();
  await page.goto('/admin/eventos/novo');
  const title = 'E2E ' + Date.now();
  await page.getByLabel('Título').fill(title);
  await page.getByLabel('Local').fill('Auditório de homologação');
  await page.getByLabel('Início').fill('2026-12-10T10:00');
  await page.getByLabel('Término').fill('2026-12-10T12:00');
  await page.getByLabel('Vagas').fill('3');
  await page.getByLabel('Pontos por presença').fill('15');
  await page.getByRole('button', { name: 'Criar rascunho', exact: true }).click();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  const publicLink = page.locator('a[target="_blank"]').first();
  await expect(publicLink).toBeVisible();
  const href = (await publicLink.getAttribute('href'))!;
  const adminUrl = page.url();
  const visitorContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3334',
    viewport: page.viewportSize()!,
  });
  const visitor = await visitorContext.newPage();
  await visitor.goto(href);
  await visitor.getByLabel('Nome completo').fill('Pessoa E2E');
  await visitor.getByLabel('E-mail').fill('visitor' + Date.now() + '@exemplo.test');
  await visitor.getByRole('button', { name: 'Confirmar inscrição' }).click();
  await expect(visitor).toHaveURL(/ingresso/);
  await expect(visitor.locator('svg').first()).toBeVisible();
  const ticket = visitor.url();
  await page.goto(adminUrl);
  await page.getByRole('tab', { name: 'Check-in', exact: true }).click();
  await page.getByLabel('Código ou link do ingresso').fill(ticket);
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByText('Presença confirmada: Pessoa E2E')).toBeVisible();
  await page.getByLabel('Código ou link do ingresso').fill(ticket);
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByText('Pessoa E2E já fez check-in')).toBeVisible();
  await page.getByRole('tab', { name: 'Relatório', exact: true }).click();
  await expect(page.getByText('15', { exact: true }).first()).toBeVisible();
  const eventId = adminUrl.split('/').pop();
  const csv = await page.request.get('/api/admin/events/' + eventId + '/registrations.csv');
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain('Pessoa E2E');
  const leaderboard = await visitor.request.get('/api/public/leaderboard');
  expect(
    (await leaderboard.json()).leaderboard.some((r: { points: number }) => r.points === 15),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  await visitorContext.close();
});
