---
description: Instala a section Trust Reviews (avaliações manuais estilo Trustpilot) em tema Shopify Online Store 2.0. Um arquivo Liquid autocontido, escrito no editor de temas, sem app e sem mensalidade.
argument-hint: <loja.myshopify.com> [theme-id-ou-nome] [--dry-run]
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Execute a skill "Setup Avaliação Manual". Fonte: `03. Skills/58. Setup Avaliação Manual.md`.
Guia para o dono da loja: `05. Guias/Section Trust Reviews - Guia de Instalacao.md`.
Arquivo canônico da section: `06. Anexos/trust-reviews.liquid`.

Pré-voo obrigatório:

```bash
node "_engine/setup-avaliacao-manual/preflight.mjs"
```

Acesso: é a conta Shopify do próprio dono. Se o CLI não estiver logado, `shopify auth login --store {handle}`. Sem navegador, gerar token no app Theme Access da própria loja.

NON-NEGOTIABLE: **nunca instalar direto no tema publicado.** A engine bloqueia isso com exit 2, e `--allow-live` só com autorização explícita do dono. Instalar numa cópia não publicada, conferir no preview em desktop e em 390px de largura, e só então publicar. O rollback automático usa a Admin API e exige `shopify store auth --store {handle} --scopes read_themes,write_themes` rodado uma vez antes; sem isso, o rollback é manual pelo editor de temas.
