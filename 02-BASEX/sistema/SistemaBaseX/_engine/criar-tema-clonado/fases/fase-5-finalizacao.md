# Fase 5 — Finalização (Passos 25-26) + Troubleshooting

> Carregado depois do Self-Healing Loop convergir. Checklist final + relatório auditável + arquivamento de anexos + troubleshooting consolidado.

---

### Passo 25 - Checklist de validação final

#### 25.A - Conteúdo e dados
- [ ] Todos os produtos criados com título, descrição, preço e imagens corretos
- [ ] Todas as coleções com produtos e ordem replicada
- [ ] Menus com estrutura idêntica (header + footer + sub-menus)
- [ ] Páginas criadas com conteúdo correto
- [ ] Blog e artigos criados (se existia na referência)
- [ ] Políticas configuradas
- [ ] Announcement bar com texto e links corretos
- [ ] Redes sociais configuradas no footer

#### 25.B - Áreas-foco x Breakpoints (matriz pixel-perfect)

Para cada uma das 13 áreas-foco, verificar os 8 breakpoints:

> **Pilar 3 — matriz completa, não encurtar.** As 13 áreas-foco × 8 breakpoints refletem o loop da Fase 4. Toda célula (exceto `n/a`) fecha `[x]` com `diff == 0`. Cada `[x]` = uma verificação real de screenshot + `getComputedStyle`. Célula pendente = skill NÃO concluída.

| Área | B1 1920 | B2 1440 | B3 1280 | B4 1024 | B5 768 | B6 414 | B7 390 | B8 360 |
|------|---------|---------|---------|---------|--------|--------|--------|--------|
| 1. Announcement bar | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 2. Cabeçalho | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 3. Ícones header | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 4. Menu desktop | [ ] | [ ] | [ ] | [ ] | n/a | n/a | n/a | n/a |
| 5. Menu mobile | n/a | n/a | n/a | n/a | [ ] | [ ] | [ ] | [ ] |
| 6. Home sections | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 7. Collection page | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 8. Product cards | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 9. Product page | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 10. Footer | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 11. Cart drawer | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 12. Buttons | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| 13. Breadcrumb/nav | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

#### 25.C - Tabela de diff zerada

**Confirmação obrigatória:** A tabela de diff do Passo 24.C deve estar com TODOS os itens como `[x]` (diff zerado).

| Verificação | Status |
|---|---|
| Tabela de diff 24.C zerada (todos `[x]`) | [ ] |
| Screenshots finais tirados (referência + destino, todos breakpoints) | [ ] |
| Nenhuma imagem quebrada na loja destino | [ ] |
| Nenhum erro de console (JS errors) | [ ] |
| Performance: home carrega em < 3s no mobile (3G simulado) | [ ] |

#### 25.D - GATE DE RÉPLICA EXATA (byte-level) — OBRIGATÓRIO

**Este gate fecha a skill. Sem ele, NÃO declarar "concluído".**

Validação cruzada de TODOS os inventários da skill. Executar uma vez ao final.

