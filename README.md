# EventPass

Sistema web para organizar eventos, inscrições, controle de presença e gamificação de participantes.

Organizadores publicam eventos, acompanham inscrições, validam presença por QR Code e exportam relatórios. Participantes se inscrevem em páginas públicas, recebem um ingresso com QR Code e acumulam pontos **somente após um check-in válido**.

## Funcionalidades

**Organizadores (`/admin`)**
- Login com sessão segura e limite de tentativas
- Visão geral com totais de eventos, inscrições, check-ins e pontos
- Criação e edição de eventos (rascunho → publicado → encerrado), com link público para compartilhar
- Lista de inscrições com busca e cancelamento (libera a vaga)
- Check-in pela câmera do celular ou pelo código do ingresso, com aviso de leitura repetida
- Relatório por evento: ocupação, taxa de presença, pontos e check-ins por hora
- Exportação de inscrições em CSV (abre direto no Excel em português)

**Participantes**
- Lista de eventos abertos e ranking de participação (nomes abreviados)
- Inscrição com controle de vagas e bloqueio de duplicidade
- Ingresso com QR Code em `/ingresso/<código>`

**Interface**
- Modo claro, escuro ou do sistema
- Navegação por teclado, rótulos e mensagens para leitores de tela
- Layout responsivo, pensado para uso do check-in no celular

## Desenvolvimento local

Requisitos: **Node.js 22.13 ou superior** (veja `.nvmrc`) e npm 10.

```bash
npm install
cp .env.example .env   # opcional; os valores padrão funcionam localmente
npm run admin:create   # cria o primeiro administrador (pede e-mail, nome e senha)
npm run db:seed        # opcional: eventos e participantes fictícios para testar
npm run dev            # API em http://127.0.0.1:3333 e web em http://localhost:5173
```

Abra http://localhost:5173 para a área pública e http://localhost:5173/admin para o painel.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | API e web com recarga automática |
| `npm run build` | Compila shared, API e web |
| `npm start` | Roda a versão compilada: API servindo o frontend na porta `API_PORT` |
| `npm test` | Testes da API e do frontend (Vitest) |
| `npm run typecheck` | Verifica tipos em todos os pacotes |
| `npm run lint` | ESLint com regras de acessibilidade (jsx-a11y) |
| `npm run format` | Formata o código com Prettier |
| `npm run admin:create` | Cria um administrador ou redefine a senha (encerra as sessões dele) |
| `npm run db:migrate` | Aplica migrações pendentes (também rodam ao iniciar a API) |
| `npm run db:seed` | Dados fictícios de demonstração (bloqueado em produção) |

O CI no GitHub Actions roda typecheck, lint, testes e build em cada pull request.

## Produção

```bash
npm install
npm run build
npm run admin:create
API_HOST=0.0.0.0 COOKIE_SECURE=true npm start
```

Em produção a API serve o frontend compilado (`apps/web/dist`), então tudo roda em um único processo. Coloque um proxy com HTTPS na frente (Nginx, Caddy ou o da sua hospedagem). Isso funciona em qualquer servidor Node, inclusive no Replit.

- **HTTPS é obrigatório** para o cookie de sessão (`COOKIE_SECURE=true`) e para a câmera no check-in, que os navegadores só liberam em conexão segura.
- Faça **backup** do arquivo do banco (`DATABASE_URL`). Com o modo WAL, copie também os arquivos `-wal` e `-shm`, ou use `sqlite3 eventpass.db ".backup copia.db"`.
- Para criar o administrador sem interação, defina `ADMIN_EMAIL`, `ADMIN_NAME` e `ADMIN_PASSWORD` antes de `npm run admin:create`.

### Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `API_PORT` | `3333` | Porta HTTP |
| `API_HOST` | `127.0.0.1` | Interface de rede (`0.0.0.0` para expor) |
| `WEB_ORIGIN` | `http://localhost:5173` | Origem aceita pelo CORS em desenvolvimento |
| `DATABASE_URL` | `./data/eventpass.db` | Arquivo SQLite (relativo a `apps/api`) |
| `SESSION_TTL_HOURS` | `12` | Duração da sessão administrativa |
| `COOKIE_SECURE` | `true` em produção | Cookie só por HTTPS |
| `WEB_DIST` | vazio (`../web/dist` no `npm start`) | Frontend compilado servido pela API |

## Arquitetura

