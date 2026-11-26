# Fase 4 — Validação pixel-perfect + Self-Healing Loop + Checkpoint humano (Passo 24)

> Carregado quando dados populados e precisa validar. Inclui Passo 24 (validação visual + computed style + diff), 24.D (Self-Healing Loop), 24.E (Checkpoint humano).

---

### Passo 24 - Validação pixel-perfect multi-breakpoint (OBRIGATÓRIO)

**Esta fase NÃO pode ser pulada nem encurtada.** Validação pixel-perfect é o padrão da skill, não opção. Toda execução, independente do site de referência, passa pela matriz completa abaixo.

> **Pilar 3 — 8 viewports × 5 páginas, sem atalho (NON-NEGOTIABLE).** Matriz fixa: 8 breakpoints × 5 páginas, na ref E no destino = 80 screenshots + 6 de menu mobile = **86 arquivos** em `06. Anexos/`. Reduzir viewports, cortar páginas ou validar "só desktop" = validação inválida → refazer. A comparação alimenta o loop 24.C/24.D, que roda até `diff == 0` em todas as 13 áreas-foco × 8 breakpoints — único critério de saída.

A validação tem 3 camadas que rodam em sequência:
- **24.A** - Screenshots em matriz (8 breakpoints × 5 páginas) e comparação visual lado a lado
- **24.B** - Validação pixel-perfect via `getComputedStyle` por componente das 13 áreas-foco
- **24.C** - Loop de correção até zerar a tabela de diff

#### 24.A - Matriz de screenshots multi-breakpoint

Definir os 8 breakpoints obrigatórios:

| ID | Viewport | Categoria |
|----|----------|-----------|
| B1 | 1920x1080 | Desktop XL |
| B2 | 1440x900  | Desktop |
| B3 | 1280x800  | Laptop |
| B4 | 1024x768  | Tablet landscape |
| B5 | 768x1024  | Tablet portrait |
| B6 | 414x896   | Mobile L |
| B7 | 390x844   | Mobile |
| B8 | 360x780   | Mobile S |

Definir as 5 páginas alvo (mesmas usadas na análise no Passo 2):
- P1 Home
- P2 Coleção (a mesma coleção usada no Passo 2.7)
- P3 Produto (o mesmo produto do Passo 2.6)
- P4 Carrinho (drawer ou page, conforme a loja destino - ver Passo 13.4c)
- P5 Uma page do menu (Our Story / Contact / About - a mesma do Passo 2)

Pra cada par (Bn, Pm) executar este loop, primeiro na referência depois no destino:
1. `mcp__chrome-devtools__resize_page` pra `width=Bn.width, height=Bn.height`
2. `mcp__chrome-devtools__navigate_page` pra a URL de Pm
3. **Detectar `dialog beforeunload`**. Se aparecer, é sinal de que há um save pendente que não persistiu no servidor — FALHA GRAVE. Tratar como erro de Quality Gate:
   ```javascript
   mcp__chrome-devtools__evaluate_script `
     window.addEventListener('beforeunload', e => { window.__sawBeforeUnload = true; });
   `
   // após navegar, se window.__sawBeforeUnload === true → erro de persistência, voltar Passo 16
   ```
4. `mcp__chrome-devtools__take_screenshot` com `fullPage: true` salvando em `06. Anexos/clone-{ref|dest}-{Bn}-{Pm}.png`
5. Validar console: procurar `"Liquid error"` no console messages (`mcp__chrome-devtools__list_console_messages`). Se encontrar, registrar como gap crítico no Passo 24.D
6. Se for P4 (carrinho), adicionar produto antes (clicar `add to cart`) ou navegar pra `/cart`
7. Se for mobile (B6/B7/B8), abrir e fechar o menu mobile e tirar screenshot adicional `clone-{ref|dest}-{Bn}-menu.png`

Total esperado: 8 breakpoints × 5 páginas × 2 sites = 80 screenshots base, + 6 screenshots de menu mobile = 86 arquivos em `06. Anexos/`. Chrome Brain salva screenshots no path configurado, passar o caminho completo: `06. Anexos/{filename}`.

