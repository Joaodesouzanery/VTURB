---
tipo: template
area: loja
tags:
  - shopify
  - cart-drawer
  - buy-more-save-more
  - streetch
  - spotlight
criado: '2026-06-01'
atualizado: '2026-06-01'
compatibilidade:
  - Streetch (Maestrooo)
  - Spotlight
  - outros temas não-Horizon
---

# Cart Drawer BMSM (Buy More Save More) - Template Reutilizavel

> Cart drawer com timer de reserva, tier savings, savings indicator estilo checkout e CTA reforcado. Versao v3 validada visualmente em 2026-06-01. Pronta pra colar em qualquer loja com tema base Streetch/Spotlight/Maestrooo.

## Arquivos desta pasta

| Arquivo | Para que serve | Sincroniza? |
|---|---|---|
| `cart-drawer-liquid.md` | Variante **Streetch/Spotlight/Dawn** — liquid embutido em code block .md | Sim |
| `cart-drawer-sound-maestrooo.md` | Variante **Sound/Maestrooo (Impact)** — versão completa (timer translúcido, totais unificados, savings por desconto/compare-at, envio com geolocalização, ícones de pagamento). **USE ESTA pra temas tipo Sound/Impact** | Sim |
| `cart-drawer.liquid` | Mesma coisa do Streetch, sem wrapper .md - so funciona se Sync propagar .liquid | NAO por padrao |
| `README.md` | Este arquivo | Sim |

## Qual variante usar

| Tema base do alvo | Use |
|---|---|
| Streetch, Spotlight, Dawn, Maestrooo clássico | [[cart-drawer-liquid]] |
| Sound (Style Hatch), Maestrooo Impact/Focal/Warehouse (`<cart-drawer>` + `price-list` com `original_line_price`) | [[cart-drawer-sound-maestrooo]] |
| Horizon | [[cart-drawer-horizon]] |

## IMPORTANTE: por que `.liquid` nao aparece em outro PC

**Obsidian Sync sincroniza apenas `.md`, `.canvas` e imagens** por padrao. Arquivos `.liquid`, `.json`, `.js`, `.css` precisam ser ativados manualmente em `Settings > Sync > Sync attachment types`. Se nao quiser mexer no Sync, use o `.md` (que ja vem com o liquid embutido).

## O que vem no template

| # | Componente | Onde aparece |
|---|---|---|
| 1 | CSS variables com paleta (Iron Charcoal / Oak Tan / Sage Green) | `<style>` no topo da section |
| 2 | Heading "Buy More Save More - (count) items" | header do drawer |
| 3 | Timer banner reservation 20:00 com localStorage | dentro do cart_content (carrinho cheio) |
| 4 | 3 tier badges (2/3/4+ pieces, +20/25/30%) | abaixo do timer |
| 5 | Linha "Discounts -EUR X" estilo checkout | acima do TOTAL |
| 6 | Footer note "Discounts apply automatically at checkout" | antes do botao CHECKOUT |
| 7 | Override CSS do botao checkout (cor primaria da marca) | global |

## Compatibilidade

**Funciona em:** temas com `sections/cart-drawer.liquid` autocontido (schema interno). Streetch, Spotlight, Dawn, e a maioria dos temas Maestrooo.

**Nao funciona direto em:** temas Horizon-based. Pra Horizon, ver [[cart-drawer-horizon]].

## Como aplicar em uma nova loja (3 caminhos)

### Caminho A - Admin Theme Editor (5 min, sem CLI, mais simples)

No PC do colaborador:

1. Abrir Obsidian, navegar pra `04. Templates/Cart Drawer BMSM/cart-drawer-liquid.md`
2. Rolar ate o code block `liquid` no final do arquivo (entre os comentarios HTML BMSM-CART-LIQUID-PAYLOAD)
3. Clicar no icone de copiar do code block (canto superior direito)
4. No admin da loja alvo: **Online Store > Themes > [tema] > 3 dots > Edit code**
5. Em `sections/`, abrir `cart-drawer.liquid`
6. **BACKUP PRIMEIRO** - copiar todo conteudo atual e salvar em outro lugar
7. Apagar tudo, colar o conteudo do template, salvar
8. Ajustar paleta no `<style>` no topo (variaveis `--io-*`) pras cores da marca
9. Testar: adicionar produto no storefront, abrir drawer

### Caminho B - Extracao via script + Shopify CLI

