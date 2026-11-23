import { createElement as h } from 'react';
import { Body, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components';
import { render } from '@react-email/render';
import type { EmailKind, EmailMessage } from './provider.js';

export interface EmailContent {
  participantName: string;
  eventTitle: string;
  link: string;
}

/**
 * React Email templates run server-side and are independent of the EventPass UI system.
 * React handles escaping untrusted participant/event strings on HTML rendering.
 */
export async function renderEmail(kind: EmailKind, payload: EmailContent, recipient: string): Promise<EmailMessage> {
  const link = new URL(payload.link);
  if ((link.protocol !== 'https:' && !(link.protocol === 'http:' && link.hostname === 'localhost')) || link.username || link.password) throw new Error('Unsafe email link');
  const recovery = kind === 'ticket_recovery';
  const subject = recovery ? 'Recupere seu ingresso do EventPass' : 'Inscrição confirmada no EventPass';
  const title = recovery ? 'Recuperação de ingresso' : 'Inscrição confirmada';
  const message = recovery
    ? 'Use o link abaixo para emitir um novo ingresso. Seu QR Code anterior deixará de funcionar. O link expira em 15 minutos.'
    : 'Sua inscrição foi registrada. Guarde seu link pessoal de ingresso e não o compartilhe.';
  const body = h(Html, { lang: 'pt-BR' },
    h(Head, null),
    h(Preview, null, subject),
    h(Body, { style: { backgroundColor: '#f7f7f7', fontFamily: 'Arial, Helvetica, sans-serif', padding: '24px', color: '#222' } },
      h(Container, { style: { backgroundColor: '#fff', border: '1px solid #ddd', padding: '28px', maxWidth: '560px' } },
        h(Heading, { as: 'h1', style: { fontSize: '24px' } }, title),
        h(Text, null, 'Olá, ', payload.participantName, '.'),
        h(Text, null, message),
        h(Text, null, 'Evento: ', payload.eventTitle),
        h(Link, { href: link.toString(), style: { display: 'inline-block', padding: '12px 20px', backgroundColor: '#171717', color: '#fff' } }, recovery ? 'Recuperar ingresso' : 'Abrir ingresso'),
        h(Text, { style: { fontSize: '12px', wordBreak: 'break-all' } }, link.toString()),
        h(Text, { style: { fontSize: '12px' } }, 'Se não solicitou esta mensagem, desconsidere-a.'),
      ),
    ),
  );
  const [html, text] = await Promise.all([render(body), render(body, { plainText: true })]);
  return { to: recipient, subject, html, text };
}