> **Aba anônima obrigatória:** todas as navegações de validação visual usam aba anônima do Chrome Brain (`incognito context`) pra evitar cache do navegador, cookies de admin, e FOUC de scripts logados. Insight de `feedback_validar_fouc_anonima`.

Após cada par, comparar as duas screenshots lado a lado. Anotar qualquer divergência visual em uma lista de diff (não corrigir ainda - acumular pra rodar o loop 24.C uma vez só).

#### 24.B - Validação pixel-perfect via getComputedStyle (13 áreas-foco)

Esta é a validação que separa "parecido" de "100% pixel-perfect". Pra cada uma das 13 áreas-foco abaixo, em pelo menos 3 breakpoints (Desktop B2, Tablet B5, Mobile B7), extrair as propriedades computadas via Chrome Brain (`mcp__chrome-devtools__evaluate_script`) E comparar campo a campo com a referência. Quanto mais áreas cobertas, mais perfeito o clone.

**Áreas-foco obrigatórias:**

1. **Announcement bar** - `[class*="announcement"], .announcement-bar`
   - Container: width, height, background-color, padding, text-align
   - Texto: font-family, font-size, font-weight, color, letter-spacing
   - Link (se houver): color, text-decoration, hover
   - Slideshow (se rotacionar): timing, transição, número de slides
2. **Cabeçalho** - `header, [class*="header"]`
   - Container: width, height, background-color, padding, border-bottom, position, top, z-index, box-shadow
   - Logo wrapper: width, height, padding, margin, font-family (se for texto)
   - Container do menu: display, gap, justify-content, align-items
3. **Ícones do cabeçalho** - `.header__icons a, .header__icon, header svg` (busca, conta, carrinho)
   - Pra cada ícone: width, height, padding, margin, gap entre ícones
   - SVG interno: viewBox, paths.length, cada `d`, stroke, stroke-width, fill, stroke-linecap, cor RESOLVIDA via currentColor cascade
   - Badge do contador do carrinho: width, height, background, color, font-size, position, top, right
4. **Menu do header (desktop)** - `.header__menu, .header__menu-item`
   - Cada item: font-family, font-size, font-weight, letter-spacing, text-transform, color, padding
   - Hover state: color, underline, background
   - Mega menu / dropdown se existir: background, border, padding, gap, columns
5. **Menu mobile (drawer)** - `.menu-drawer, [class*="mobile-menu"]`
   - Drawer: width, height, background, transition, transform
   - Itens: font-family, font-size, padding, border-bottom
   - Hamburger icon: paths SVG, stroke-width, dimensões
   - Sub-menus: padding-left, font-size, separador
6. **Homepage - cada seção mapeada no Passo 4**
   - Pra cada seção: width, padding, margin-bottom, background, max-width interno
   - Hero/banner: altura, object-fit da imagem, posicionamento do texto, overlay
   - Featured collections: grid-template-columns, gap, card width, image aspect-ratio
   - Bandas de imagem, vídeo, shop-the-look: dimensões e proporções
7. **Página de coleção** - `.collection, .product-grid, .facets, .breadcrumb`
   - Grid: grid-template-columns por breakpoint, gap, max-width
   - Cards: width, padding, border, border-radius
   - Filtros: width da sidebar, font-size, spacing dos checkboxes, ícones
   - Breadcrumb: font-family, font-size, letter-spacing, color
   - Sort dropdown: width, height, font-family, border
   - Contador de produtos: font-size, color, position
8. **Cards de produto (componente reutilizado)** - `.card-wrapper, .card, .card__inner, .card__content, .card__information`
   - Dimensões: width, height, aspect-ratio da imagem
   - Hover: segundo imagem, quick-add button (position, opacity transition)
   - Título: font-family, font-size, font-weight, color, text-align, margin-top
   - Preço: font-family, font-size, color, compare-at-price (strikethrough, color diferente)
   - Badge de sale: background, color, font-size, position
