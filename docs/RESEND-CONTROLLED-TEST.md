# Resend: preparação de teste controlado

Estado em 23/nov/2026: nenhum envio real realizado. Acesso à conta ainda não verificado; login GitHub apresentou nova concessão OAuth de leitura de e-mail, não aprovada. Não foram criados conta, domínio ou chave.

## Alternativa gratuita sem domínio

A documentação permite onboarding@resend.dev para teste restrito ao endereço proprietário da conta. A titularidade e o endereço precisam ser confirmados, assim como autorização para conteúdo e horário. Isso não habilita envios a participantes.

Endereços delivered@resend.dev, bounced@resend.dev e complained@resend.dev simulam eventos. Não equivalem a entrega numa caixa real. Testes contam na cota do provedor. Os endereços .test usados na suíte local são exclusivamente para transporte simulado e não devem ser enviados ao Resend.

Para uso real com outros destinatários, é necessário domínio sob controle do responsável, SPF/DKIM verificados e remetente nesse domínio. Resend não exige cadastrar uma caixa de remetente separada após verificação do domínio. Não comprar domínio como parte desta tarefa.

## Sequência depois de acesso e autorização

1. Conferir conta/equipe, domínio, DNS, plano e escopo da chave. Secret somente por cofre; não em comandos literais, Git ou relatório.
2. Manter a aplicação e o scheduler reais desabilitados. Executar apenas fixture isolada com o destinatário controlado que foi autorizado.
3. Aprovar o assunto e o template existente com nomes/evento fictícios e link de teste. Não incluir PII, tokens ou URLs de ingresso reais.
4. Enviar uma vez com chave idempotente estável. Repetir somente o mesmo conteúdo/chave para ensaio de idempotência.
5. Registrar ID de mensagem e horários sem corpo, token ou chave. Distinguir aceitação HTTP de evento delivered no provedor. Delivered indica aceite pelo servidor destinatário, não leitura, pasta principal ou garantia contra spam.
6. Conferir chegada na caixa controlada quando houver acesso autorizado. Testar bounce/complaint apenas com os endereços simulados oficiais e dentro da cota.
7. Não criar webhooks/DNS nem ativar scheduler de produção sem escopo autorizado. A implementação atual não ingere bounces/complaints nem consulta estado final no provedor. Operação de volume precisa reconciliar falhas e supressões antes de reativar destinatários.

## Limites e risco de duplicidade

Free consultado: 3.000/mês,100/dia. Cron de5min e1job tem teto teórico288 tentativas/dia, superior à cota diária. Falhas e retries também usam capacidade; não considerar isso controle automático de cota. Não ativar até medir volume e confirmar margem diária/mensal da conta inteira, incluindo outras aplicações e caminhos manuais. O código não tem contador transacional de cota da conta. Reduzir a frequência sozinho não protege a conta e pode invalidar recuperação de15min antes do envio. A conta e o volume são dependências ainda abertas, não capacidade aprovada. Chaves idempotentes duram24h. A outbox é at-least-once, não exatamente uma vez após falha de rede, pausa longa ou restauração de snapshot.

## Fontes oficiais consultadas

- https://resend.com/pricing
- https://resend.com/docs/api-reference/errors
- https://resend.com/docs/dashboard/emails/send-test-emails
- https://resend.com/docs/dashboard/emails/idempotency-keys
- https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend
