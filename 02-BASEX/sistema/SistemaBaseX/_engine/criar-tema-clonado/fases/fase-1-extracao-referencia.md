# Fase 1 — Extração da referência (Passos 1.5, 1, 2, 3, 4)

> Carregado pelo agente quando inicia o clone. Cobre auditoria multi-template + análise visual + design system + sections.

---

## Passos de execução

# FASE 1 - RECONHECIMENTO VISUAL

### Passo 1.5 - Auditoria multi-template (Princípio 2 — OBRIGATÓRIO antes do Passo 2)

> **Por que existe:** lojas Shopify reais usam `templateSuffix` por produto/coleção/página para servir layouts diferentes na mesma loja. Assumir 1 template por tipo ja custou caro numa clonagem real: 18 produtos ativos ficaram sem update porque a loja de referencia servia mais de um layout. Por isso a skill audita TUDO antes.

#### 1.5.A - Auditar templates de produto (PDP)

1. Listar todos os produtos da referência via endpoint público:
   ```
   GET {url_referencia}/products.json?limit=250&page=1
   ```
   Paginar até array vazio. Salvar como `/tmp/audit-products-{loja}.json`.

2. Para CADA produto, abrir a PDP pública via Chrome Brain e extrair "template fingerprint":
   ```javascript
   // Via mcp__chrome-devtools__evaluate_script em cada /products/{handle}
   const sections = [...document.querySelectorAll('[data-section-type], [data-section-id]')]
     .map(s => s.dataset.sectionType || s.getAttribute('data-section-type') || 'unknown');
   const sectionStr = sections.join('|');
   // Fingerprint = sha256 da lista ordenada de section types
   return { handle: location.pathname.split('/').pop(), sections, fingerprint: sectionStr };
   ```

3. Agrupar produtos por fingerprint. Cada grupo único é uma variante de PDP a clonar:
   ```
   Fingerprint A (45 produtos): main-product|featured-collection|related-products
   Fingerprint B (8 produtos):  main-product|pdp-bento|pdp-video-slider|related-products
   Fingerprint C (3 produtos):  main-product|sticky-atc|pdp-chapter-principle|...
   ```

4. Para cada variante, escolher 1 produto representativo (o mais completo da variante) e tratar como template separado. Documentar em `06. Anexos/audit-pdp-templates-{loja}.md`:

   ```markdown
   | Variante | # Produtos | Sample handle | Fingerprint sha256 | Template destino |
   |---|---|---|---|---|
   | A | 45 | aquilon | abc12... | product.json (default) |
   | B | 8 | bento-watch | def34... | product.bento.json |
   | C | 3 | chapter-watch | ghi56... | product.chapter.json |
   ```

5. Cada variante distinta passa por TODOS os Passos 2.6 (análise PDP), 13.4 (template construção) e 24 (validação pixel-perfect).

6. **Gate de exaustividade (NON-NEGOTIABLE — R92).** A auditoria de PDP só está completa quando `count(produtos auditados com fingerprint) === count(produtos em /products.json paginado até vazio)`. NENHUM produto pode ficar sem fingerprint. Se `/products/{handle}` falhar (403/timeout), aplicar throttle (R69) e RE-TENTAR — nunca pular. Auditar só o "produto principal" e assumir que os demais usam o mesmo template é violação direta (ja aconteceu: 18 produtos servindo layout errado).

7. **Tabela de atribuição produto->template é OBRIGATÓRIA (contrato da Fase 3).** A coluna `# Produtos` do `audit-pdp-templates-{loja}.md` é o contrato que o Passo 17 consome pra atribuir `templateSuffix`. A soma da coluna DEVE bater com `count(produtos auditados)`. Registrar os handles por variante (mapa `handle -> variante -> suffix`) — sem esse mapa, a atribuição no Passo 17 é impossível.

#### 1.5.B - Auditar templates de coleção

1. Listar todas as coleções: `GET {url_referencia}/collections.json?limit=250`
2. Para cada coleção, abrir `/collections/{handle}` e extrair fingerprint (mesmo script do 1.5.A)
3. Agrupar e documentar em `06. Anexos/audit-collection-templates-{loja}.md`.

#### 1.5.C - Auditar templates de página

1. Mapear todas as páginas via header/footer links (ex: `/pages/about`, `/pages/sizing`, `/pages/contact`)
2. Para cada página, extrair fingerprint
3. Páginas com fingerprint diferente do default viram `page.{handle}.json` no destino

#### 1.5.D - Auditar template de cart

1. Adicionar 1 produto ao cart, abrir `/cart` e o drawer (botão do header)
2. Extrair fingerprint de cada um
3. Se cart drawer e cart page divergem → clonar os dois

#### Checkpoint Passo 1.5