9. **Página de produto** - `.product, .product__media, .product__info`
   - Galeria: thumbnail position, image size, gap entre thumbnails
   - Título: font-family, font-size, font-weight, line-height
   - Preço: font-size, color, gap entre price e compare-at-price
   - Variante picker: button vs dropdown, border, border-radius, selected state
   - Botão add-to-cart: width (full-width vs auto), height, padding, background, color, font
   - Descrição: font-family, font-size, line-height, color
10. **Footer** - `footer, .footer`
    - Background: color
    - Layout: grid-template-columns (quantas colunas), gap
    - Heading das colunas: font-family, font-size, font-weight, text-transform, letter-spacing
    - Links: font-family, font-size, color, hover, line-height
    - Newsletter form: input height, border, button style
    - Social icons: size, gap, color
    - Copyright: font-size, color, margin-top
11. **Cart drawer** - `.cart-drawer, [id*="cart-drawer"]`
    - Fundo/overlay: background, z-index
    - Drawer container: width, padding, background
    - Item de linha: layout (flex), imagem size, título font, price font
    - Subtotal: font-size, font-weight, border-top
    - Botão checkout: full-width, height, background, color
12. **Buttons (global)** - `button, .button, [class*="btn"]`
    - Primary: background, color, padding, border-radius, font-size, font-weight, text-transform, letter-spacing
    - Secondary/outline: border, background (transparent), color, hover
    - Hover state de cada tipo
    - Disabled state
13. **Breadcrumb e navegação de página**
    - font-family, font-size, color, alinhamento

Snippet base pra extrair propriedades de qualquer elemento (rodar via `mcp__chrome-devtools__evaluate_script`):
```javascript
({ selector }) => {
  const el = document.querySelector(selector);
  if (!el) return { error: 'elemento não encontrado', selector };
  const cs = getComputedStyle(el);
  return {
    backgroundColor: cs.backgroundColor,
    color: cs.color,
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    padding: cs.padding,
    margin: cs.margin,
    width: cs.width,
    height: cs.height,
    display: cs.display,
    border: cs.border,
    borderRadius: cs.borderRadius,
    letterSpacing: cs.letterSpacing,
    textTransform: cs.textTransform
  };
}
```

#### 24.C - Loop de correção até zerar diff

Após acumular todas as divergências das etapas 24.A e 24.B, montar a **tabela de diff**:

| # | Componente | Breakpoint | Propriedade | Valor Referência | Valor Destino | Correção Aplicada | Status |
|---|---|---|---|---|---|---|---|
| 1 | Hero banner | B2 | height | 600px | 400px | `image_height: "adapt"` | [ ] |
| 2 | Header menu | B2 | font-family | "Cardo" | "Arial" | `@font-face` + settings | [ ] |
| ... | | | | | | | |

Para cada linha na tabela:
1. Identificar o arquivo a corrigir (settings JSON, custom.css, seção Liquid)
2. Aplicar a correção localmente em `/tmp/tema-clone/...`
3. Push do tema com `shopify theme push --only` apenas nos arquivos editados
4. **Re-validar 24.A (visual) e 24.B (pixel-perfect)** SOMENTE nos breakpoints/áreas que tinham diff
5. **Atualizar a tabela de diff** com os resultados pós-correção
6. **Repetir os passos 1-4** até a tabela de diff estar zerada nas 13 áreas-foco em todos os 8 breakpoints

**BLOQUEIO:** Não prosseguir pro Passo 25 enquanto a tabela de diff tiver qualquer linha com status `[ ]`.

### Passo 24.D - Self-Healing Diff Loop (Princípio 3 — Universal Auto-Correção)

> **O que muda em relação ao 24.C:** 24.C era loop manual onde o agente preenchia a tabela e o usuário aprovava. 24.D é AUTÔNOMO: o agente captura, categoriza, corrige, valida e repete sem pedir aprovação até zerar diff.

#### Protocolo do loop (executar para cada `template_variant × pagina × breakpoint`)

