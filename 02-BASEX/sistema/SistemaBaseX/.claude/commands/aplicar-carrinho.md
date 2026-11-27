---
description: Aplica o cart drawer Buy More Save More (descontos progressivos, timer de reserva, totais unificados, ícones de pagamento) na sua loja Shopify, a partir do template pronto, na variante certa para o seu tema.
argument-hint: <loja.myshopify.com> [cor-do-header] [idioma]
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Execute a skill "Aplicar Carrinho". Fonte: `03. Skills/74. Aplicar Carrinho.md`.

Pré-voo obrigatório:

```bash
node "_engine/aplicar-carrinho/preflight.mjs" --store {loja}
```

Escolher a variante pelo tema, e conferir isso ANTES de escrever qualquer coisa:

| Tema | Template |
|---|---|
| Sound / Maestrooo (tem `sections/cart-drawer.liquid` autocontido) | `04. Templates/Cart Drawer BMSM/cart-drawer-sound-maestrooo.md` |
| Streetch, Spotlight, Dawn, Maestrooo clássico | `04. Templates/Cart Drawer BMSM/cart-drawer-liquid.md` |
| Horizon | `04. Templates/Cart Drawer BMSM/cart-drawer-horizon.md` |

NON-NEGOTIABLE: aplicar sempre numa **cópia não publicada** do tema, validar no preview em desktop e mobile, e publicar só depois da conferência do dono. Nunca editar `layout/theme.liquid`, `assets/base.css` nem o JS principal. Antes do push, puxar a versão fresca dos arquivos: o dono também mexe no editor da Shopify, e o push sobrescreve sem avisar. Adaptar a cor do header por metodologia, nunca colar a cor de outra loja.