```
apps/
  api/                 Fastify + TypeScript
    migrations/        SQL versionado (001_initial.sql…)
    src/routes/        auth, admin-events, admin-attendance, public
    src/auth/          senhas (scrypt), sessões, guarda de rotas
    src/lib/           CSV, slug, ingressos/QR, consultas de eventos
  web/                 React + TypeScript + Vite + Tailwind CSS v4
    src/admin/         painel do organizador
    src/public/        páginas públicas
    src/components/ui  design system
packages/
  shared/              Schemas Zod e tipos usados pela API e pelo frontend
```

- **Validação compartilhada:** os mesmos schemas Zod validam o formulário no navegador e a requisição no servidor. O servidor nunca confia no cliente.
- **Banco:** SQLite pelo módulo nativo `node:sqlite`, sem compilação nativa. As regras de negócio críticas também são constraints do banco:
  - `UNIQUE(event_id, participant_id)` impede inscrição duplicada;
  - um check-in por inscrição;
  - um lançamento de pontos por check-in.
- **Concorrência:** inscrição e check-in rodam em `BEGIN IMMEDIATE`. A contagem de vagas e a inserção acontecem sem corrida entre requisições simultâneas, e há teste cobrindo isso.
- **Roteamento:** um roteador mínimo sobre a History API, porque o app tem poucas rotas.

### API

Todas as rotas `/api/admin/*` exigem sessão de administrador.

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Login (10 tentativas / 15 min por IP) |
| `POST` | `/api/auth/logout` | Encerra a sessão |
| `GET` | `/api/auth/me` | Administrador logado |
| `GET` | `/api/admin/dashboard` | Totais e próximos eventos |
| `GET`, `POST` | `/api/admin/events` | Lista / cria evento |
| `GET`, `PUT`, `DELETE` | `/api/admin/events/:id` | Detalhe / edita / exclui (só rascunho sem inscrições) |
| `POST` | `/api/admin/events/:id/status` | `draft`, `published` ou `closed` |
| `GET` | `/api/admin/events/:id/registrations` | Inscrições com presença e pontos |
| `POST` | `/api/admin/events/:id/registrations/:rid/cancel` | Cancela (só antes do check-in) |
| `POST` | `/api/admin/events/:id/checkins` | Check-in por token do QR (idempotente) |
| `GET` | `/api/admin/events/:id/report` | Indicadores do evento |
| `GET` | `/api/admin/events/:id/registrations.csv` | Exportação CSV |
| `GET` | `/api/public/events` | Eventos publicados e futuros |
| `GET` | `/api/public/events/:slug` | Evento público |
| `POST` | `/api/public/events/:slug/registrations` | Inscrição (20 / 10 min por IP) |
| `GET` | `/api/public/tickets/:token` | Ingresso com QR Code (SVG) |
| `GET` | `/api/public/leaderboard` | Top 10 por pontos |

### Regras de pontuação

- Cada evento define quantos pontos a presença vale (0 a 1000).
- Os pontos são lançados **no momento do check-in**, no valor vigente do evento, e ficam ligados àquele check-in.
- Ler o mesmo QR Code de novo não gera pontos e mostra o horário do primeiro check-in.
- Inscrições canceladas não fazem check-in. Inscrições com check-in não podem ser canceladas.
- O ranking soma os pontos de todos os eventos. Em caso de empate, fica à frente quem pontuou primeiro.

## Etapas do projeto

- [x] Repositório privado, commit inicial e arquivos básicos de documentação
- [x] Estrutura da aplicação e design system, com modo claro e escuro
- [x] Banco de dados e autenticação administrativa
- [x] Dashboard e gestão de eventos
- [x] Inscrições públicas com controle de vagas e duplicidade
- [x] Check-in por QR Code e pontuação após presença confirmada
- [x] Relatórios com exportação CSV
- [x] Testes dos fluxos essenciais, documentação e auditoria final

## Limitações conhecidas

- **Leitura pela câmera:** usa a API nativa `BarcodeDetector`, disponível no Chrome, no Edge e no Android. No Safari e no Firefox, o check-in é feito digitando ou colando o código do ingresso.
- **E-mail:** o sistema não envia e-mail. O participante precisa guardar o link do ingresso exibido após a inscrição.
- **Banco:** o SQLite atende bem eventos de pequeno e médio porte em um único servidor. Para várias instâncias da API, migre para PostgreSQL.

## Segurança

Veja [docs/SEGURANCA.md](docs/SEGURANCA.md) para as medidas adotadas e a auditoria.

- Nunca inclua senhas, tokens, dados pessoais ou arquivos `.env` no Git.
- Use `.env.example` apenas para documentar nomes de variáveis.
- Use dados fictícios em demonstrações e testes (`npm run db:seed`).