| # | Item | Evidência | Status |
|---|------|-----------|--------|
| 1 | Todos os produtos auditados (count == total via products.json) | `audit-pdp-templates-{loja}.md` | [ ] |
| 2 | Variantes de PDP identificadas com sample handles | tabela na nota | [ ] |
| 3 | Variantes de coleção identificadas | `audit-collection-templates-{loja}.md` | [ ] |
| 4 | Variantes de página identificadas | `audit-page-templates-{loja}.md` | [ ] |
| 5 | Cart drawer vs cart page mapeados | nota | [ ] |

Sem isso preenchido, NÃO avançar para Passo 2. Princípio 2 violado = clone incompleto.

---

### Passo 1 - Validar lojas e autenticação

1. Confirmar que o tema Dawn está instalado na loja destino:
   ```bash
   shopify theme list --store <destino>
   ```
   Anotar o ID do tema Dawn ativo como `TEMA_ID`.

2. Confirmar acesso à loja destino:
   ```bash
   shopify theme pull --store <destino> --theme <TEMA_ID> --path /tmp/tema-teste --only "config/settings_data.json"
   ```
   Se sucesso → acesso OK.

3. Identificar o tema ativo na referência:
   - Acessar `{url_referencia}` e inspecionar o HTML fonte
   - Procurar por `Shopify.theme.name` ou classe CSS `<body class="template-index">` pra identificar o tema
   - Anotar como `TEMA_ATIVO` (Impact, Dawn, Prestige, etc.)

4. Se `TEMA_ATIVO = Impact`: usar o contexto do plugin `shopify-ai-toolkit` específico de Impact para guiar a extração. Se for outro tema premium, anotar e adaptar o processo.

5. Testar se o site de referência está acessível:
   - Abrir a URL via Chrome Brain: `mcp__chrome-devtools__navigate_page`.
   - Se aparecer password page, inserir a senha fornecida pelo usuário.
   - Confirmar que a página carrega completamente.

---

### Passo 2 - Análise visual completa do site de referência

Navegar pelo site de referência via Chrome Brain e documentar CADA detalhe visual.

> **NON-NEGOTIABLE — Reconhecimento POR COMPONENTE (Pilar 1).** O reconhecimento é por COMPONENTE VISUAL, nunca por tag HTML. O mesmo `<a>`, `<h2>` ou `<div>` tem estilos diferentes conforme o contexto (menu vs card, hero vs footer). Cada componente (announcement bar, header, hero, featured collection, cards, PDP, cart, footer, CTAs, preços) é reconhecido, documentado e RECRIADO no Dawn com CSS pixel-perfect (Fase 2, Passo 14). Fidelidade visual ALTA é o padrão da skill.
>
> **Evidência exigida:** para cada componente, o `getComputedStyle` bruto salvo como `06. Anexos/computed-ref-{componente}.json` — a fonte que o Passo 14 (CSS) e o 24.B (validação) consomem campo a campo. Sem o JSON, o item fica `[ ]` no Checkpoint Fase 1 (item 8).

#### 2.1 - Screenshots de todas as páginas

Tirar screenshots full-page das seguintes páginas da referência:
1. **Home** (`/`)
2. **Coleção** (a principal ou a do menu, ex: `/collections/all` ou a primeira do menu)
3. **Produto** (entrar num produto qualquer, preferencialmente o mais representativo)
4. **Carrinho** (adicionar produto e abrir o drawer ou `/cart`)
5. **Página do menu** (ex: `/pages/sobre`, `/pages/faq` ou link do menu, se existir)
6. **Blog** (se existir `/blogs/...`)
7. **Políticas** (`/policies/refund-policy`, etc.)

Para cada página:
- `mcp__chrome-devtools__resize_page` pra 1440x900 (desktop) → screenshot
- `mcp__chrome-devtools__resize_page` pra 390x844 (mobile) → screenshot
- `mcp__chrome-devtools__take_snapshot` pra capturar a estrutura DOM

#### 2.2 - Announcement bar

Verificar se existe announcement bar no topo e documentar:
- Texto exato (incluindo links)
- Cor de fundo e cor do texto
- Se tem múltiplas mensagens rotacionando (slideshow)
- Se é fixo ou some ao scrollar
- Altura e padding

#### 2.3 - Header / Navegação

Documentar COMPLETAMENTE:
- Logo: formato (imagem ou texto), dimensões aproximadas, posição (esquerda, centro)
- Menu items: textos exatos, ordem, se tem dropdowns/sub-menus
- Ícones: busca, conta, carrinho (SVG ou ícone, cor, tamanho, posição)
- Cor de fundo do header (quando no topo e quando sticky após scroll)
- Se o header é transparente sobre o hero (overlay) ou tem fundo sólido
- Badge do contador do carrinho (cor, posição)
- Padding e altura do header

#### 2.4 - Footer