```
LOOP:
  1. CAPTURE
     - Screenshot ref + dest (full-page) via Chrome Brain
     - getComputedStyle das 13 áreas-foco no destino (JSON)
     - Comparar com JSON da referência salvo no Passo 24.B
  2. DIFF
     - Calcular delta por dimensão (cor hex, fontFamily string, dimensão px, layout grid)
     - Categorizar cada diff em 1 das 6 categorias:
       a) COR        → custom.css ou color_scheme em settings_data.json
       b) TIPOGRAFIA → settings_data.json (type_header_font, type_body_font) ou @font-face em assets
       c) ESPAÇAMENTO→ section settings (desktop_padding_*, mobile_padding_*) ou custom.css
       d) LAYOUT     → section schema (desktop_columns, mobile_columns) ou estrutura HTML do .liquid
       e) COPY       → settings dos blocks (text, heading, subheading) ou body_html dos produtos/páginas
       f) IMAGEM     → assets do tema ou image_picker dos blocks
  3. LOCATE
     - Mapear cada categoria pro arquivo responsável (tabela abaixo)
  4. APPLY
     - Editar arquivo localmente em /tmp/tema-clone/
     - Push via shopify theme push --only ARQUIVO (validar via API ver Princípio 5)
     - Se push falhar → fallback themeFilesUpsert GraphQL
  5. RECAPTURE
     - Repetir CAPTURE só pra área afetada
  6. DECISION
     - Se diff == 0 → marcar [x] no tracker e ir pra próxima área-foco
     - Se diff != 0 e iteration < 10 → goto LOOP
     - Se iteration >= 10 → ESCALATE (descrição abaixo)
```

#### Tabela de localização (Categoria → Arquivo a editar)

| Categoria | Onde está | Como editar |
|---|---|---|
| COR de scheme global | `config/settings_data.json` → `current.color_schemes.scheme_X.settings.background/text/button` | Edit no JSON, push, validar |
| COR específica de section | `assets/section-{nome}.css` ou inline `<style>` da section `.liquid` | Edit no CSS, push |
| TIPOGRAFIA global | `config/settings_data.json` → `type_header_font`, `type_body_font` | Edit, push |
| TIPOGRAFIA específica | section `.liquid` com font setting + `<style>` consumindo | Adicionar setting, push |
| ESPAÇAMENTO desktop | section schema `desktop_padding_top/bottom/margin_*` | Aplicar regra 19 — adicionar setting se falta |
| ESPAÇAMENTO mobile | section schema `mobile_padding_top/bottom/margin_*` | Idem regra 19 |
| LAYOUT colunas/grid | section schema `desktop_columns/mobile_columns/gap` | Schema + CSS via vars |
| LAYOUT estrutura HTML | section `.liquid` markup (reordenar divs/grids) | Edit Liquid, push |
| COPY de section setting | `templates/{x}.json` block settings (heading, subheading, text) | Edit JSON do template, push |
| COPY de produto | `body_html` do produto via Admin API `productUpdate` | mutation |
| COPY de página | `body_html` da página via Admin API `pageUpdate` | mutation |
| IMAGEM de section | `templates/{x}.json` block setting `image: shopify://shop_images/X` | upload asset + edit |
| IMAGEM de produto | `productCreateMedia` mutation com URL CDN | mutation |

#### Heurísticas de decisão automática

Para evitar loops infinitos e correções erradas:

- **Tolerância de cor:** se hex difere em ±2 nos 6 dígitos, considerar match (anti-aliasing/sRGB rendering)
- **Tolerância de px:** ±3px em padding/margin, ±15px em dimensão (largura/altura)
- **Tolerância de font-size:** ±1px (browser rendering pode diferir)
- **Font-family:** match exato após normalização (lowercase, sem aspas, primeira família da lista)
- **Confiança baixa:** se a correção candidata afeta múltiplas áreas-foco simultaneamente, aplicar em /tmp/tema-clone-staging/, screenshot, verificar regressão em outras áreas antes do push final

#### Escalação ao usuário

Quando iterações `>= 10` por área-foco sem zerar, ou quando o agente detecta:
- Fonte não disponível em Shopify Library nem como asset baixável
- Asset com proteção contra hotlink/CORS e Chrome Brain sem permissão de download
- API de reviews destino não tem CSV import
- Estrutura impossível de replicar no tema escolhido (ex: 3D viewer custom)

