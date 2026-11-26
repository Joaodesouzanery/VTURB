# Engine: setup-avaliacao-manual

Engine da skill `03. Skills/58. Setup Avaliação Manual.md`.
Instala a section `trust-reviews.liquid` (fonte canônica: `06. Anexos/trust-reviews.liquid`) num tema Shopify.

## Scripts

### preflight.mjs
Valida o ambiente antes de qualquer push: Node 20+, Shopify CLI no PATH, arquivo canônico existe, `{% schema %}` parseia (>= 40 settings), índice de credenciais presente.

```bash
node preflight.mjs
```

### install.mjs
Push cirúrgico da section para o tema alvo. Nunca toca em outro arquivo (`--only` + `--nodelete`).

```bash
# 1. Sempre dry-run primeiro (mostra o plano, nao envia nada)
node install.mjs --store handle.myshopify.com --theme "Nome ou ID" --dry-run

# 2. Instalar (tema unpublished/backup)
node install.mjs --store handle.myshopify.com --theme 123456789 --password shptka_xxx

# 3. Tema LIVE: bloqueado por padrao. So com autorizacao explicita do dono da loja:
node install.mjs --store handle.myshopify.com --theme 123456789 --allow-live
```

## Rollback

A section vive num único arquivo. Remover o arquivo reverte 100%:

```bash
# Via engine (usa themeFilesDelete da Admin API; exige auth OAuth com write_themes)
node install.mjs --store handle.myshopify.com --theme 123456789 --rollback

# Alternativa manual
# Admin > Online Store > Themes > tema > Edit code > sections/trust-reviews.liquid > Delete
```

Se a section foi inserida num template JSON (ex: `templates/product.json`), remover também a entrada correspondente de `sections` e do `order`.

## Segurança

- Tema LIVE (`role: main`) é bloqueado sem `--allow-live` (exit 2)
- `--dry-run` disponível em install e rollback
- Push a partir de pasta temporária contendo SÓ a section (impossível tocar em outro arquivo)