Documentar completamente:
- Colunas e conteúdo de cada coluna (títulos, links)
- Redes sociais (quais plataformas, ordem)
- Newsletter (se tem campo de email)
- Logo no footer (se diferente do header)
- Copyright text (texto exato)
- Métodos de pagamento (ícones de cartão)
- Cor de fundo e cores dos textos
- Padding e espaçamento

#### 2.5 - Favicon e meta

- Favicon: URL ou extrair via `<link rel="icon">`
- Title da página (SEO title)
- Meta description
- OG image

#### 2.6 - Página de produto (OBRIGATÓRIO)

Documentar layout detalhado:
- Layout: imagens à esquerda/direita, galeria estilo (thumbnail strip, dots, grid)
- Campos visíveis: título, preço, compare-at-price, variantes, quantidade, botão add-to-cart
- Posição e estilo do botão "add to cart"
- Seções abaixo do fold: descrição, tabs, reviews, upsell, produtos relacionados
- Sticky add-to-cart (se tiver)
- Breadcrumb
- Social share buttons (se tiver)

#### 2.7 - Página de coleção (OBRIGATÓRIO)

Documentar:
- Grid de produtos: quantas colunas desktop, tablet, mobile
- Filtros: posição (sidebar esquerda, top bar, drawer), quais filtros disponíveis
- Sort dropdown: posição e estilo
- Breadcrumb
- Collection header: título, descrição, imagem (se tiver)
- Card de produto: campos visíveis (título, preço, hover com segundo imagem, quick add, rating)

#### 2.8 - Carrinho drawer (OBRIGATÓRIO)

Documentar:
- Tipo: drawer (abre da direita) ou página `/cart`
- Linha de item: imagem, título, variante, preço, quantidade, remover
- Subtotal e botão checkout
- Upsell ou cross-sell no carrinho (se tiver)
- Shipping bar (se tiver)

#### 2.9 - Menu mobile (OBRIGATÓRIO)

Abrir o menu hamburger e documentar:
- Ícone do hamburger (SVG paths, dimensões)
- Animação de abertura (slide, fade, full-screen)
- Itens do menu mobile (mesmo que desktop ou diferente?)
- Sub-menus: accordion ou navegação pra nova tela
- Ícones de conta/busca/carrinho no mobile menu

#### 2.10 - Screenshots mobile de TODAS as páginas

Tirar screenshots mobile (390x844) das mesmas páginas do 2.1, com atenção especial para:
- Layout das seções (mudam significativamente entre desktop e mobile?)
- Tamanho dos textos e botões
- Espaçamentos e proporções
- Elementos que somem ou reorganizam no mobile

#### 2.11 - Inventário de imagens (OBRIGATÓRIO)

Mapear TODAS as imagens da referência antes de iniciar qualquer construção. Este inventário é usado no Passo 15 para verificar que nenhuma imagem foi perdida.

```javascript
// Executar via Chrome Brain em cada página (home, produto, coleção, blog)
const images = [...document.querySelectorAll('img')].map(img => ({
  src: img.src,
  alt: img.alt,
  width: img.naturalWidth,
  height: img.naturalHeight,
  role: img.closest('[class*="hero"], [class*="banner"]') ? 'hero' :
        img.closest('[class*="product"], [class*="card"]') ? 'product' :
        img.closest('header') ? 'logo' :
        img.closest('footer') ? 'footer' : 'content'
}));
return images.filter(i => i.src && !i.src.includes('data:'));
```

Também extrair SVGs inline e arquivos de assets:
```javascript
const svgs = [...document.querySelectorAll('svg')].map(s => ({
  id: s.id || s.className,
  viewBox: s.getAttribute('viewBox'),
  context: s.closest('a, button, header')?.className?.substring(0, 50)
}));
return svgs;
```

Criar o **Inventário de Imagens** em formato de tabela e salvar em `06. Anexos/inventario-imagens-{loja-referencia}.md`:

```markdown
# Inventário de Imagens - {URL referência}

| # | URL original | Role | Dimensões | Status |
|---|-------------|------|-----------|--------|
| 1 | cdn.shopify.../hero.jpg | hero | 1440x600 | [ ] pendente |
| 2 | cdn.shopify.../logo.svg | logo | 200x50 | [ ] pendente |
```

**Validação das URLs de banners (obrigatória):**
```javascript
// Para cada imagem com role: 'hero' ou 'collection-cover':
const bannerUrls = imagens.filter(i => i.role === 'hero' || i.role === 'collection-cover').map(i => i.src);

// Validar cada URL
for (const url of bannerUrls) {
  const resp = await fetch(url, { method: 'HEAD' });
  console.log(url, resp.status, resp.ok ? '✅' : '❌ BLOQUEADO');
}
```
URLs com status 200 → usar diretamente no tema.
URLs bloqueadas (403/CORS) → buscar alternativa no DOM (srcset, data-src) ou substituir por imagem livre de royalties (Unsplash/Pexels) com dimensões equivalentes.

