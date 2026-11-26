---
tipo: guia
area: loja
tags:
  - shopify
  - cart-drawer
  - buy-more-save-more
  - streetch
criado: '2026-06-01'
atualizado: '2026-06-01'
aplicado_em:
  - loja de referência (tema Streetch)
---

# Carrinho Buy More Save More - Guia de Replicacao

> Adapta o `cart-drawer.liquid` de qualquer tema para padrao "Buy More Save More" com timer de reserva, tier savings, savings indicator estilo checkout e CTA reforcado. Aplicavel a Streetch, Spotlight, Dawn-based. Para Horizon usar replicacao byte-a-byte via settings_data (ver 02. Cart Drawer aplicado no tema Horizon).

## Atalho: template pronto

Pra economizar trabalho, o arquivo final ja validado (tema Streetch) esta salvo em:

[[README]] - explica os 3 caminhos (Admin theme editor, CLI, Claude Code) com comandos prontos.

Variantes prontas por tema base:
- Streetch/Spotlight/Dawn → [[cart-drawer-liquid]]
- **Sound/Maestrooo (Impact)** → [[cart-drawer-sound-maestrooo]] (versão mais completa: timer translúcido, totais unificados, savings por desconto/compare-at, envio com geolocalização do lead, ícones de pagamento)
- Horizon → 02. Cart Drawer aplicado no tema Horizon

Este guia descreve a metodologia. Use o template pra colar direto em uma loja nova.

## Quando usar este guia

- Tema base NAO e Horizon (Streetch, Spotlight, Dawn, custom Maestrooo)
- Cart drawer nao tem block schema `countdown_timer` / `cart_items` / `subtotals` / `checkout_btn` / `payment_badges`
- `config/settings_data.json` NAO tem `current.sections["cart-drawer"]`

Se for Horizon, use 02. Cart Drawer aplicado no tema Horizon.

## Pre-requisitos

1. Pull do `sections/cart-drawer.liquid` atual via Admin API GraphQL (`themeFiles(filenames:)`)
2. Identificar paleta da marca (CSS vars custom)
3. Identificar pontos de injecao:
   - heading do header (linha do `<h2>` com `cart.general.title`)
   - inicio do `{% capture cart_content %}`, dentro do `{% else %}` da empty check
   - bloco de descontos antes do TOTAL

## As 6 Modificacoes

### 1. CSS variables com paleta da marca

Injetar bloco `<style>` no topo da section com variaveis CSS especificas da marca (timer bg, accent, button, savings) e override do botao checkout.

### 2. Heading "Buy More Save More - (count) items"

Substituir `{{ 'cart.general.title' | t }} ({{ cart.item_count }})` por `"Buy More Save More - {{ cart.item_count }} {{ cart.item_count | pluralize: 'item', 'items' }}"`.

### 3. Timer banner de reserva (DENTRO do cart_content, NAO no slot=header)

HTML+CSS+JS inline com countdown de 1200s (20min). Persistencia via `localStorage` (`io_bmsm_reserve_end`). Cor de fundo = primaria da marca, cor texto = on-primary.

ATENCAO: posicionado DENTRO do `{% capture cart_content %}` no `<div class="v-stack gap-5">`, NUNCA em `slot="header"` (causaria sobreposicao com o titulo).

### 4. Tier badges row

3 cards lado a lado: "BUY 2 +20%", "BUY 3 +25%", "BUY 4+ +30%" (ultima destacada). Posicionado abaixo do timer banner, no mesmo container.

Cor do tier ativo = accent secundario da marca.

### 5. Linha "Discounts -EUR X" (estilo checkout)

Loop sobre `cart.items` calculando `(item.compare_at_price - item.line_price) * quantity` quando `compare_at_price > price`. Renderiza linha estilo checkout (cor verde escuro #2C5234, sinal negativo, tabular-nums) ACIMA do TOTAL, dentro do mesmo `v-stack gap-1.5` que ja tem os `cart_level_discount_applications`.

NAO usar card com border-left ou background diferente - estilo precisa replicar o checkout do Shopify pra parecer nativo.

### 6. Footer note "Discounts apply automatically at checkout"

Texto curto uppercase tracking espacado, cor primaria com opacity, antes do bloco `<!-- BUTTONS -->` (que contem o checkout).

## Aplicacao tecnica

### Pull do arquivo

```graphql
query themeFiles($themeId: ID!, $names: [String!]) {
  theme(id: $themeId) {
    files(filenames: $names) {
      nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } }
    }
  }
}
```

### Push do arquivo modificado

```graphql
mutation themeFilesUpsert($files: [OnlineStoreThemeFilesUpsertFileInput!]!, $themeId: ID!) {
  themeFilesUpsert(files: $files, themeId: $themeId) {
    upsertedThemeFiles { filename }
    userErrors { field message }
  }
}
```

## Validacao

1. Curl `https://{loja}.myshopify.com/cart` retorna 200
2. Storefront com produto no carrinho: drawer abre com timer rodando, heading, tier badges, linha Discounts (se aplicavel), TOTAL, footer note, botao escuro
3. Reload pagina: timer continua de onde parou (localStorage)
4. Add to cart de qualquer PDP NAO redireciona para `/cart` - abre drawer (verificar uso de `<product-form>` em todos os forms)

## Licoes aprendidas

- Streetch/Spotlight/Dawn usam schema dentro do liquid, nao em `settings_data.json`
- Os 3 blocks tipicamente disponiveis no cart-drawer Streetch (`trust_badges`, `offer_banner`, `offer_image`) NAO precisam ser removidos - coexistem com a customizacao
- Editar 1 arquivo (cart-drawer.liquid) e menos risco que reescrever
- Sem `theme push` em massa, zero risco de apagar arquivos do tema (usar `themeFilesUpsert` pontual)
- Timer/tiers em `slot="header"` causa sobreposicao com o titulo - colocar no body do cart_content
- Form HTML puro (`<form action="/cart/add">`) redireciona para `/cart` - sempre envolver em `<product-form>` + `{% form 'product', product %}`
- Estilo de savings precisa imitar o checkout do Shopify (linha simples verde) - cards com border-left ficam "feios"

