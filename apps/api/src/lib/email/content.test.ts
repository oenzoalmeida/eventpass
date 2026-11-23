import { describe, expect, it } from 'vitest';
import { renderEmail } from './content.js';

describe('React Email templates', () => {
  it('escapes participant content and renders HTML/text confirmation', async () => {
    const message = await renderEmail('registration_confirmation', {
      participantName: '<script>alert(1)</script>',
      eventTitle: 'Evento & Teste',
      link: 'https://eventpass.example/ingresso/xyz',
    }, 'participante@exemplo.test');
    expect(message.html).toContain('&lt;script&gt;');
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('Evento &amp; Teste');
    expect(message.text).toContain('Evento & Teste');
  });
  it('warns recovery replaces the former ticket', async () => {
    const message = await renderEmail('ticket_recovery', {
      participantName: 'Ana', eventTitle: 'Congresso',
      link: 'https://eventpass.example/recuperar-ingresso/xyz',
    }, 'ana@exemplo.test');
    expect(message.text).toContain('anterior deixará de funcionar');
    expect(message.html).toContain('Recuperar ingresso');
  });
  it.each(['ftp://localhost/token', 'javascript://localhost/token', 'https://user:secret@eventpass.example/token'])('rejects unsafe link %s', async (link) => {
    await expect(renderEmail('ticket_recovery', { participantName: 'Ana', eventTitle: 'Evento', link }, 'ana@exemplo.test')).rejects.toThrow('Unsafe email link');
  });
  it('rejects unsafe external links', async () => {
    await expect(renderEmail('ticket_recovery', {
      participantName: 'Ana', eventTitle: 'Evento',
      link: 'http://untrusted.example/token',
    }, 'ana@exemplo.test')).rejects.toThrow();
  });
});