Atualizar o status de `[ ] pendente` para `[x] ok` conforme as imagens forem carregadas na loja destino (Passo 15). Ao final do Passo 15, nenhuma linha pode estar `[ ] pendente`.

#### 2.12 - Inventário de COPY (OBRIGATÓRIO — gate de réplica exata)

Toda string visível na referência precisa existir idêntica no destino. Sem isso, gate F2 não passa.

Salvar em `06. Anexos/inventario-copy-{loja}.md`:

```markdown
---
loja: {url_referencia}
gerado: {data}
---

## Copy Map (cada linha = uma string visível na referência)

| # | Página | Seletor | Texto referência | sha256 | Texto destino | Match? |
|---|--------|---------|------------------|--------|---------------|--------|
| 1 | home | `.announcement-bar` | "Frete grátis acima de R$ 199" | `abc12...` | | [ ] |
| 2 | home | `.hero__title` | "Built for the streets" | `def34...` | | [ ] |
| 3 | home | `.hero__cta` | "Shop now" | `ghi56...` | | [ ] |
| ... | | | | | | |
```

Extrair via Chrome Brain percorrendo seletores comuns (executar em cada página: home, produto, coleção, cart, footer, menu):

```javascript
const SELECTORS = [
  '.announcement-bar, [class*=announcement]',
  'header a, .header__menu-item, .header__icon[aria-label]',
  '.hero__title, .hero__subtitle, .hero__cta, [class*=hero] h1, [class*=hero] h2',
  'section h2, section h3, section .heading',
  '.product-card__title, .product-card__price, .price, .price--compare',
  '.product__title, .product__description, .product__vendor',
  'button, .btn, [class*=button]',
  '.faq__question, .faq__answer, details summary',
  'footer a, footer p, footer h4, .footer__heading',
  '.newsletter__heading, .newsletter__subheading, .newsletter input[placeholder]',
  '[placeholder]'
];
const out = [];
SELECTORS.forEach(sel => {
  document.querySelectorAll(sel).forEach(el => {
    const t = (el.placeholder || el.textContent || '').trim();
    if (t && t.length < 500) out.push({ sel, text: t, tag: el.tagName });
  });
});
return out;
```

Para CADA linha, calcular `sha256(texto_normalizado)` onde `texto_normalizado = texto.trim().replace(/\s+/g, ' ')`. Salvar o hash no inventário.

**Regra:** O destino só fecha gate F4 quando 100% das linhas tiverem `Match? = [x]` com `sha256(destino) === sha256(referência)`.

#### 2.13 - Inventário de VÍDEOS (OBRIGATÓRIO)

Vídeos em hero, bento grid, why-choose, slideshows precisam migrar com mesmo source/autoplay/loop/poster. Salvar em `06. Anexos/inventario-videos-{loja}.md`:

```markdown
| # | Página | Section | Source URL ref | Autoplay | Loop | Muted | Poster URL | Migrado para destino | Match? |
|---|--------|---------|----------------|----------|------|-------|------------|----------------------|--------|
| 1 | home | hero-slideshow slide-2 | `https://cdn.shopify.com/.../hero.mp4` | true | true | true | `https://.../poster.jpg` | | [ ] |
```

Extrair via Chrome Brain:

```javascript
return [...document.querySelectorAll('video, [data-video-id], iframe[src*="youtube"], iframe[src*="vimeo"]')].map(v => ({
  tag: v.tagName,
  src: v.currentSrc || v.src || v.querySelector('source')?.src,
  poster: v.poster,
  autoplay: v.autoplay,
  loop: v.loop,
  muted: v.muted,
  iframe_src: v.src
}));
```

**Estratégia de migração (em ordem de preferência):**
1. Download via Chrome Brain → re-upload como Shopify File (`shopify://shop_videos/`)
2. Se YouTube/Vimeo → manter URL externa, configurar embed na section
3. Se proteção contra hotlink → screenshot do poster como fallback estático com aviso no inventário

**Regra:** Cada linha precisa ter `Match? = [x]` + URL do destino + verificação HEAD 200 + Chrome Brain confirmando que o vídeo reproduz (`v.readyState >= 2`).

#### 2.14 - Inventário de REVIEWS (OBRIGATÓRIO)

Reviews são parte da prova social — não podem ser ignoradas. Salvar em `06. Anexos/inventario-reviews-{loja}.md`:

**Passo 1: Detectar a app de reviews da referência**

