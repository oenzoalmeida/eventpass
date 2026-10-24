# Hospedagem

Avaliação de opções para publicar o EventPass (Fastify + React compilado + SQLite em arquivo, processo Node único). Requisitos: **processo Node longa duração** (sessões, rate limit em memória, câmera exige HTTPS) e **disco persistente** para o SQLite. Nada foi contratado; esta página é apenas uma recomendação.

## Resumo

| Opção                              | Custo                                | Disco persistente | Veredito                                        |
| ---------------------------------- | ------------------------------------ | ----------------- | ----------------------------------------------- |
| Oracle Cloud Always Free (VPS ARM) | Gratuito permanente                  | Sim               | **Recomendada**                                 |
| Fly.io                             | Pago por uso (sem plano grátis novo) | Sim (volumes)     | Boa opção paga, simples                         |
| Koyeb (instância free)             | Gratuito                             | **Não** (efêmero) | Inviável com SQLite                             |
| Railway                            | Crédito de teste, depois pago        | Sim               | Só para experimentar                            |
| Replit                             | Deploy sempre vivo é pago            | Sim               | Impraticável grátis                             |
| Vercel / Netlify                   | Gratuito                             | Não (serverless)  | Incompatível (sem disco, sem processo contínuo) |
| Render                             | —                                    | —                 | Excluído a pedido                               |

## Recomendada: Oracle Cloud Always Free

Única opção realmente gratuita e permanente com disco persistente: uma VM ARM (até 4 vCPU/24 GB no nível always free), IP público e HTTPS com o Caddy.

Passos resumidos (exige conta com cartão de validação, sem cobrança no nível free):

1. Crie uma VM Ubuntu (shape `A1.Flex`, imagem mínima) e abra as portas 80/443 no security list.
2. Instale Node 22+ e o Caddy (`apt install caddy`); aponte o domínio para o IP da VM.
3. `git clone`, `npm install`, `npm run build`, `npm run admin:create`.
4. Rode com `API_HOST=127.0.0.1 COOKIE_SECURE=true npm start` sob um gerenciador (systemd).
5. Caddy faz o HTTPS na frente: `reverse_proxy 127.0.0.1:3333`. A API só escuta localmente — `trustProxy` fica seguro porque nenhum cliente a alcança direto.
6. Agende no cron: `0 3 * * * cd /opt/eventpass && npm run db:backup` e copie os backups para fora da VM (o backup não protege se a VM inteira for perdida).

Custo zero, mas você administra o servidor (atualizações do Ubuntu, firewall, backups fora da VM).

## Alternativa paga simples: Fly.io

Um app (`fly launch`), um volume de 1 GB montado em `/data`, `DATABASE_URL=/data/eventpass.db`, HTTPS automático. Custo pequeno por mês; resolve backup com `fly volumes snapshot` e o `npm run db:backup` via `fly ssh console`.

## Por que as demais não servem

- **Koyeb free / qualquer container efêmero:** o arquivo do SQLite é apagado em cada deploy/reinício. Só serviria migrando o banco para Postgres (o README já aponta esse caminho para múltiplas instâncias).
- **Vercel/Netlify (serverless):** sem disco persistente e sem processo contínuo — sessões em memória, `setInterval` de limpeza e rate limit não funcionam.
- **Replit/Railway:** o plano grátis não mantém o app sempre disponível (adormece) ou é só crédito de teste.

## Checklist de produção (qualquer opção)

- [ ] `NODE_ENV=production` e `COOKIE_SECURE=true`
- [ ] HTTPS no domínio próprio (câmera de check-in exige contexto seguro)
- [ ] `npm run admin:create` com senha forte; administrador criado **antes** de divulgar
- [ ] `npm run db:backup` diário agendado, com cópia fora do servidor
- [ ] `npm audit` periódico e Dependabot ativado no GitHub
