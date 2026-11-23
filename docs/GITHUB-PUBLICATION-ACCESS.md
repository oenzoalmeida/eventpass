# Publicação dos commits EventPass: estado atual e acesso pendente

Estado em 23/11/2026, após inspeção concluída às10:59 e auditoria11:11: não publicado. A inspeção pré-push dos consumidores identificados foi concluída. Acesso Git sensível permanece pendente de aprovação específica. Obter uma credencial não autoriza efeitos além do push seguro da branch.

## 1. Isolamento antes de qualquer publicação

A regra local vercel.json desabilita deploy apenas de fix/email-homologation-20261123. Foi validada contra o schema oficial, mas não prova ausência de outros consumidores. Conferência pós-push será validação adicional, nunca experimento para descobrir gatilhos.

Inspeção somente leitura:

- Vercel: projeto EventPass conectado ao GitHub e previews automáticos observados. Regra de branch preparada, nenhuma configuração sensível alterada.
- GitHub: página de webhooks não mostrou hooks. A lista de Apps inclui Vercel, Render, Northflank, Base44, blitz.cloud e Lovable, entre outros. Ter acesso ao repositório não demonstra que cada App faz deploy, mas também não demonstra ausência de gatilhos.
- Render: dois workspaces visíveis. QueueFlow mostrou um projeto sem serviços ativos; PenteFino mostrou um único serviço ligado a oenzoalmeida/pentefino, não EventPass. Nenhum serviço EventPass foi encontrado nesses inventários. Não alterar esse outro projeto.
- GitHub sudo: reautenticação Mobile aprovada pelo proprietário e aceita na página às10:54. Escopos individuais lidos sem salvar alterações. Northflank, Render, Base44, blitz.cloud e Lovable estão em All repositories; isso demonstra acesso, não um deployment ativo.
- blitz.cloud: inventário completo da única conta visível com dois apps de outros repositórios. Nenhum EventPass; nenhum app aberto ou alterado.
- Base44: único workspace com três apps, nenhum EventPass. Nenhum editor aberto. Pedido de atualização de permissões não aceito.
- Lovable: inventário do workspace pessoal com dois projetos visualmente identificados como Passaporte Área51, não EventPass. Nenhum projeto de terceiro foi aberto.
- Northflank: proprietário autorizou às10:55 somente leitura dos endereços de email para o login GitHub. Tela conferida e concessão limitada a esse escopo. Login confirmado; única equipe visível sem projetos e sem conta GitHub vinculada em Git providers. Não se vinculou provedor nem criou workload.

Conclusão: os consumidores de hosting identificados foram conferidos antes da publicação, sem push experimental. Nenhuma associação EventPass foi encontrada nos inventários acima. Vercel é o consumidor EventPass identificado e a regra versionada bloqueia somente a branch de correção. Não se removeu App, não se mudou instalação All repositories nem configuração sensível de produção. Conferência de ausência de deployment após eventual push continua obrigatória como validação adicional, não substituto da inspeção prévia.

Histórico: antes da aprovação Mobile e do login Northflank, esses dois pontos eram bloqueios reais. Foram resolvidos pela sequência acima e não são pedidos pendentes. Não confundir a autorização email-read Northflank com aprovação de nova credencial GitHub.

## 2. Acesso Git: único bloqueio sensível restante para push

Git local sem credencial/helper/SSH utilizável; gh deslogado; push dry-run falhou antes de escrever. A conexão existente não oferece envio dos objetos Git locais. Não recriar commits pelo editor web nem reutilizar credenciais de outro trabalho.

Proposta específica apresentada ao proprietário às10:59, ainda sem aprovação inequívoca. A orientação geral de autonomia às11:09 mantém a exigência de autorização para credenciais sensíveis. Não criar nem coletar até essa aprovação:

- Fine-grained PAT de um dia, exclusivo de oenzoalmeida/eventpass.
- Contents: Read and write; Workflows: Write, pois ci.yml é alterado; Metadata Read implícito. Sem administração, secrets ou outros repositórios.
- Receber apenas por cofre, com autorização de uso por comando. Há suporte para entregar um valor salvo a arquivo privado 0600 sem retornar o conteúdo.
- Helper HTTPS efêmero pode ler esse arquivo diretamente no processo Git, com escopo de host e caminho exatos. Não colocar token em URL, argumentos, logs ou configuração persistente. Não ativar trace. Apagar arquivo/helper e revogar a credencial ao concluir. Essa rota é suportada, mas ainda não testada com credencial real e não foi iniciada.
- Depois da aprovação e da autenticação segura: dry-run, push somente da branch aprovada, SHA remoto idêntico, GitHub Actions nesse SHA e conferência adicional de ausência de deploy. Nenhum merge. PR continua texto proposto até aprovação das palavras.

O login gh pelo navegador não foi iniciado: pode pedir acesso mais amplo que o mínimo desta proposta.

## Fontes inspecionadas

- https://github.com/oenzoalmeida/eventpass/settings/installations?page=1
- https://github.com/oenzoalmeida/eventpass/settings/installations?page=2
- https://github.com/oenzoalmeida/eventpass/settings/hooks
- https://github.com/settings/installations/171173568
- https://github.com/settings/installations/157061511
- https://dashboard.render.com/
- https://dashboard.render.com/web/srv-dai6ltm1egvs73cr5890
- https://app.northflank.com/u/oenzoalmeida
- https://app.northflank.com/t/oenzoalmeidas-team/projects
- https://app.northflank.com/t/oenzoalmeidas-team/integrations/vcs
- https://dashboard.blitz.cloud/
- https://app.base44.com/apps
- https://lovable.dev/dashboard/projects
- https://github.com/settings/installations/173730726
- https://github.com/settings/installations/170945786
- https://github.com/settings/installations/166521431
- https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- https://git-scm.com/docs/gitcredentials
- https://vercel.com/docs/project-configuration/git-configuration
