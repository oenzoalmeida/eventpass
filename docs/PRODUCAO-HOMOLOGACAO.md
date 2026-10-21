# Preparação para produção e homologação

Este roteiro deve ser executado antes de liberar o EventPass para participantes reais. A aprovação do CI comprova os testes automatizados, não a operação em produção.

## 1. Infraestrutura

- [ ] Escolher hospedagem com processo Node.js 22.13+ e **volume persistente** para SQLite. Não usar disco efêmero, inclusive em plataformas que reiniciam ou recriam containers.
- [ ] Definir domínio e proxy HTTPS. A API deve ser acessível **somente pelo proxy confiável**.
- [ ] Configurar `NODE_ENV=production`, `COOKIE_SECURE=true`, `API_HOST`, `API_PORT`, `WEB_ORIGIN` e `DATABASE_URL` para o ambiente.
- [ ] Não enviar `.env`, senhas, cookies ou banco para o repositório. Usar segredos da plataforma.
- [ ] Verificar se o processo reinicia automaticamente após falha e se o volume sobrevive a reinicializações e novas versões.
- [ ] Usar uma única instância da API com SQLite; múltiplas instâncias requerem revisão da arquitetura de dados e do rate limit.

## 2. Preparação do sistema

- [ ] Instalar dependências e executar `npm run build` com a versão exigida do Node.
- [ ] Executar migrações no banco persistente e registrar versão/resultado.
- [ ] Criar o administrador com credenciais fortes, sem deixar a senha em histórico de terminal ou logs.
- [ ] Confirmar que o seed fictício **não** foi executado em produção.
- [ ] Confirmar que login, logout e cookies funcionam sob HTTPS.
- [ ] Confirmar que o endpoint de saúde e as rotas públicas respondem sem expor detalhes internos.
- [ ] Verificar logs, alertas básicos e espaço livre do volume.

## 3. Backup e restauração do SQLite

**Não copiar somente o arquivo `.db` enquanto o banco estiver aberto em modo WAL.** O banco pode ter transações ainda no arquivo `-wal`. Para backup online consistente, usar a API de backup do SQLite (por exemplo, `sqlite3 /caminho/eventpass.db ".backup '/backups/eventpass-AAAA-MM-DD-HHMM.db'"`) com uma ferramenta `sqlite3` compatível e disponível no servidor. Executar como usuário autorizado a ler o banco e escrever no destino.

- [ ] Programar backup automático com retenção definida e cópia fora do servidor/volume principal.
- [ ] Proteger o backup por controle de acesso e criptografia apropriada: contém dados de participantes.
- [ ] Verificar que cada backup termina com sucesso e possui tamanho plausível.
- [ ] **Testar restauração em ambiente isolado**, com a API de teste parada: copiar o backup para o caminho de banco do ambiente de teste, executar `PRAGMA integrity_check;` e confirmar retorno `ok`.
- [ ] Iniciar a aplicação de teste sobre o banco restaurado e conferir eventos, inscrições e check-ins de exemplo.
- [ ] Registrar data, responsável, duração e resultado do teste de restauração.
- [ ] Documentar procedimento de recuperação: parar aplicação, preservar banco atual, restaurar backup validado, revisar permissões, reiniciar e verificar integridade.
- [ ] Definir objetivos de perda máxima de dados (RPO) e tempo de recuperação (RTO) antes da estreia.

## 4. Homologação ponta a ponta

Executar em ambiente de homologação com dados fictícios:

- [ ] Administrador entra e sai; usuário não autenticado não acessa rotas administrativas.
- [ ] Criar, editar, publicar e encerrar evento.
- [ ] Compartilhar link público e verificar funcionamento em celular.
- [ ] Inscrever participante, gerar ingresso e guardar link.
- [ ] Recusar e-mail duplicado e inscrição após esgotamento das vagas.
- [ ] Fazer check-in por câmera em navegador compatível e por código manual.
- [ ] Repetir check-in e verificar que a pontuação não aumenta.
- [ ] Recusar QR de outro evento e inscrição cancelada.
- [ ] Conferir ranking, relatórios e exportação CSV.
- [ ] Validar acessibilidade básica, navegação por teclado e visualização em telas pequenas.
- [ ] Confirmar funcionamento após reiniciar a aplicação.
- [ ] Executar e comprovar backup e restauração antes de aceitar dados reais.

## 5. Segurança e decisão de publicação

- [ ] Revisar `docs/SEGURANCA.md`, especialmente `trustProxy`, rate limit em memória, ausência de verificação de e-mail e 2FA.
- [ ] Rodar `npm audit` e analisar alertas antes de publicar; CI atual instala dependências com `--no-audit`.
- [ ] Testar exposição da API: não deve ser acessível diretamente fora do proxy confiável.
- [ ] Definir responsável por operação, resposta a incidentes e exclusão/retenção de dados pessoais.
- [ ] Conferir aviso de privacidade e finalidade do tratamento de dados conforme o uso pretendido.
- [ ] Registrar aprovação da homologação com evidências e pendências aceitas.

**Critério de liberação:** somente publicar para uso real quando infraestrutura, segurança, fluxos essenciais e restauração de backup estiverem verificados. Este documento é um checklist, não um atestado de homologação.
