# Publicação dos commits EventPass: dois bloqueios independentes

Estado em 23/11/2026: não publicado. Acesso Git e isolamento pré-push são requisitos separados. Obter uma credencial não autoriza nem torna seguro o push.

## 1. Isolamento antes de qualquer publicação

A regra local vercel.json desabilita deploy apenas de fix/email-homologation-20261123. Foi validada contra o schema oficial, mas não prova ausência de outros consumidores. Conferência pós-push será validação adicional, nunca experimento para descobrir gatilhos.

Inspeção somente leitura:

- Vercel: projeto EventPass conectado ao GitHub e previews automáticos observados. Regra de branch preparada, nenhuma configuração sensível alterada.
- GitHub: página de webhooks não mostrou hooks. A lista de Apps inclui Vercel, Render, Northflank, Base44, blitz.cloud e Lovable, entre outros. Ter acesso ao repositório não demonstra que cada App faz deploy, mas também não demonstra ausência de gatilhos.
- Render: dois workspaces visíveis. QueueFlow mostrou um projeto sem serviços ativos; PenteFino mostrou um único serviço ligado a oenzoalmeida/pentefino, não EventPass. Nenhum serviço EventPass foi encontrado nesses inventários. Não alterar esse outro projeto.
- Northflank: login por GitHub chegou a nova autorização de leitura de endereços de email. Não concedida. Inventário de serviços e regras de branch continuam desconhecidos.
- Configuração individual das instalações GitHub pediu reautenticação sudo. Não se verificou o escopo efetivo dos demais Apps nem os projetos/eventos associados a eles.

Conclusão: o isolamento global pré-push NÃO está comprovado. Não publicar para descobrir. A intervenção mínima seguinte é concluir acesso somente leitura às instalações e aos inventários dos consumidores ainda não resolvidos. Se esse acesso exigir nova concessão, obter autorização específica antes dela. A alternativa é o proprietário fornecer evidência verificável de que EventPass não está associado a esses consumidores, ou isolar somente EventPass neles e permitir a conferência. Não remover Apps da conta nem modificar outros projetos ou produção como atalho.

Só depois dessa prova se justifica pedir acesso Git. Não coletar token agora.

## 2. Acesso Git, após resolver o isolamento

Git local sem credencial/helper/SSH utilizável; gh deslogado; push dry-run falhou antes de escrever. A conexão existente não oferece envio dos objetos Git locais. Não recriar commits pelo editor web nem reutilizar credenciais de outro trabalho.

Proposta condicionada, não autorizada nem iniciada:

- Fine-grained PAT de curta duração, exclusivo de oenzoalmeida/eventpass.
- Contents: Read and write; Workflows: Write, pois ci.yml é alterado; Metadata Read implícito. Sem administração, secrets ou outros repositórios.
- Receber apenas por cofre, com autorização de uso por comando. Há suporte para entregar um valor salvo a arquivo privado 0600 sem retornar o conteúdo.
- Helper HTTPS efêmero pode ler esse arquivo diretamente no processo Git, com escopo de host e caminho exatos. Não colocar token em URL, argumentos, logs ou configuração persistente. Não ativar trace. Apagar arquivo/helper ao concluir. Essa rota é suportada, mas ainda não testada com credencial real e não foi iniciada.
- Depois de ambos os bloqueios resolvidos: dry-run, push somente da branch aprovada, SHA remoto idêntico, GitHub Actions nesse SHA e conferência adicional de ausência de deploy. Nenhum merge. PR continua texto proposto até aprovação das palavras.

O login gh pelo navegador não foi iniciado: pode pedir acesso mais amplo que o mínimo desta proposta.

## Fontes inspecionadas

- https://github.com/oenzoalmeida/eventpass/settings/installations?page=1
- https://github.com/oenzoalmeida/eventpass/settings/installations?page=2
- https://github.com/oenzoalmeida/eventpass/settings/hooks
- https://github.com/settings/installations/171173568
- https://github.com/settings/installations/157061511
- https://dashboard.render.com/
- https://dashboard.render.com/web/srv-dai6ltm1egvs73cr5890
- https://app.northflank.com/login
- https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- https://git-scm.com/docs/gitcredentials
- https://vercel.com/docs/project-configuration/git-configuration