```javascript
return {
  loox: !!document.querySelector('[id*=loox], [class*=loox], script[src*=loox]'),
  judgeme: !!document.querySelector('.jdgm-widget, script[src*=judge]'),
  yotpo: !!document.querySelector('[class*=yotpo], script[src*=yotpo]'),
  stamped: !!document.querySelector('[class*=stamped], script[src*=stamped]'),
  shopify_reviews: !!document.querySelector('.spr-container, script[src*=shopify_product_reviews]'),
  ali_reviews: !!document.querySelector('[class*=ali-reviews], [id*=ali-reviews]'),
  okendo: !!document.querySelector('[class*=okendo], script[src*=okendo]'),
  other: [...document.querySelectorAll('[class*=review]')].slice(0,5).map(e => e.className)
};
```

**Passo 2: Extrair reviews da referência** (Chrome Brain, percorrendo PDPs):

```javascript
// Loox/Judge.me/Yotpo seguem padrões semelhantes — adaptar seletor conforme a app detectada
return [...document.querySelectorAll('.loox-review, .jdgm-rev, .yotpo-review')].map(r => ({
  author: r.querySelector('[class*=author], [class*=name]')?.textContent.trim(),
  rating: r.querySelectorAll('[class*=star-full], .jdgm-star--on').length,
  title: r.querySelector('[class*=title], [class*=heading]')?.textContent.trim(),
  body: r.querySelector('[class*=body], [class*=content], [class*=text]')?.textContent.trim(),
  date: r.querySelector('[class*=date], time')?.textContent.trim() || r.querySelector('time')?.dateTime,
  verified: !!r.querySelector('[class*=verified]'),
  image_urls: [...r.querySelectorAll('img')].map(i => i.src).filter(s => !s.includes('star'))
}));
```

Salvar em `06. Anexos/reviews-referencia-{loja}.json`.

**Passo 3: Inventariar o VISUAL do widget (OBRIGATÓRIO — base do clone)**

Como as reviews NÃO migram via app (ver Regra abaixo), o VISUAL do widget precisa ser reconstruído 1:1 na section `cs-reviews` (Passo 13.3.R, estrelas SVG). Capturar via Chrome Brain, com `getComputedStyle`, cada camada do widget da ref e salvar em `06. Anexos/reviews-visual-{loja}.md` + screenshot (`reviews-widget-{loja}.png`, desktop 1440 E mobile 390). Se a ref usa Loox/Judge.me/Yotpo, extrair também o `<path>` do SVG da estrela (view-source do widget) — é ele que vai no `cs-reviews.liquid`.

| Camada | O que capturar |
|---|---|
| Container / grid | nº de colunas, gap, max-width, fundo |
| Card | padding, borda, raio, sombra, fundo, tipografia |
| Estrela | **path do SVG** (não caractere), cor cheia/vazia, tamanho |
| Cabeçalho | posição da média + contagem, fonte, cor |
| Fotos | tamanho, raio, grid de miniaturas |
| Responsivo | colunas desktop vs mobile, breakpoint |

Esse arquivo é a FONTE do CSS e do SVG da `cs-reviews`. Sem ele, o clone do widget não fecha o Gate visual (24.A/24.B).

**Agregação por handle (OBRIGATÓRIO):** ao salvar, derivar também a forma `{ "handle-do-produto": [reviews...] }` em `reviews-referencia-{loja}.json` — o script de embed da fase-3 (Passo 22b) depende dessa estrutura por handle, não de um array plano por PDP.


**Estrutura do inventário:**

| Produto (handle) | App ref | Total ref | Rating médio ref | Total destino | Rating médio destino | Match (≥95%)? |
|------------------|---------|-----------|------------------|---------------|----------------------|---------------|
| `camiseta-streetwear` | loox | 47 | 4.8 | | | [ ] |

**Regra (ZERO app no destino):** as reviews NÃO são migradas via app/CSV. São reconstruídas como a section custom `cs-reviews` (Passo 13.3.R, estrelas SVG) com o VISUAL clonado do `reviews-visual-{loja}.md` e as reviews reais do `reviews-referencia-{loja}.json` (agregado por handle) embutidas como blocks estáticos (Passo 22b). Widget dinâmico NÃO é necessário. Gate F4 fecha quando `cards_renderizados_na_cs-reviews >= 0.95 * total_ref` por produto — medido no storefront, não em app. Ver R90.

#### 2.15 - Inventário de LIQUIDS/SECTIONS (OBRIGATÓRIO)

Não basta ter "uma section parecida". Cada section da ref precisa de equivalente registrado. Salvar em `06. Anexos/inventario-liquids-{loja}.md`:

```markdown
| # | Section ref (data-section-type) | Posição na página | Resolução destino | Arquivo destino | Schema válido | Render visível |
|---|--------------------------------|-------------------|-------------------|-----------------|---------------|----------------|
| 1 | `hero-slideshow` | home pos 1 | EXISTENTE | `sections/slideshow.liquid` | [ ] | [ ] |
| 2 | `bw-bento-grid` | home pos 4 | CUSTOM | `sections/bw-bento-grid.liquid` | [ ] | [ ] |
```

