# EventPass na Oracle Cloud Always Free

Preparação de infraestrutura, **não um deploy concluído**. Requer uma VM Linux Always Free com armazenamento persistente, acesso SSH autorizado e validação de capacidade/cotas. Não criar recursos pagos nem fazer upgrade de conta.

## Premissas

- VM Ubuntu compatível com Node.js 22.13+ e arquitetura das dependências.
- Disco persistente e espaço para /var/lib/eventpass.
- DNS público apontando para a VM antes de habilitar HTTPS.
- Firewall da Oracle e firewall do SO liberando somente 22 (SSH restrito), 80 e 443. A API deve ouvir apenas 127.0.0.1:3333.
- Não executar `db:seed` em produção.
- Não armazenar segredos no GitHub nem neste diretório.

## Instalação manual inicial (ou via agente com acesso SSH)

1. Instalar Node.js 22 LTS, npm, git, Caddy e sqlite3 a partir de fontes oficiais confiáveis. Verificar versões.
2. Criar usuário de sistema `eventpass`, diretório `/opt/eventpass` para o checkout e `/var/lib/eventpass` para o banco. Dar acesso de escrita no diretório de dados somente ao usuário de serviço.
3. Clonar `https://github.com/oenzoalmeida/eventpass.git` com credencial de leitura apropriada, caso o repositório seja privado. Usar `npm ci`, `npm run build` e `npm run db:migrate` com `DATABASE_URL=/var/lib/eventpass/eventpass.db`.
4. Criar o administrador interativamente com `DATABASE_URL=/var/lib/eventpass/eventpass.db npm run admin:create`. Não inserir senha em histórico, scripts ou logs.
5. Instalar `eventpass.service` em `/etc/systemd/system/`, executar `systemctl daemon-reload`, `systemctl enable --now eventpass` e verificar logs.
6. Substituir o endereço `:80` do Caddyfile pelo **domínio real**. Instalar a configuração em `/etc/caddy/Caddyfile`, validar com `caddy validate` e recarregar Caddy. Caddy gerencia HTTPS automaticamente quando DNS e portas estiverem corretos.
7. Definir `WEB_ORIGIN` com a origem HTTPS real e revisar os cookies e o proxy antes de liberar usuários.

**Importante:** o Caddyfile fornecido serve somente como modelo de proxy HTTP para pré-configuração; **não** é adequado para uso público até que o domínio e HTTPS estejam configurados. O serviço foi definido para acesso local, impedindo exposição direta da API.

## Backup

Usar a API de backup online do SQLite, não copiar apenas o .db com o sistema em execução e WAL ativo:

```bash
sqlite3 /var/lib/eventpass/eventpass.db ".backup '/var/lib/eventpass/backup-manual.db'"
sqlite3 /var/lib/eventpass/backup-manual.db 'PRAGMA integrity_check;'
```

O backup deve ser copiado para destino externo seguro e criptografado, com agendamento, retenção e alertas. **Não guardar o único backup no mesmo volume.** Testar restauração em ambiente isolado antes de publicar.

## Critérios de aceitação

- [ ] VM elegível Always Free, sem cobrança e com armazenamento persistente confirmado.
- [ ] Aplicação responde em HTTPS e câmera funciona em dispositivo compatível.
- [ ] Acesso administrativo e inscrição pública funcionam.
- [ ] Reinício preserva banco e inscrições.
- [ ] Backup externo automático e restauração testada.
- [ ] CI e homologação completos.
- [ ] Revisão de segurança, privacidade e custos concluída.

Consultar também `docs/PRODUCAO-HOMOLOGACAO.md` no PR #4. Nenhum recurso Oracle é provisionado por estes arquivos.
