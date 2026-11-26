---
tipo: template
titulo: "Cart Drawer BMSM — variante Horizon"
tags: [shopify, cart-drawer, horizon, bmsm]
criado: 2026-08-31
atualizado: 2026-08-31
status: ativo
---

# Cart Drawer BMSM — variante Horizon

> Os temas da família Horizon montam o cart drawer por **blocks configurados**, não por um `sections/cart-drawer.liquid` autocontido. Colar o liquid das outras variantes não funciona aqui. A aplicação é feita mexendo na configuração, não no markup.

## A diferença que quebra as outras variantes

Em tema Sound/Maestrooo, o carrinho é um arquivo Liquid que você substitui inteiro. Em Horizon, o carrinho é montado a partir de blocks declarados em:

```
config/settings_data.json  →  current.sections["cart-drawer"]
```

E **não** em `sections/header-group.json`, que é onde a intuição manda procurar. Procurar no lugar errado é o erro mais comum aqui: você edita o header-group, dá push, e nada muda na loja.

## Os 5 blocks, na ordem

| Ordem | Block | Type | Configuração |
|---|---|---|---|
| 1 | timer | `countdown_timer` | 1200 segundos (20 minutos de reserva) |
| 2 | items | `cart_items` | padrão |
| 3 | subtotals | `subtotals` | padrão |
| 4 | checkout | `checkout_btn` | padrão |
| 5 | badges | `payment_badges` | padrão |

## Settings da section

| Setting | Valor |
|---|---|
| `heading_text` | o título do drawer, no idioma da loja |
| `heading_alignment` | `flex-start` |
| `desktop_width` | `normal` |
| `mobile_width` | `partial` |

## Como aplicar

Uma escrita só, em um arquivo só:

```
themeFilesUpsert  →  config/settings_data.json
```

Não toca em `layout/theme.liquid`, não toca em `assets/base.css`, não toca em `sections/`. Se a sua alteração está pedindo para mexer em qualquer um desses, a variante escolhida está errada.

## Antes de aplicar

1. Puxar o `config/settings_data.json` atual e guardar a cópia. É o arquivo que o editor de temas da Shopify também escreve, então ele muda sem você saber.
2. Conferir se já existe `current.sections["cart-drawer"]`. Se existir com blocks, você está sobrescrevendo a configuração atual do carrinho, e precisa mesclar em vez de substituir.
3. Aplicar numa **cópia não publicada** do tema, olhar no preview, e só então publicar.

## Quando NÃO usar esta variante

- Tema com `sections/cart-drawer.liquid` autocontido (tem `<cart-drawer>`, `v-stack`/`h-stack`, `slot="footer"`): use [[cart-drawer-sound-maestrooo]]
- Tema Streetch, Spotlight, Dawn ou Maestrooo clássico: use [[cart-drawer-liquid]]