Para cada section da referência (extraída no Passo 4.0):
- `EXISTENTE` → apontar arquivo nativo do tema
- `EQUIVALENTE` → apontar arquivo nativo + ajustes necessários
- `CUSTOM` → caminho do `.liquid` gerado pelo especialista

**Validação automática:**
```bash
shopify theme check --path /tmp/tema-completo --only sections/
```
Toda section CUSTOM precisa passar sem warnings.

**Regra:** Gate F1 só fecha quando inventário tiver TODAS as sections da ref com resolução definida e arquivo destino apontado.

### Passo 3 - Extrair design system completo

Seguir o mesmo processo de extração de design system, executando via Chrome Brain:

#### 3.1 - Tipografia POR COMPONENTE

**CRÍTICO:** Não extrair fontes por tag HTML (h1, p, a). Extrair por COMPONENTE VISUAL, porque o mesmo tag pode ter fontes diferentes dependendo do contexto (ex: `<a>` no menu usa Cardo, `<a>` no product card usa Helvetica).

Para CADA componente (announcement bar, header menu, hero title, hero subtitle, hero CTA, featured collection heading, product card title, product card price, section heading, body text, footer links, footer copyright), extrair:

```javascript
// Executar via Chrome Brain para cada seletor de componente
const el = document.querySelector('SELETOR_DO_COMPONENTE');
const cs = getComputedStyle(el);
return {
  fontFamily: cs.fontFamily,
  fontSize: cs.fontSize,
  fontWeight: cs.fontWeight,
  letterSpacing: cs.letterSpacing,
  lineHeight: cs.lineHeight,
  textTransform: cs.textTransform,
  color: cs.color
};
```

Criar tabela de tipografia por componente:

| Componente | Font Family | Size | Weight | Letter Spacing | Transform | Color |
|---|---|---|---|---|---|---|
| Announcement bar | - | - | - | - | - | - |
| Header menu item | - | - | - | - | - | - |
| Hero title | - | - | - | - | - | - |
| ... | - | - | - | - | - | - |

#### 3.2 - Paleta de cores

Extrair cores RESOLVIDAS (não CSS variables, mas o valor hex/rgb real):

```javascript
// Cores de fundo de cada seção principal
const sections = document.querySelectorAll('section, .section, [class*="section"]');
const colors = new Set();
sections.forEach(s => {
  const bg = getComputedStyle(s).backgroundColor;
  if (bg !== 'rgba(0, 0, 0, 0)') colors.add(bg);
});

// Cores de texto dos elementos principais
const textEls = document.querySelectorAll('h1, h2, h3, p, a, button');
textEls.forEach(el => colors.add(getComputedStyle(el).color));

return [...colors];
```

Criar paleta:
| Uso | Valor HEX | RGB |
|---|---|---|
| Background principal | - | - |
| Texto principal | - | - |
| Cor de destaque (buttons, links) | - | - |
| Background do header | - | - |
| Background do footer | - | - |
| Announcement bar | - | - |

#### 3.3 - Espaçamentos e layout

```javascript
// Padding/margin das seções
const sections = [...document.querySelectorAll('main > section, main > div[class*="section"]')];
return sections.map(s => {
  const cs = getComputedStyle(s);
  return {
    className: s.className.substring(0, 60),
    paddingTop: cs.paddingTop,
    paddingBottom: cs.paddingBottom,
    maxWidth: cs.maxWidth,
    width: cs.width
  };
});
```

Documentar o max-width do container principal (geralmente `1200px`, `1440px` ou `100%`).

#### 3.4 - Componentes (botões, cards, formulários)

```javascript
const buttons = [];
document.querySelectorAll('button, a[class*="btn"], a[class*="cta"], [class*="button"]').forEach(btn => {
  const s = getComputedStyle(btn);
  buttons.push({
    text: btn.textContent.trim().substring(0, 40),
    padding: s.padding, borderRadius: s.borderRadius,
    backgroundColor: s.backgroundColor, color: s.color,
    fontSize: s.fontSize, fontWeight: s.fontWeight,
    border: s.border, textTransform: s.textTransform
  });
});
return { buttons };
```

#### Passo 3.5 — Ecossistema da Loja (apps, scripts, configurações globais)

Executar via `mcp__chrome-devtools__evaluate_script`:

```javascript
// Tema e configurações Shopify
const shopify = {
  theme: window.Shopify?.theme,
  currency: window.Shopify?.currency,
  locale: window.Shopify?.locale,
  country: window.Shopify?.country,
  modules: window.Shopify?.modules,
};

// Apps e scripts de terceiros
const scripts = [...document.querySelectorAll('script[src]')]
  .map(s => s.src)
  .filter(s => !s.includes('cdn.shopify') && !s.includes('monorail'));

// CSS externos (fontes, libs)
const cssLinks = [...document.querySelectorAll('link[rel="stylesheet"]')]
  .map(l => l.href)
  .filter(h => !h.includes('cdn.shopify'));

// Meta tags relevantes
const meta = {
  title: document.title,
  description: document.querySelector('meta[name="description"]')?.content,
  ogImage: document.querySelector('meta[property="og:image"]')?.content,
  charset: document.charset,
};

return { shopify, scripts, cssLinks, meta };
```

