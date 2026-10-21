# EventPass

Sistema web para organizar eventos, inscrições, controle de presença e gamificação de participantes.

> **Status:** início do projeto. Este repositório contém a base de versionamento e documentação; as funcionalidades serão implementadas por etapas. Não há dados reais de participantes ou credenciais neste repositório.

## Objetivo

Dar a organizadores um fluxo único para publicar eventos, acompanhar inscrições, validar presença por QR Code e consultar relatórios. Participantes poderão se inscrever em páginas públicas e acumular pontos somente após um check-in válido.

## Direção técnica

- React com TypeScript e componentes acessíveis
- Tailwind CSS para o sistema visual responsivo
- Backend Node.js com validação no servidor
- SQLite no desenvolvimento local, com migrações reproduzíveis
- Arquitetura modular e configuração documentada para execução fora do Replit

As decisões de implementação serão registradas junto ao código à medida que cada etapa for concluída.

## Etapas do projeto

- [x] Repositório privado, commit inicial e arquivos básicos de documentação
- [ ] Estrutura da aplicação e design system, com modo claro e escuro
- [ ] Banco de dados e autenticação administrativa
- [ ] Dashboard e gestão de eventos
- [ ] Inscrições públicas com controle de vagas e duplicidade
- [ ] Check-in por QR Code e pontuação após presença confirmada
- [ ] Relatórios com exportação CSV
- [ ] Testes dos fluxos essenciais, documentação e auditoria final

## Desenvolvimento local

Requisitos: Node.js 20 ou superior (veja `.nvmrc`) e npm 10.

```bash
npm install
cp .env.example .env   # opcional; os valores padrão funcionam localmente
npm run dev            # API em http://127.0.0.1:3333 e web em http://localhost:5173
```

Outros scripts na raiz:

| Comando | O que faz |
| --- | --- |
| `npm run build` | Compila shared, API e web |
| `npm run typecheck` | Verifica tipos em todos os pacotes |
| `npm test` | Roda os testes (Vitest) |
| `npm run lint` | ESLint com regras de acessibilidade (jsx-a11y) |
| `npm run format` | Formata o código com Prettier |

### Estrutura

```
apps/
  api/        Fastify + TypeScript (validação com Zod, helmet, CORS)
  web/        React + TypeScript + Vite + Tailwind CSS v4
packages/
  shared/     Schemas Zod e tipos compartilhados entre API e web
```

### Design system

Os componentes usam tokens semânticos (`bg-surface`, `text-fg`, `bg-primary`…) definidos em
`apps/web/src/index.css`, com valores próprios para os modos claro e escuro. O tema segue o
sistema por padrão e pode ser fixado pelo seletor no cabeçalho. Componentes base ficam em
`apps/web/src/components/ui`: `Button`, `Input`, `Card`, `Badge` e `ThemeToggle`.

## Segurança

- Nunca inclua senhas, tokens, dados pessoais ou arquivos .env no Git.
- Use .env.example apenas para documentar nomes de variáveis, sem valores secretos.
- Use dados fictícios em demonstrações e testes.
- Valide permissões no backend e imponha integridade no banco para impedir duplicidades concorrentes.

Consulte o [.gitignore](.gitignore) para os arquivos locais e bancos de desenvolvimento excluídos do versionamento.