| # | Validação | Como medir | Threshold | Status |
|---|-----------|------------|-----------|--------|
| 1 | **Copy fidelity** | Iterar inventário-copy: `sha256(ref) === sha256(dest)` por linha | 100% match | [ ] |
| 2 | **Liquid/section 1:1** | `count(data-section-type ref) === count(data-section-type dest)` em cada página | igual | [ ] |
| 3 | **Imagens 1:1** | Inventário-imagens: nenhuma `[ ] pendente`; cada slot tem `aspect_ratio` ±2% match | 100% [x] ok | [ ] |
| 4 | **Vídeos 1:1** | Inventário-videos: HEAD 200 + `readyState >= 2` para todos | 100% [x] | [ ] |
| 5 | **Reviews ≥95%** | Inventário-reviews: `total_destino >= 0.95 * total_ref` por produto | ≥95% por produto | [ ] |
| 6 | **Produtos 1:1** | `count(produtos dest) === count(produtos ref)` + spot-check de 10 produtos com diff de campos | igual + zero diff | [ ] |
| 7 | **Coleções 1:1** | `count(coleções dest) === count(coleções ref)` + ordem manual idêntica | igual | [ ] |
| 8 | **Menus 1:1** | JSON do menu destino igual ao `menus-referencia.json` (nesting incluso) | sha256 match | [ ] |
| 9 | **Páginas 1:1** | `body_html` de cada página: sha256 match após normalização | 100% match | [ ] |
| 10 | **Políticas 1:1** | Texto das 4 políticas: sha256 match | 100% match | [ ] |
| 11 | **Computed style 13 áreas-foco** | JSONs em `06. Anexos/computed-*.json`: font-family/weight/color idênticos, dimensões ±5% | 100% áreas | [ ] |
| 12 | **Diff visual** | Tabela 24.C zerada em 8 breakpoints × 13 áreas-foco | zero linhas pendentes | [ ] |
| 13 | **Push log** | `06. Anexos/push-diff-log.txt`: cada push tem diff pós-pull == arquivo subido | 100% confirmações | [ ] |
| 14 | **Theme check limpo** | `shopify theme check --fail-level=warning` retorna 0 | exit 0 | [ ] |

**Script de auto-validação (rodar via Bash):**

```bash
ANEXOS="06. Anexos"
LOJA="{loja}"

# 1. Copy
PEND_COPY=$(grep -c "\[ \]" "$ANEXOS/inventario-copy-$LOJA.md")
echo "Copy pendentes: $PEND_COPY (target: 0)"

# 2. Imagens
PEND_IMG=$(grep -c "\[ \] pendente" "$ANEXOS/inventario-imagens-$LOJA.md")
echo "Imagens pendentes: $PEND_IMG (target: 0)"

# 3. Vídeos
PEND_VID=$(grep -c "\[ \]" "$ANEXOS/inventario-videos-$LOJA.md")
echo "Vídeos pendentes: $PEND_VID (target: 0)"

# 4. Reviews
PEND_REV=$(grep -c "\[ \]" "$ANEXOS/inventario-reviews-$LOJA.md")
echo "Reviews pendentes: $PEND_REV (target: 0)"

# 5. Liquids/sections
PEND_LIQ=$(grep -c "\[ \]" "$ANEXOS/inventario-liquids-$LOJA.md")
echo "Liquids pendentes: $PEND_LIQ (target: 0)"

# 6. Theme check
shopify theme check --path /tmp/tema-completo --fail-level=warning && echo "Theme check OK" || echo "Theme check FAIL"

# Resultado final
if [ "$PEND_COPY$PEND_IMG$PEND_VID$PEND_REV$PEND_LIQ" = "00000" ]; then
  echo "✅ GATE 25.D APROVADO — réplica exata confirmada"
else
  echo "❌ GATE 25.D BLOQUEADO — corrigir pendências antes de declarar concluído"
fi
```

**Regra final:** Se QUALQUER linha de 25.D ficar `[ ]` → a skill NÃO está concluída. Voltar à fase responsável e completar antes de gerar o relatório do Passo 26.

#### 25.E - GATE FUNCIONAL DE CARRINHO E CHECKOUT (NON-NEGOTIABLE) — R89

> Os gates 24 + 25.A-D provam que a loja está IDÊNTICA à referência. **Nenhum deles prova que ela VENDE.** Este gate fecha o buraco que deixou passar carrinho/checkout quebrados num clone real: o checkout renderizava idioma errado pro comprador (admin dizia pt-BR, buyer via EN) e só oferecia PayPal, sem cartão. Sem este gate, NÃO declarar "concluído".

**Modo de execução (decidir pelo tipo de loja):**

| Loja destino | Como rodar o gate |
|---|---|
| **Multi-market / worldwide** (passou pela skill 04, tem markets/moedas) | Delegar 100% à skill 71, QA Funcional de Compra (`/qa-funcional-compra`) — matriz de países. O clone só conclui com o relatório da 71 anexado em `06. Anexos/qa-compra-{loja}/` e ZERO FAIL crítico. |
| **Single-market** (1 país/moeda) | Smoke-test inline abaixo — 1 fluxo completo com a `moeda_principal` do input. |