Registrar: tema ativo (nome + versão), apps identificados (reviews, chat, upsell, pixels), fontes CDN externas (Google Fonts, Adobe Fonts), configurações de moeda/locale.


### Passo 4 - Mapear TODAS as seções da home (detecção automática)

#### Passo 4.0 — Mapeamento via HTML fonte

Antes de usar querySelector, extrair as seções diretamente via DOM (revela seções Shopify ativas sem precisar de acesso admin):

```javascript
// Via mcp__chrome-devtools__evaluate_script na página normal:
const sections = [...document.querySelectorAll('[data-section-type], [data-section-id]')]
  .map(s => ({
    type: s.dataset.sectionType || s.dataset.type,
    id: s.dataset.sectionId || s.dataset.id,
    classes: s.className,
    childCount: s.children.length
  }));
return sections;
```

Isso revela EXATAMENTE quais seções Shopify estão ativas. Registrar o resultado antes de prosseguir para o mapeamento completo abaixo.

Este é o passo mais importante da Fase 1. Detectar automaticamente CADA seção via DOM e mapear.

**NUNCA assumir um número fixo de seções.** Usar JavaScript pra contar todas:

```javascript
// Contar TODAS as seções automaticamente
const allSections = document.querySelectorAll('main > section, main > div[class*="section"], main > div[id]');
return [...allSections].map((sec, i) => {
  const h = sec.querySelector('h2, h3');
  return {
    index: i,
    heading: h ? h.textContent.trim() : '(sem titulo)',
    classes: sec.className.substring(0, 80),
    height: getComputedStyle(sec).height,
    hasVideo: !!sec.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"]'),
    hasSlideshow: !!sec.querySelector('[class*="slide"], [class*="carousel"]'),
    hasProducts: !!sec.querySelector('[class*="product"]'),
    hasForm: !!sec.querySelector('form'),
    type: sec.className.includes('video') ? 'VIDEO' :
          sec.className.includes('slideshow') ? 'SLIDESHOW' :
          sec.className.includes('collection') ? 'FEATURED_COLLECTION' :
          sec.className.includes('testimonial') ? 'TESTIMONIALS' :
          sec.className.includes('timeline') ? 'TIMELINE' :
          sec.className.includes('shop-the-look') ? 'SHOP_THE_LOOK' :
          sec.className.includes('icon') ? 'ICONS/BENEFITS' :
          'CUSTOM'
  };
});
```

1. Executar o script acima pra obter a lista de seções.
2. Para cada seção, anotar: índice, tipo detectado, heading, e se tem elementos especiais.
3. Criar o **checklist de seções** em `06. Anexos/checklist-sections-{loja}.md`:

```markdown
| # | Tipo | Heading | Tem Equivalente Dawn | Status Construção | CSS ok | Mobile ok |
|---|------|---------|---------------------|------------------|--------|-----------|
| 0 | ANNOUNCEMENT_BAR | - | Sim (announcement-bar) | [ ] | [ ] | [ ] |
| 1 | SLIDESHOW | - | Sim (slideshow) | [ ] | [ ] | [ ] |
| 2 | FEATURED_COLLECTION | Novidades | Sim (featured-collection) | [ ] | [ ] | [ ] |
| 3 | VIDEO | - | Sim (video) | [ ] | [ ] | [ ] |
| 4 | CUSTOM | "Nossa História" | NÃO - criar custom-liquid | [ ] | [ ] | [ ] |
```

4. Para seções SEM equivalente no tema (marcadas como "NÃO - criar custom-liquid"):
   - Extrair HTML completo da seção via JavaScript
   - Extrair CSS inline e classes CSS relevantes
   - Gerar o arquivo Liquid equivalente AGORA (antes de passar pra Fase 2)
   - Salvar em `06. Anexos/sections-custom/{nome-secao}.liquid`
   - Marcar no checklist como "código gerado, aguardando push"

#### Passo 4.X — Protocolo OBRIGATÓRIO para seções com vídeo (aprendido na prática)

**Este protocolo é o que gera paridade visual real com a referência.** Executar para TODA seção que usa vídeo:

1. Extrair todas as URLs de vídeo da referência via Chrome Brain:
```javascript
const videos = [];
document.querySelectorAll('video').forEach(v => {
  if (v.src) videos.push({type: 'video', src: v.src});
  v.querySelectorAll('source').forEach(s => videos.push({type: 'source', src: s.src}));
});
return videos;
```
2. Mapear cada vídeo para a seção correspondente (hero, bento card, coluna why-choose, slider, etc.)
3. Verificar se o tema suporta vídeo nativamente nessa seção. Se não: adicionar campo `video_url` (type: text) ao schema do bloco e renderizar `<video autoplay muted loop playsinline>` com fallback para imagem. Ver R48.
4. Para seções CUSTOM criadas do zero, incluir sempre no schema de cada bloco os campos `video_url` (text) e `image` (image_picker) como par obrigatório.
5. Usar CDN da referência diretamente — sem download, sem re-upload. Ver R50.

**Seções customizadas que DEVEM ser criadas quando detectadas na referência:**

| Padrão detectado | Seção custom | Arquivo |
|---|---|---|
| Grid bento/masonry de coleções com vídeos | bw-bento-grid | sections/bw-bento-grid.liquid |
| Carrossel de vídeos estilo fan (central maior) | bw-video-slider | sections/bw-video-slider.liquid |
| 3+ colunas com vídeo/imagem + texto + botão | bw-why-choose-media | sections/bw-why-choose-media.liquid |
| Hero com vídeo background | Modificar slideshow.liquid | Adicionar campo video_url (ver R48) |

Estas seções são o maior diferencial visual. Sem elas o clone parece inferior à referência.

# CHECKPOINT FASE 1 — Reconhecimento Visual (Quality Gate ESTRITO)

**BLOQUEIO ABSOLUTO:** Cada item exige evidência (path do arquivo). Sem evidência = `[ ]` = bloqueado.

| # | Item | Evidência exigida | Status |
|---|------|-------------------|--------|
| 0a | Passo 1.5.A — Auditoria de PDP EXAUSTIVA (R92): `count(produtos auditados) == count(/products.json)`; TODAS as variantes agrupadas por fingerprint; coluna `# Produtos` somando o total; handles listados por variante (mapa handle->suffix) | `06. Anexos/audit-pdp-templates-{loja}.md` com tabela completa + soma conferida | [ ] |
| 0b | Passo 1.5.B — Auditoria de coleção: TODAS as coleções com fingerprint | `audit-collection-templates-{loja}.md` | [ ] |
| 0c | Passo 1.5.C — Auditoria de página: TODAS as páginas com fingerprint | `audit-page-templates-{loja}.md` | [ ] |
| 0d | Passo 1.5.D — Cart drawer vs cart page mapeados | nota | [ ] |
| 1 | `TEMA_ATIVO` registrado (Impact, Dawn, Horizon, Streetch, Prestige, etc) com checksum do `theme_author` | nota com author + sections exclusivas detectadas | [ ] |
| 2 | Screenshots desktop (1440) E mobile (390) de TODAS as páginas | paths `06. Anexos/clone-ref-{B*}-{P*}.png` | [ ] |
| 3 | Inventário de IMAGENS completo | `06. Anexos/inventario-imagens-{loja}.md` | [ ] |
| 4 | Inventário de COPY (Passo 2.12) completo com sha256 por linha | `06. Anexos/inventario-copy-{loja}.md` | [ ] |
| 5 | Inventário de VÍDEOS (Passo 2.13) com autoplay/loop/poster por item | `06. Anexos/inventario-videos-{loja}.md` | [ ] |
| 6 | Inventário de REVIEWS (Passo 2.14): app da ref detectada + contagem/reviews por produto + VISUAL do widget capturado (getComputedStyle + path do SVG da estrela) | `06. Anexos/inventario-reviews-{loja}.md` + `reviews-referencia-{loja}.json` + `reviews-visual-{loja}.md` + `reviews-widget-{loja}.png` | [ ] |
| 7 | Inventário de LIQUIDS/SECTIONS (Passo 2.15) com resolução por section | `06. Anexos/inventario-liquids-{loja}.md` | [ ] |
| 8 | Design system extraído: tipografia POR COMPONENTE, paleta, espaçamentos, botões | tabela no inventário do design system | [ ] |
| 9 | Sections CUSTOM: código Liquid gerado pelo especialista + `shopify theme check` sem warnings | paths dos `.liquid` em `/tmp/tema-completo/sections/` | [ ] |
| 10 | Header e footer documentados (cores, tipografia, menus, ícones SVG `d` path) | tabela em `06. Anexos/` | [ ] |
| 11 | Cada section da referência tem resolução EXISTENTE/EQUIVALENTE/CUSTOM definida (Passo 2.15) | inventário de liquids com TODAS as linhas preenchidas | [ ] |

**Gate de equivalência 1:1:**
```
count(sections na ref) === count(sections com resolução definida no inventário-liquids)
```
Se diferente → BLOQUEIO. Voltar ao Passo 4 e mapear o que faltou.

Se qualquer item estiver `[ ]` ou sem evidência → voltar ao passo correspondente. Avançar para FASE 2 sem isso é violação direta do Quality Gate G3.
