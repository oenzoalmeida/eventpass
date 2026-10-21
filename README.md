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

Os comandos de instalação, execução e testes serão adicionados quando a estrutura da aplicação e seus scripts forem criados. A meta é permitir execução local sem dependência exclusiva do Replit.

## Segurança

- Nunca inclua senhas, tokens, dados pessoais ou arquivos .env no Git.
- Use .env.example apenas para documentar nomes de variáveis, sem valores secretos.
- Use dados fictícios em demonstrações e testes.
- Valide permissões no backend e imponha integridade no banco para impedir duplicidades concorrentes.

Consulte o [.gitignore](.gitignore) para os arquivos locais e bancos de desenvolvimento excluídos do versionamento.