**Checks obrigatórios** (single-market inline, ou herdados do relatório da skill 71):

| # | Check | Critério PASS | Bloqueio |
|---|---|---|---|
| CART-1 | Add-to-cart funciona | Click no "add to cart" da PDP → item entra e o cart drawer/página abre | CRÍTICO |
| CART-2 | Totais e edição | Subtotal correto; alterar qty recalcula; remover item funciona | — |
| CART-3 | Desconto do carrinho | Se há `cart_progressive_discount`/bundle/BOGO: o desconto aplica no drawer **E persiste no checkout** (valor efetivo, não só o texto) | CRÍTICO quando a loja tem desconto |
| CART-4 | Ir pro checkout | Botão de checkout abre o checkout real, sem erro/loop/`dialog beforeunload` | CRÍTICO |
| CHK-1 | **Idioma do comprador** | Idioma RENDERIZADO no checkout real (texto + o `{locale}` da URL `/checkouts/...`) bate com o idioma-alvo da loja. **NUNCA** confiar no "idioma do checkout" do admin | CRÍTICO |
| CHK-2 | Moeda | Moeda exibida no checkout == `moeda_principal` do input, formatação correta | CRÍTICO |
| CHK-3 | **Formas de pagamento** | Tela de pagamento mostra cartão / Shopify Payments (não só PayPal/carteira). Só-carteira = FAIL + pendência de config explícita | CRÍTICO |
| CHK-4 | Frete cota | Endereço de teste do país retorna ≥1 tarifa; etapa de envio sem erro | CRÍTICO |
| CHK-5 | Console limpo | Zero erro de console / zero `dialog beforeunload` no fluxo add→cart→checkout | — |

**Evidência (G1):** screenshot de cada etapa em `06. Anexos/qa-compra-{loja}/` (`drawer`, `checkout-idioma`, `checkout-moeda`, `checkout-pagamento`, `checkout-frete`). Sem screenshot, o check não conta como PASS.

**NON-NEGOTIABLE (herdado da skill 71):**
- Loja **LIVE**: PARAR na tela de pagamento — JAMAIS concluir compra ou inserir cartão real.
- **Dev store**: pode concluir 1 pedido via **Bogus Gateway** (cartão `1`, qualquer data/CVV) e cancelar/reembolsar na MESMA sessão.

**Regra de bloqueio:** qualquer FAIL em check CRÍTICO → a skill NÃO está concluída. Registrar o defeito, corrigir na fase responsável (idioma/pagamento/frete = geralmente skill 04 fase 5; add-to-cart quebrado = revisar bundle/variantes dos Passos 13/17) e re-rodar o gate. As duas pendências que esse caso deixou passar, **CHK-1 idioma** e **CHK-3 só-PayPal**, entram como bloqueio explícito.

| Check | Status |
|---|---|
| CART-1 add-to-cart dispara + carrinho abre | [ ] |
| CART-2 totais corretos + editar/remover | [ ] |
| CART-3 desconto aplica e persiste no checkout | [ ] |
| CART-4 botão abre o checkout real | [ ] |
| CHK-1 idioma renderizado pro comprador correto | [ ] |
| CHK-2 moeda == `moeda_principal` | [ ] |
| CHK-3 cartão/Shopify Payments visível (não só PayPal) | [ ] |
| CHK-4 frete cota ≥1 tarifa | [ ] |
| CHK-5 console/checkout sem erro | [ ] |

**Regra final:** Se QUALQUER check CRÍTICO ficar FAIL → a skill NÃO está concluída. Só avançar pro Passo 26 com o gate 25.E fechado (ou o relatório da skill 71 sem FAIL crítico anexado).

### Passo 26 - Relatório final + Arquivamento de anexos

> **Arquivamento obrigatório:**
> Após gerar o relatório, mover screenshots pesados para `99. Arquivo/clones-historicos/{loja}-{data}/`. Manter `.md` de inventário em `06. Anexos/_clones/{loja}-{data}/` com symlink para os screenshots arquivados.