```bash
# 1. Extrair o liquid do .md (substitua BEGIN/END pelas strings do final do .md)
python3 <<'EOS'
import re
md = open("/PATH/SistemaBaseX/04. Templates/Cart Drawer BMSM/cart-drawer-liquid.md").read()
m = re.search(r'BMSM-CART-LIQUID-PAYLOAD-START-->\n```liquid\n(.*?)\n```\n<!--BMSM-CART-LIQUID-PAYLOAD-END', md, re.DOTALL)
open("/tmp/cart-drawer.liquid", "w").write(m.group(1))
print(f"extracted {len(m.group(1))} bytes")
EOS

# 2. Autenticar a loja
shopify store auth --store NOMEDALOJA.myshopify.com --scopes read_themes,write_themes

# 3. Pegar o theme ID (live)
shopify store execute --store NOMEDALOJA.myshopify.com -j -q \
  '{ themes(first: 5) { edges { node { id name role } } } }'

# 4. Aplicar via themeFilesUpsert (substituir THEME_ID pelo gid retornado acima)
python3 -c "
import json
content = open('/tmp/cart-drawer.liquid').read()
json.dump({
  'themeId': 'gid://shopify/OnlineStoreTheme/THEME_ID',
  'files': [{'filename': 'sections/cart-drawer.liquid', 'body': {'type': 'TEXT', 'value': content}}]
}, open('/tmp/upsert.json', 'w'))
"

cat > /tmp/upsert.gql <<'GQL'
mutation themeFilesUpsert($files: [OnlineStoreThemeFilesUpsertFileInput!]!, $themeId: ID!) {
  themeFilesUpsert(files: $files, themeId: $themeId) {
    upsertedThemeFiles { filename size }
    userErrors { field message }
  }
}
GQL

shopify store execute --store NOMEDALOJA.myshopify.com \
  --allow-mutations \
  --query-file /tmp/upsert.gql \
  --variable-file /tmp/upsert.json \
  -j
```

Resposta esperada (sem erros):
```json
{
  "themeFilesUpsert": {
    "upsertedThemeFiles": [{ "filename": "sections/cart-drawer.liquid", "size": "..." }],
    "userErrors": []
  }
}
```

### Caminho C - via Claude Code (mais simples se colaborador tiver Claude Code instalado)

No PC do colaborador, abrir Claude Code no diretorio do SistemaBaseX e mandar:

> "Aplica o cart-drawer do `[[cart-drawer-liquid]]` na loja LOJA.myshopify.com com a paleta da marca {NOME DA MARCA} (cores principais: primaria #XXXXXX, accent #XXXXXX, fundo #XXXXXX)."

O BaseX-Master roteia, extrai o liquid via regex, autentica/identifica o tema, faz pull, aplica paleta, push, valida.

## Customizar paleta (obrigatorio para cada marca)

No topo do liquid, dentro do bloco `<style>`, as variaveis CSS:

```css
:root {
  --io-iron: #3A3733;    /* primaria - timer bg + botao checkout */
  --io-oak:  #8B6F4E;    /* accent warm */
  --io-forge:#0F0E0D;    /* texto principal */
  --io-cream:#F4EFE6;    /* fundo dos tiers */
  --io-sage: #7F8B6F;    /* tier ativo + savings */
}
```

## Customizar copy

| Variavel no liquid | Valor padrao de referencia |
|---|---|
| Heading | `"Buy More Save More - {count} items"` |
| Timer label | `"Secure your order - Reservation:"` |
| Tier 1 | `"2 PIECES +20% Extra off"` |
| Tier 2 | `"3 PIECES +25% Extra off"` |
| Tier 3 | `"4+ PIECES +30% Extra off"` |
| Discounts label | `"Discounts"` |
| Footer note | `"Discounts apply automatically at checkout"` |
| Reserve duration | `20 * 60 * 1000` ms (20 min) |

## Gotchas conhecidos

- **NAO usar `slot="header"`** no timer/tiers - causa sobreposicao do titulo. Ja esta certo no template (eles ficam dentro do cart_content).
- **Forms de PDP** devem usar `<product-form>` + `{% form 'product', product %}`, nunca `<form action="/cart/add">` HTML puro - senao redireciona pra /cart em vez de abrir drawer.
- **Setting `cart_type` da loja** precisa estar em `drawer` (Admin > Theme settings > Cart > Type).
- **localStorage key** `io_bmsm_reserve_end` - se quiser timers diferentes por loja no mesmo navegador, renomear pra `MARCA_bmsm_reserve_end`.

## Validacao apos aplicar

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://LOJA.myshopify.com/cart"
# esperado: 200

curl -s "https://LOJA.myshopify.com/?section_id=cart-drawer" | grep -oE "io-bmsm-(banner|tiers|tier|savings)" | sort -u
# esperado: lista das classes io-bmsm-*
```

Visual: adicionar produto no storefront, clicar no carrinho. Drawer abre com timer rodando, tiers, savings (se compare_at_price > price), TOTAL, footer note, botao escuro.

## Historico

| Data | Loja | Tema | Paleta | Status |
|---|---|---|---|---|
| 2026-06-01 | tema A Stretch v1.0.0 | paleta carvao / verde sage / linho | Aplicado e validado visualmente |
| 2026-06-01 | tema Sound/Maestrooo (nao-Horizon) | Header adaptado por metodologia, nao colado | Aplicado numa copia do tema, validado no preview |

## Conexoes

- Codigo liquid embutido: [[cart-drawer-liquid]]
- Guia metodologico: [[Carrinho Buy More Save More - Guia de Replicacao]]
- Variante Horizon: [[cart-drawer-horizon]]