Registrar no `06. Anexos/escalation-{loja}-{data}.md`:
```markdown
| # | Área | Tentativas | Diagnóstico | Ação manual sugerida |
|---|------|-----------|-------------|----------------------|
| 1 | Hero | 10 | Fonte "Custom Sans" não disponível | Upload do arquivo .woff2 manualmente |
```

E continuar com as outras áreas. Não bloquear o loop inteiro por 1 ponto cego.

#### Tracker do loop

`06. Anexos/self-healing-tracker-{loja}.md`:
```markdown
| Template | Página | Breakpoint | Área-foco | Iter | Status | Última correção |
|---|---|---|---|---|---|---|
| product.json | P3 | B2 | Botão ATC | 3 | [x] zero diff | --color-button #142924 |
| product.bento.json | P3 | B7 | Bento grid layout | 7 | [ ] em correção | mobile_columns 2→1 |
```

#### Critério de saída global

Loop encerra quando:
```
∀ (template_variant, página, breakpoint, área_foco) → diff == 0 OR escalated
```

Sem isso, NÃO ir para o Passo 25.

#### Helper de Page Cache Invalidation (resolve gap S do roadmap)

> **Problema:** após push de templates ou edição de produto, o page cache do Shopify serve HTML antigo por 1-5 min. Validação via Chrome Brain produz falsos negativos. Custou ~30min numa sessão real.

Após qualquer mudança em tema/produto que afete uma PDP/coleção/página específica, invalidar o page cache daquela URL:

**Estratégia 1 — Touch via Admin GraphQL (recomendado):**

Aciona o `updated_at` do recurso sem alterar dados. Shopify invalida o page cache automaticamente.

```graphql
# Produto (invalida PDP)
mutation TouchProduct($id: ID!) {
  productUpdate(input: { id: $id }) {
    product { id updatedAt }
    userErrors { field message }
  }
}

# Coleção (invalida página de coleção)
mutation TouchCollection($id: ID!) {
  collectionUpdate(input: { id: $id }) {
    collection { id updatedAt }
    userErrors { field message }
  }
}

# Página (invalida /pages/{handle})
mutation TouchPage($id: ID!) {
  pageUpdate(id: $id, page: {}) {
    page { id updatedAt }
    userErrors { field message }
  }
}
```

Após touch, esperar 5-10s e validar via Chrome Brain. Cache deve ter invalidado.

**Estratégia 2 — Query string buster (fallback):**

Quando o touch não invalida (raro), usar `?_={timestamp}` na URL pra forçar revalidação no Cloudflare/CDN. Não invalida o cache do Shopify-side, só bypass.

```javascript
await fetch(`${url}?_=${Date.now()}`, { cache: 'no-store' });
```

**Estratégia 3 — Touch no tema (invalida tudo):**

Quando a mudança é global (custom.css, layout/theme.liquid), o page cache de TODAS as páginas precisa invalidar:

```graphql
mutation TouchTheme($id: ID!) {
  themeUpdate(id: $id, input: { name: "Same name same name" }) {
    theme { id name }
    userErrors { field message }
  }
}
```

Mudar o nome do tema (mesmo pro mesmo valor) força reindex. Tomar cuidado para preservar nome original.

**Wrapper sugerido (Python):**
```python
def invalidate_page_cache(resource_type, resource_id, token, store):
    """resource_type: 'product' | 'collection' | 'page' | 'theme'"""
    mutations = {
        'product': 'productUpdate(input: {id: "%s"})' % resource_id,
        'collection': 'collectionUpdate(input: {id: "%s"})' % resource_id,
        'page': 'pageUpdate(id: "%s", page: {})' % resource_id,
        'theme': 'themeUpdate(id: "%s", input: {})' % resource_id,
    }
    # graphql call ...
```

**Quando NÃO invalidar:** mudanças em tema que afetam só Theme Editor preview (`?preview_theme_id=X`) — preview já bypassa o cache.

**Critério de validação:** após invalidação, fazer Chrome Brain GET com `?_={timestamp}` e validar que conteúdo está atualizado. Timeout de 60s antes de assumir falha e re-touchar.

---

### Passo 24.E - Checkpoint humano explícito (antes do Quality Gate byte-level)

