# Acesso mínimo para publicar os commits EventPass

Estado: proposta de intervenção, não executada e não autorizada como nova credencial. Nenhum segredo solicitado aqui. O objetivo é preservar os commits locais exatos, não recriá-los pelo editor web.

O Git local não tem credencial/helper/SSH, gh está deslogado e dry-run falhou antes de escrever. A integração existente está conectada, mas não oferece envio de objetos Git. PATs de outros trabalhos não serão reutilizados.

## Rota preferida, se autorizada

- Credencial fine-grained de curta duração, exclusiva de oenzoalmeida/eventpass.
- Resource owner: oenzoalmeida. Repository access: only selected repository eventpass.
- Contents: Read and write. Workflows: Write, porque esta revisão altera .github/workflows/ci.yml. MetadataRead é implícito. Sem administração, secrets ou outros repositórios.
- Receber somente por cofre com permissão de uso por comando. Não mandar token em chat, não inserir no URL do remote, argumentos, commits ou logs.
- Fazer dry-run com HTTPS e credencial efêmera por canal privado, publicar somente fix/email-homologation-20261123, conferir SHA remoto idêntico, CI sobre esse SHA e ausência de deployment Vercel. Revogar/descartar a credencial ao concluir.
- O arquivo vercel.json da branch desabilita deploy só nela, conforme documentação oficial e schema validado. Não alterar projeto/produção. Outros consumidores Git não devem ser presumidos inofensivos; parar se qualquer efeito de deploy aparecer.
- A regra não torna CI ou isolamento pós-push já concluídos. PR continua proposta até aprovação das palavras, sem merge.

O fluxo gh auth login por navegador também existe, mas pede acesso mais amplo e pode usar arquivo local se não encontrar armazenamento seguro. Não foi iniciado por não ser a opção de menor acesso para este push.

## Fontes

- https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- https://cli.github.com/manual/gh_auth_login
- https://vercel.com/docs/project-configuration/git-configuration
