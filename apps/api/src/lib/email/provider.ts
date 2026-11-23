/** Contrato para provedores de e-mail. Não há integração de rede nesta etapa. */
export type EmailKind = 'registration_confirmation' | 'ticket_recovery';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage, idempotencyKey: string): Promise<void>;
}

/** Usado exclusivamente em testes/homologação isolada. Nunca envia mensagens reais. */
export class MemoryEmailProvider implements EmailProvider {
  readonly deliveries: Array<{ message: EmailMessage; idempotencyKey: string }> = [];

  async send(message: EmailMessage, idempotencyKey: string): Promise<void> {
    this.deliveries.push({ message, idempotencyKey });
  }
}

/** Fail closed: impede envio acidental quando nenhum provedor foi configurado. */
export class DisabledEmailProvider implements EmailProvider {
  async send(): Promise<void> {
    throw new Error('Email delivery is disabled');
  }
}