```bash
bash _engine/archive-clone.sh "{loja}" "{data-inicio}"
```

Gerar relatório de conclusão com:

## Dados clonados
- X produtos criados
- X coleções criadas (X automáticas, X manuais)
- X páginas criadas
- X artigos de blog criados (se houver)
- Políticas: refund, privacy, terms, shipping ✅

## Tema Dawn customizado
- Esquema de cores: primária #HEX, secundária #HEX, fundo #HEX
- Tipografia: heading "{fonte}", body "{fonte}"
- Max-width: Xpx

## Seções customizadas criadas
- `{nome-secao-1}.liquid` - descrição
- `{nome-secao-2}.liquid` - descrição

## Gate funcional de compra (25.E)
Resultado do fluxo add-to-cart → carrinho → checkout (R89). Multi-market: colar o resumo do relatório da skill 71.
- Carrinho: CART-1 [ ] · CART-2 [ ] · CART-3 [ ] · CART-4 [ ]
- Checkout: CHK-1 idioma [ ] · CHK-2 moeda [ ] · CHK-3 pagamento [ ] · CHK-4 frete [ ] · CHK-5 console [ ]
- Idioma renderizado pro comprador: `{locale detectado na URL /checkouts}` (esperado: `{idioma-alvo}`)
- Formas de pagamento na tela final: `{lista — cartão/Shopify Payments presente? sim/não}`
- Relatório 71 (multi-market): `06. Anexos/qa-compra-{loja}/QA Compra {loja} {data}.md`

## Ações manuais pendentes (se houver)
- [ ] Instalar app de reviews ({nome-da-app}) — reviews não podem ser replicados via API
- [ ] Configurar Shopify Payments / gateway de pagamento (se CHK-3 = FAIL, é BLOQUEIO, não pendência)
- [ ] Configurar domínio customizado
- [ ] Outros itens que requerem ação do usuário

## Screenshots comparativos
Salvo em `06. Anexos/` — comparar `clone-ref-*.png` com `clone-dest-*.png`.

---

## Troubleshooting

| Problema | Causa | Solução |
|---|---|---|
| Produto não aparece na featured-collection | Produto não publicado no canal Online Store | Verificar `published_at` e `published_scope` via Admin API |
| Hero banner cortado | `image_height: "large"` ou `"medium"` | Mudar para `image_height: "adapt"` (Regra R1) |
| Fonte não renderizando | Fonte não disponível no Shopify Font Library | Fazer upload como asset e usar `@font-face` (Regra R9) |
| `success` no CLI mas arquivo não mudou | Checksum caching | Fazer `theme pull` completo, depois modificar e fazer push novamente (Regra P3) |
| Announcement bar com cor errada | Esquemas de cor confundidos (scheme-1 vs scheme-3) | Separar esquemas: announcement usa scheme-1, header usa scheme-3 (Regra R6) |
| Seção custom não aparece no editor de temas | Faltou `presets` no schema | Adicionar `"presets": [{"name": "Nome"}]` (Regra R14) |
| Menu não navega pra coleção correta | Handle de coleção divergente | Verificar que handle da coleção criada bate com o handle no link do menu (Regra R33) |
| Endpoint bloqueou endpoints públicos | Usar fallback de scraping via Chrome Brain (Passo 5b) |
| Password page na referência | Storefront protegido por senha | Pedir senha ao usuário, inserir via Chrome Brain |
| Fonte não disponível no Dawn | Fonte da referência não está na Shopify Font Library | Upload do arquivo de fonte como asset + `@font-face` |
| Imagem de banner não carrega | URL expirada ou proteção contra hotlink | Baixar via Chrome Brain (screenshot ou blob) e fazer upload manual |
| `productSet` retorna null sem erros | Produto de variante incorreto | Verificar se `options` estão definidas antes de criar variantes |
| CSS não aplica | Especificidade insuficiente | Aumentar seletor: `.section-header .btn` em vez de `.btn` (Regra R12) |

---