> Mesmo com Self-Healing Loop (24.D) declarando diff-zero, PARAR aqui e pedir aprovação humana antes de avançar pro gate byte-level (25.D) e relatório final.
>
> **Por que existe:** o agente pode declarar "tudo igual" baseado nos critérios técnicos (computed style ±5%, diff visual ±10%, copy SHA256 match), mas o usuário pode ver algo que não bate com a expectativa subjetiva — alinhamento sutil, escolha de cor entre 2 valores quase iguais, hierarquia visual de copy. Esse checkpoint pega divergências que os critérios numéricos não capturam.

#### Protocolo

1. **Gerar resumo executivo** do que foi clonado:
   ```
   === Clone concluído (master EN) — aguardando aprovação ===

   Loja referência: {url_ref}
   Loja destino: {dominio_dest}.myshopify.com
   Tema: Dawn customizado

   Templates clonados (Passo 1.5):
   - PDP: {N} variantes (V1: produto.json, V2: produto.bento.json, V3: produto.video-first.json)
   - Coleção: {N} variantes
   - Página: {N} variantes

   Quality Gates:
   - 24.A (screenshot 8×5): {86}/86 capturas — DIFF ZERO em {86}/86
   - 24.B (computed style 13 áreas × 8 BP): {104}/104 áreas validadas
   - 24.D (Self-Healing Loop): convergiu em {N} iterações
   - 25.D (byte-level): PENDENTE (depende deste checkpoint)

   Pendências manuais conhecidas:
   - {app de reviews que exige instalação}
   - {videos sem hotlink permitido — usar re-upload}
   - {N produtos com templateSuffix manual no theme editor}
   ```

2. **Abrir loja destino no Chrome Brain ABA ANÔNIMA** (sem cache, sem cookies admin) e mostrar URLs pro usuário:
   - Home: `https://{dest}.myshopify.com/`
   - Coleção principal: `https://{dest}.myshopify.com/collections/all`
   - PDP exemplo (top produto): `https://{dest}.myshopify.com/products/{handle-top}`
   - Carrinho: `https://{dest}.myshopify.com/cart`
   - Page exemplo: `https://{dest}.myshopify.com/pages/{handle-page}`

3. **PEDIR aprovação explícita**, neste formato:

   ```
   ==> Por favor, abre os links acima EM ABA ANÔNIMA do teu próprio browser, confere se ficou como você queria, e responde:
   - "aprovo" → sigo pro Quality Gate byte-level (25.D) e finalizo
   - "ajusta X" → volto pro Passo 24.D com X como input e refaço o loop só nessa área
   - "internacionaliza" → conclui master EN e oferece rodar Fase 7 da skill a skill 04 (Configurar a Loja para Vender no Mundo) pra traduzir nos idiomas habilitados
   - "cancela" → reverto e finalizo
   ```

4. **Aguardar resposta humana**. NÃO avançar pro 25.D sem palavra-chave explícita.

5. **Se resposta = "ajusta X"**: tratar X como diff novo (mesmo formato do Passo 24.D), voltar Passo 24.D limitando o loop à área indicada.

6. **Se resposta = "internacionaliza"**: marcar `master_en_aprovado = true`, salvar evidência em `06. Anexos/aprovacao-master-en-{data}.md`, executar 25.D, e ao final do 26, perguntar:
   > "Vou disparar a Fase 7 da skill 04 (Setup Loja Worldwide) pra traduzir nos idiomas habilitados. Quais idiomas? (ex: fr,de,es)"

7. **Se resposta = "aprovo"**: marcar `master_en_aprovado = true`, salvar evidência, prosseguir 25.D.

#### Anti-pattern

- ❌ Auto-aprovar com base em Quality Gates numéricos só
- ❌ Pular esse checkpoint "porque o cliente já tinha aprovado a referência"
- ❌ Aceitar "pode ir" sem palavra-chave (aprovo/ajusta/internacionaliza/cancela)
- ❌ Avançar pro 25.D sem evidência salva da aprovação em `06. Anexos/`

> AGUARDAR resposta. NUNCA aplicar sem aprovação explícita.

---

