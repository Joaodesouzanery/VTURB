# Fase 2 — Construção do tema na loja destino (Passos 11-16)

> Carregado quando começa a construção do tema. Pull tema destino → settings globais → sections custom → CSS → assets → push.

---

### Passo 11 - Pull do tema da loja destino

1. Fazer pull do tema Dawn ativo:
   ```bash
   shopify theme pull --store <destino> --theme <id-tema-dawn> --path /tmp/tema-clone/
   ```

2. **Backup:** 
   ```bash
   cp -r /tmp/tema-clone/ /tmp/tema-clone-backup/
   ```
   Não modificar o backup. Usar como referência se precisar reverter.

3. Verificar a estrutura de pastas do tema:
   - `config/settings_schema.json` - Configurações disponíveis
   - `config/settings_data.json` - Valores atuais das configurações
   - `sections/` - Seções do tema
   - `templates/` - Templates de página (JSON)
   - `assets/` - CSS, JS, imagens
   - `layout/theme.liquid` - Layout principal

### Passo 12 - Configurar settings globais (cores, fontes, espaçamentos)

#### 12.0 - Settings globais de layout (ANTES das cores)

Editar `config/settings_data.json` - seção `"current"`:
```json
{
  "page_width": "1440",
  "spacing_sections": "0",
  "type_header_size": "1.0"
}
```
Ajustar `page_width` conforme o max-width do container principal detectado no Passo 3.3.

#### 12.1 - Esquema de cores (announcement bar e header SEPARADOS)

**CRÍTICO:** Announcement bar e header são seções distintas no Dawn com esquemas de cor independentes.

Verificar com JavaScript:
```javascript
// Via Chrome Brain, extrair cores separadamente
const annBar = document.querySelector('[class*="announcement"]');
const header = document.querySelector('header');
return {
  announcementBg: annBar ? getComputedStyle(annBar).backgroundColor : 'none',
  announcementText: annBar ? getComputedStyle(annBar).color : 'none',
  headerBg: header ? getComputedStyle(header).backgroundColor : 'none',
  headerText: header ? getComputedStyle(header).color : 'none'
};
```

Criar os esquemas de cor corretos em `config/settings_data.json`:
```json
{
  "colors_solid_button_labels": "#FFFFFF",
  "colors_accent_1": "#HEX_DA_COR_PRINCIPAL",
  "colors_accent_2": "#HEX_DA_COR_SECUNDARIA",
  "colors_text": "#HEX_COR_TEXTO_PRINCIPAL",
  "colors_background_1": "#HEX_BG_PRINCIPAL",
  "colors_background_2": "#HEX_BG_SECUNDARIO",
  "colors_outline_button_labels": "#HEX_COR_BORDA_BOTAO"
}
```

Color schemes personalizados (para announcement bar com cor diferente do header):
```json
{
  "scheme_1": {
    "background": "#HEX_BG_ANNOUNCEMENT",
    "text": "#HEX_TEXT_ANNOUNCEMENT"
  },
  "scheme_3": {
    "background": "#HEX_BG_HEADER",
    "text": "#HEX_TEXT_HEADER"
  }
}
```

#### 12.2 - Tipografia

Baseado na tabela extraída no Passo 3.1, configurar em `config/settings_data.json`:
```json
{
  "type_header_font": "nome_da_fonte_no_shopify:peso",
  "type_body_font": "nome_da_fonte_no_shopify:peso"
}
```

**ATENÇÃO:** Se a fonte não está na Shopify Font Library, fazer upload como asset (Passo R9).

#### 12.3 - Logo e favicon

1. Fazer upload do logo da referência (extraído no Passo 2.3) para os assets da loja destino.
2. Configurar em `config/settings_data.json`:
   ```json
   {
     "logo": "shopify://shop_images/logo.svg",
     "logo_width": 200
   }
   ```
3. Fazer upload do favicon (Passo 2.5) e configurar via Admin: Settings > Brand > Favicon.

#### 12.4 - Redes sociais

Configurar os links de redes sociais da referência em `config/settings_data.json`:
```json
{
  "social_instagram_link": "https://instagram.com/...",
  "social_facebook_link": "https://facebook.com/...",
  "social_tiktok_link": "https://tiktok.com/...",
  "social_pinterest_link": ""
}
```

### Passo 13 - Construir seções e templates

Este é o passo mais complexo da skill. Para CADA seção mapeada no Passo 4:

#### 13.1 - Seções com equivalente no Dawn

Se a seção tem equivalente no Dawn, configurar no template JSON correspondente.

Exemplo - se a referência tem um hero banner, configurar em `templates/index.json`:
```json
{
  "image_banner_XXXXX": {
    "type": "image-banner",
    "settings": {
      "image": "shopify://shop_images/<banner-image>",
      "image_overlay_opacity": 0,
      "button_label": "<texto-botao-case-exato>",
      "button_link": "<url-link>",
      "color_scheme": "scheme-3",
      "image_height": "adapt"
    }
  }
}
```
**OBRIGATÓRIO: `image_height: "adapt"`** (Regra R1). NUNCA usar "large"/"medium" - cortam a imagem.

Se a imagem do banner já tem texto embutido (comum em lojas Shopify), NÃO adicionar blocos de heading/subheading no Dawn - causa texto duplicado. Manter apenas o bloco do botão.

Pra `featured-collection`, SEMPRE usar:
```json
{
  "type": "featured-collection",
  "settings": {
    "full_width": true,
    "columns_desktop": 4,
    "enable_desktop_slider": true,
    "show_view_all": true,
    "view_all_style": "solid",
    "image_ratio": "square",
    "show_secondary_image": true,
    "quick_add": "standard",
    "columns_mobile": "2"
  }
}
```
`full_width: true` é obrigatório (Regra R3). Verificar na referência se é carousel ou grid e quantas colunas.

Repetir pra cada seção: `featured-collection`, `collection-list`, `image-with-text`, `rich-text`, `multicolumn`, `newsletter`, etc.

#### 13.2 - Seções SEM equivalente no Dawn (CUSTOM)

Quando a referência tem uma seção que o Dawn não oferece:

1. **Criar o arquivo de seção** em `/tmp/tema-clone/sections/{nome-secao}.liquid`
2. O arquivo deve conter:
   - Schema JSON (settings editáveis no admin Shopify)
   - HTML/Liquid pra renderizar a seção
   - CSS com escopo (dentro de `{% style %}` ou `<style>`)
   - JavaScript se necessário (dentro de `<script>`)

3. Estrutura padrão de uma seção customizada:
```liquid
{{ 'section-{nome}.css' | asset_url | stylesheet_tag }}

<div class="section-{nome} page-width">
  {%- comment -%} HTML da seção aqui {%- endcomment -%}
</div>

{% schema %}
{
  "name": "{Nome da Seção}",
  "tag": "section",
  "class": "section",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "{texto padrão}"
    }
  ],
  "blocks": [],
  "presets": [
    {
      "name": "{Nome da Seção}"
    }
  ]
}
{% endschema %}
```

4. **Se a seção precisa de CSS extenso**, criar arquivo separado em `assets/section-{nome}.css` em vez de inline.

5. Adicionar a seção no template JSON correspondente (ex: `templates/index.json`).

#### 13.3 - Seções especiais (frequentemente esquecidas)

Seções que temas premium tem e Dawn não, mas que DEVEM ser replicadas via custom-liquid:

**Video Section (Regra R4 - SEMPRE com altura fixa):**
- Se a referência tem um vídeo na home (autoplay, muted, loop), criar seção custom de vídeo
- Usar `aspect-ratio: 16/9` ou `height: 600px` (NUNCA `height: auto`)
- Implementar como `<video autoplay muted loop playsinline>` pra Shopify-hosted ou `<iframe>` pra YouTube/Vimeo

**Timeline/Process Steps:**
- Replicar via `multicolumn` do Dawn ou criar seção custom com ícones SVG embutidos

**Testimonials/Reviews:**
- Dawn 14.0.0 NÃO tem section de reviews/testimonials nativa
- NÃO usar app de review no destino. Construir a section custom `cs-reviews` (Passo 13.3.R) com estrelas SVG, herdando o esqueleto do `multicolumn` (grid) + a lógica de nota do block `rating`
- Reviews reais da ref entram como blocks estáticos no template JSON do PDP (Passo 22b). Visual clonado 1:1 do `06. Anexos/reviews-visual-{loja}.md`. Zero Splide / zero app (R90)

**Shop the Look:**
- Replicar via custom section com hotspots sobre imagem
- Implementar pontos clicáveis via CSS/JS absolutamente posicionados

**Before/After Image:**
- Custom section com range input pra dividir duas imagens

#### 13.3.R - Section de reviews custom (`cs-reviews`): clone visual do app, reviews estáticas, estrelas SVG

> **Princípio:** o dono NÃO quer nenhum app de review no destino. O visual do widget da ref é reconstruído como section CUSTOM `sections/cs-reviews.liquid`; as reviews reais viram blocks estáticos (embutidos no Passo 22b). Estrelas em SVG (fidelidade ao ícone do app, não caractere). Widget dinâmico (escrever/coletar/filtrar/paginar) NÃO é necessário. Ver R90.

**Base:** Dawn 14.0.0 NÃO tem section de reviews nativa. `cs-reviews` nasce CUSTOM (R56/R62), reaproveitando o grid de cards do `multicolumn` e a lógica de nota do block `rating` do `main-product`. O CSS e o SVG da estrela são copiados 1:1 do `06. Anexos/reviews-visual-{loja}.md` (Passo 2.14) — se a ref usa Loox/Judge.me/Yotpo, extrair o path do SVG real do widget e substituir o path abaixo.

**Regras Mestras:** editável no Theme Editor (settings desktop_/mobile_ + presets, Princípio 4); cada review é um block; copy sem travessão; push seguro P1-P8 (nunca `layout/theme.liquid`).

**Arquivo `sections/cs-reviews.liquid` (ajustar o `<path>` da estrela e o CSS ao `reviews-visual-{loja}.md`):**
```liquid
{%- comment -%} sections/cs-reviews.liquid — clone visual estático do widget de review da ref. Estrelas SVG. ZERO app. {%- endcomment -%}
{%- capture cs_star -%}<svg class="cs-star" viewBox="0 0 20 20" width="{{ section.settings.star_size | default: 16 }}" height="{{ section.settings.star_size | default: 16 }}" aria-hidden="true" focusable="false"><path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.8L10 15.9l-5.2 2.73.99-5.8-4.21-4.1 5.82-.85z"/></svg>{%- endcapture -%}
{%- assign total = 0 -%}{%- assign sum = 0 -%}
{%- for block in section.blocks -%}{%- if block.type == 'review' -%}{%- assign total = total | plus: 1 -%}{%- assign sum = sum | plus: block.settings.rating -%}{%- endif -%}{%- endfor -%}
{%- if total > 0 -%}{%- assign avg = sum | times: 1.0 | divided_by: total | round: 1 -%}{%- else -%}{%- assign avg = 0 -%}{%- endif -%}

<div class="cs-reviews page-width" style="--cs-star: {{ section.settings.star_color }}; --cs-star-empty: {{ section.settings.star_empty_color }};">
  {%- if section.settings.show_summary and total > 0 -%}
    <div class="cs-reviews__summary">
      {%- assign ravg = avg | round -%}
      <span class="cs-stars" aria-hidden="true">{%- for i in (1..5) -%}<span class="cs-stars__item {%- if i <= ravg %} is-full{%- endif -%}">{{ cs_star }}</span>{%- endfor -%}</span>
      <span class="cs-reviews__avg">{{ avg }}</span>
      <span class="cs-reviews__count">({{ total }} {{ section.settings.count_label }})</span>
    </div>
  {%- endif -%}
  <div class="cs-reviews__grid">
    {%- for block in section.blocks -%}{%- if block.type == 'review' -%}
      {%- assign br = block.settings.rating | round -%}
      <article class="cs-reviews__card" {{ block.shopify_attributes }}>
        <div class="cs-reviews__card-head">
          <span class="cs-stars" aria-label="{{ block.settings.rating }} de 5">{%- for i in (1..5) -%}<span class="cs-stars__item {%- if i <= br %} is-full{%- endif -%}">{{ cs_star }}</span>{%- endfor -%}</span>
          {%- if block.settings.verified -%}<span class="cs-reviews__verified">{{ section.settings.verified_label }}</span>{%- endif -%}
        </div>
        {%- if block.settings.title != blank -%}<p class="cs-reviews__title">{{ block.settings.title }}</p>{%- endif -%}
        <p class="cs-reviews__body">{{ block.settings.body }}</p>
        {%- if block.settings.images != blank -%}
          <div class="cs-reviews__photos">{%- assign imgs = block.settings.images | split: ',' -%}{%- for src in imgs -%}<img src="{{ src | strip }}" alt="Foto de {{ block.settings.author | escape }}" loading="lazy" width="80" height="80">{%- endfor -%}</div>
        {%- endif -%}
        <div class="cs-reviews__meta"><span class="cs-reviews__author">{{ block.settings.author }}</span>{%- if block.settings.date != blank -%}<span class="cs-reviews__date">{{ block.settings.date }}</span>{%- endif -%}</div>
      </article>
    {%- endif -%}{%- endfor -%}
  </div>
</div>

{%- comment -%} CSS + SVG fill clonados de 06. Anexos/reviews-visual-{loja}.md {%- endcomment -%}
{%- style -%}
  .cs-reviews__grid{display:grid;grid-template-columns:repeat({{ section.settings.columns_desktop }},1fr);gap:{{ section.settings.gap }}px;}
  .cs-stars{display:inline-flex;align-items:center;}
  .cs-stars__item .cs-star{fill:var(--cs-star-empty);display:block;}
  .cs-stars__item.is-full .cs-star{fill:var(--cs-star);}
  .cs-reviews__summary{display:flex;align-items:center;gap:8px;justify-content:{{ section.settings.summary_align }};margin-bottom:{{ section.settings.summary_gap }}px;}
  .cs-reviews__avg{font-weight:700;}
  .cs-reviews__photos{display:flex;gap:6px;margin:8px 0;}
  @media (max-width:749px){.cs-reviews__grid{grid-template-columns:repeat({{ section.settings.columns_mobile }},1fr);gap:{{ section.settings.gap_mobile }}px;}}
{%- endstyle -%}

{% schema %}
{
  "name": "Reviews (clone visual)",
  "tag": "section",
  "class": "cs-reviews-section",
  "settings": [
    {"type": "header", "content": "Cabeçalho (média + contagem)"},
    {"type": "checkbox", "id": "show_summary", "label": "Mostrar média e total no topo", "default": true},
    {"type": "text", "id": "count_label", "label": "Rótulo da contagem", "default": "avaliações"},
    {"type": "text", "id": "verified_label", "label": "Selo de verificado", "default": "Compra verificada"},
    {"type": "color", "id": "star_color", "label": "Cor da estrela cheia", "default": "#f5a623"},
    {"type": "color", "id": "star_empty_color", "label": "Cor da estrela vazia", "default": "#dddddd"},
    {"type": "range", "id": "star_size", "min": 12, "max": 28, "step": 1, "label": "Tamanho da estrela (px)", "default": 16},
    {"type": "header", "content": "Layout desktop"},
    {"type": "range", "id": "columns_desktop", "min": 1, "max": 4, "step": 1, "label": "Colunas (desktop)", "default": 3},
    {"type": "range", "id": "gap", "min": 8, "max": 48, "step": 2, "label": "Espaçamento (desktop)", "default": 24},
    {"type": "select", "id": "summary_align", "label": "Alinhamento do cabeçalho", "options": [{"value":"flex-start","label":"Esquerda"},{"value":"center","label":"Centro"}], "default": "center"},
    {"type": "range", "id": "summary_gap", "min": 0, "max": 60, "step": 4, "label": "Espaço abaixo do cabeçalho", "default": 24},
    {"type": "header", "content": "Layout mobile"},
    {"type": "range", "id": "columns_mobile", "min": 1, "max": 2, "step": 1, "label": "Colunas (mobile)", "default": 1},
    {"type": "range", "id": "gap_mobile", "min": 8, "max": 32, "step": 2, "label": "Espaçamento (mobile)", "default": 16}
  ],
  "blocks": [
    {"type": "review", "name": "Review", "settings": [
      {"type": "text", "id": "author", "label": "Autor", "default": "Cliente"},
      {"type": "range", "id": "rating", "min": 1, "max": 5, "step": 1, "label": "Nota", "default": 5},
      {"type": "text", "id": "title", "label": "Título"},
      {"type": "textarea", "id": "body", "label": "Texto da avaliação"},
      {"type": "text", "id": "date", "label": "Data (texto)"},
      {"type": "checkbox", "id": "verified", "label": "Compra verificada", "default": true},
      {"type": "textarea", "id": "images", "label": "URLs de fotos separadas por vírgula (opcional)"}
    ]}
  ],
  "presets": [{"name": "Reviews (clone visual)", "blocks": [{"type": "review"}, {"type": "review"}, {"type": "review"}]}]
}
{% endschema %}
```

**Validação:** `shopify theme check --path /tmp/tema-completo --only sections/cs-reviews.liquid` sem warnings. As reviews reais viram blocks no Passo 22b (fase-3), não aqui.


#### 13.3.C - Countdown de urgência custom (`cs-countdown`): clone visual, reset meia-noite local

> **Princípio:** urgência sem app. O visual do timer da ref vira snippet custom; a lógica reseta à meia-noite LOCAL do visitante (perpétuo honesto, formato HH:MM:SS). Ver R91.

**Detecção (Passo 2.14):** registrar em `06. Anexos/countdown-visual-{loja}.md` o rótulo ("Oferta acaba em"), tipografia dos dígitos, cores, separadores, screenshot desktop + mobile.

**Snippet `snippets/cs-countdown.liquid`:**
```liquid
{%- comment -%} cs-countdown — urgência sem app, reset à meia-noite local. R91. {%- endcomment -%}
<div class="cs-countdown" data-cs-countdown style="--cs-cd-fg: {{ cd_fg | default: '#111' }}; --cs-cd-accent: {{ cd_accent | default: '#e23' }};">
  {%- if cd_label != blank -%}<span class="cs-countdown__label">{{ cd_label }}</span>{%- endif -%}
  <span class="cs-countdown__clock"><span data-h>00</span><span class="cs-countdown__sep">:</span><span data-m>00</span><span class="cs-countdown__sep">:</span><span data-s>00</span></span>
</div>
{%- style -%}
  .cs-countdown{display:inline-flex;align-items:center;gap:8px;color:var(--cs-cd-fg);font-variant-numeric:tabular-nums;}
  .cs-countdown__clock{font-weight:700;color:var(--cs-cd-accent);letter-spacing:1px;}
{%- endstyle -%}
<script src="{{ 'cs-countdown.js' | asset_url }}" defer></script>
```

**Asset `assets/cs-countdown.js` (reset à meia-noite LOCAL, perpétuo, HH:MM:SS):**
```javascript
(function () {
  function proximaMeiaNoite(){ var a=new Date(); a.setHours(24,0,0,0); return a; } // 00:00 do dia seguinte, fuso LOCAL
  function pad(v){ return String(v).padStart(2,'0'); }
  function tick(el){
    var diff = proximaMeiaNoite() - new Date(); if (diff < 0) diff = 0;
    var h=Math.floor(diff/3600000), m=Math.floor((diff%3600000)/60000), s=Math.floor((diff%60000)/1000);
    var qh=el.querySelector('[data-h]'), qm=el.querySelector('[data-m]'), qs=el.querySelector('[data-s]');
    if(qh)qh.textContent=pad(h); if(qm)qm.textContent=pad(m); if(qs)qs.textContent=pad(s);
  }
  document.querySelectorAll('[data-cs-countdown]').forEach(function(el){ tick(el); setInterval(function(){tick(el);},1000); });
})();
```

**Uso:** `{% render 'cs-countdown', cd_label: 'Oferta acaba em', cd_accent: '#e23' %}` onde a ref mostra o timer. Validar com `shopify theme check` + conferir o rollover perto da meia-noite (mudar o fuso no DevTools). NUNCA data fixa.


#### 13.4 - Product page templates (multi-variante — Princípio 2)

> **NON-NEGOTIABLE (R92) — iterar sobre TODAS as variantes detectadas no Passo 1.5.A, sem exceção.** Cada fingerprint distinto recebe OBRIGATORIAMENTE seu `templates/product.{suffix}.json` (uma variante vira default sem suffix; demais viram `product.bento.json`, `product.chapter.json`, etc).
>
> **Gate de construção (bloqueio):** `count(product.{suffix}.json criados) === count(variantes na tabela do audit-pdp-templates-{loja}.md)`. Variante detectada e não construída = produtos daquele grupo caindo no template errado quando o Passo 17 atribuir o `templateSuffix`.

Mapeamento típico após auditoria:

| Variante | Fingerprint sample | Arquivo destino | Sections principais |
|---|---|---|---|
| A (default) | aquilon | `templates/product.json` | main-product + featured-collection + related-products |
| B | bento-watch | `templates/product.bento.json` | main-product + bw-bento-grid + bw-video-slider + related-products |
| C | chapter-watch | `templates/product.chapter.json` | main-product + sticky-atc + pdp-chapter-principle + pdp-chapter-decision + related-products |

Após criar todos os templates, atribuir o `templateSuffix` correto em cada produto via mutation `productUpdate` (Passo 17):
```graphql
mutation { productUpdate(input: { id: "gid://shopify/Product/X", templateSuffix: "bento" }) { product { templateSuffix } } }
```

Para cada template detectado, configurar:

1. **Layout principal**: configurar o bloco de mídia (esquerda) e detalhes (direita)
2. **Blocos obrigatórios** (verificar order visual na referência):
   - `title` - Título do produto
   - `price` - Preço e compare-at-price
   - `variant_picker` - Seletores de variante (dropdown ou botões)
   - `quantity_selector` - Quantidade
   - `buy_buttons` - Add to Cart + Dynamic checkout
   - `description` - Descrição do produto
3. **Blocos opcionais** (adicionar se a referência tiver):
   - `share` - Botão de compartilhar
   - `collapsible_tab` - Tabs dobráveis (tamanhos, materiais, detalhes)
4. **Configurações de mídia**: gallery position (thumbnail_position: left, right, bottom), image_ratio (adapt, square)

Exemplo de `templates/product.json` mínimo:
```json
{
  "sections": {
    "main": {
      "type": "main-product",
      "blocks": {
        "vendor": {"type": "text", "settings": {"text": "{{ product.vendor }}"}},
        "title": {"type": "title"},
        "price": {"type": "price"},
        "variant_picker": {"type": "variant_picker", "settings": {"picker_type": "button"}},
        "quantity_selector": {"type": "quantity_selector"},
        "buy_buttons": {"type": "buy_buttons"},
        "description": {"type": "description"}
      },
      "block_order": ["vendor", "title", "price", "variant_picker", "quantity_selector", "buy_buttons", "description"],
      "settings": {
        "gallery_layout": "thumbnail_slider",
        "media_position": "left",
        "thumbnail_position": "bottom",
        "image_ratio": "adapt"
      }
    }
  }
}
```

#### 13.4b - Collection page templates (multi-variante — Princípio 2)

> **Iterar sobre TODAS as variantes detectadas no Passo 1.5.B.** Default vira `templates/collection.json`. Demais viram `templates/collection.{suffix}.json` e a coleção recebe `templateSuffix` correspondente via `collectionUpdate`.

Configurar em cada template:
- Número de colunas via section settings `desktop_columns` / `mobile_columns` (regra 19)
- Filtros habilitados (`enable_filtering: true`) se a ref usa
- Sort habilitado (`enable_sorting: true`) se a ref usa
- Paginação ou infinite scroll
- Card de produto: image ratio, quick add, secondary image hover

#### 13.4b.1 - Section "Contexto da Oferta" no topo da coleção (DEFAULT em toda clonagem)

> **NON-NEGOTIABLE:** toda página de coleção nasce com a section `cs-offer-context.liquid` adicionada no topo do `templates/collection.json` ANTES da grid de produtos. A section vem desabilitada visualmente até o usuário preencher dois campos no Theme Editor — `brand_name` e `offer_story`. Sem preencher, ela renderiza placeholder visível só no admin (oculta na storefront via `section.settings.brand_name == blank`).

**Por que default:** padroniza o storytelling de toda promoção. O usuário só preenche a história quando vai rodar uma oferta. Quando vazia, não polui a storefront (early-return Liquid). Quando preenchida, vira o hero da página de coleção.

**Arquivo a criar** em `/tmp/tema-clone/sections/cs-offer-context.liquid`:

```liquid
{%- liquid
  assign brand_name = section.settings.brand_name | strip
  assign offer_tagline = section.settings.offer_tagline | strip
  assign offer_story = section.settings.offer_story | strip
  if brand_name == blank
    assign show_section = false
  else
    assign show_section = true
  endif
-%}

{% if show_section or request.design_mode %}
<section
  id="cs-offer-{{ section.id }}"
  class="cs-offer-context color-{{ section.settings.color_scheme }}"
  data-empty="{% unless show_section %}true{% endunless %}"
>
  <div class="cs-offer-context__inner page-width">
    {% if section.settings.eyebrow != blank %}
      <span class="cs-offer-context__eyebrow">{{ section.settings.eyebrow }}</span>
    {% endif %}

    <h2 class="cs-offer-context__brand">
      {%- if show_section -%}
        {{ brand_name | escape }}
      {%- else -%}
        [sua marca]
      {%- endif -%}
    </h2>

    {% if offer_tagline != blank or request.design_mode %}
      <p class="cs-offer-context__tagline">
        {%- if offer_tagline != blank -%}
          {{ offer_tagline | escape }}
        {%- else -%}
          [escreva uma tagline curta, ex: "For 31 years, he made every watch by hand."]
        {%- endif -%}
      </p>
    {% endif %}

    <div class="cs-offer-context__grid">
      <div class="cs-offer-context__story">
        {%- if offer_story != blank -%}
          {{ offer_story | newline_to_br }}
        {%- else -%}
          <em>[escreva uma breve história justificando o motivo da oferta — ex: liquidação final, despedida, mudança de coleção, fechamento de loja]</em>
        {%- endif -%}

        {% if section.settings.bullets != blank %}
          <ul class="cs-offer-context__bullets">
            {% assign bullets = section.settings.bullets | split: '|' %}
            {% for b in bullets %}
              <li>{{ b | strip | escape }}</li>
            {% endfor %}
          </ul>
        {% endif %}

        {% if section.settings.cta_label != blank %}
          <p class="cs-offer-context__closing">{{ section.settings.cta_label | escape }}</p>
        {% endif %}
      </div>

      {% if section.settings.show_discount_tiers %}
        <aside class="cs-offer-context__tiers" aria-label="{{ section.settings.tiers_heading | default: 'Buy more, save even more' }}">
          <header class="cs-offer-context__tiers-head">
            <strong>{{ section.settings.tiers_heading | default: 'BUY MORE, SAVE EVEN MORE' }}</strong>
            {% if section.settings.tiers_subheading != blank %}
              <span>{{ section.settings.tiers_subheading }}</span>
            {% endif %}
          </header>
          <div class="cs-offer-context__tiers-grid">
            {% assign tiers = section.settings.tiers_csv | default: '2 pcs|+20%|EXTRA OFF,3 pcs|+25%|EXTRA OFF,4+ pcs|+30%|EXTRA OFF' | split: ',' %}
            {% for tier in tiers %}
              {% assign parts = tier | split: '|' %}
              <div class="cs-offer-context__tier {% if forloop.last %}cs-offer-context__tier--highlight{% endif %}">
                <span class="cs-offer-context__tier-qty">{{ parts[0] | strip | escape }}</span>
                <span class="cs-offer-context__tier-discount">{{ parts[1] | strip | escape }}</span>
                <span class="cs-offer-context__tier-label">{{ parts[2] | strip | escape }}</span>
              </div>
            {% endfor %}
          </div>
          {% if section.settings.tiers_footnote != blank %}
            <small class="cs-offer-context__tiers-foot">{{ section.settings.tiers_footnote | escape }}</small>
          {% endif %}
        </aside>
      {% endif %}
    </div>
  </div>
</section>
{% endif %}

{% style %}
  .cs-offer-context { padding: var(--cs-offer-pad-y, 7rem) 0; background: rgb(var(--color-background)); color: rgb(var(--color-foreground)); }
  .cs-offer-context__inner { display: grid; gap: 2rem; }
  .cs-offer-context__eyebrow { display: inline-block; padding: .6rem 1.2rem; background: rgb(var(--color-foreground)); color: rgb(var(--color-background)); font-size: 1.2rem; letter-spacing: .12em; text-transform: uppercase; justify-self: center; }
  .cs-offer-context__brand { font-size: clamp(3.2rem, 5vw, 5.4rem); text-align: center; margin: 1rem 0 0; letter-spacing: .04em; }
  .cs-offer-context__tagline { text-align: center; opacity: .7; font-style: italic; margin: 0 0 3rem; }
  .cs-offer-context__grid { display: grid; grid-template-columns: 1fr; gap: 4rem; align-items: start; }
  @media (min-width: 990px) { .cs-offer-context__grid { grid-template-columns: 1.1fr 1fr; gap: 6rem; } }
  .cs-offer-context__story p, .cs-offer-context__story em { line-height: 1.7; font-size: 1.6rem; }
  .cs-offer-context__bullets { list-style: none; padding: 0; margin: 2rem 0; }
  .cs-offer-context__bullets li { padding-left: 2.4rem; position: relative; margin-bottom: 1rem; }
  .cs-offer-context__bullets li::before { content: "\2713"; position: absolute; left: 0; font-weight: bold; }
  .cs-offer-context__closing { margin-top: 2.4rem; padding-bottom: .8rem; border-bottom: 1px solid rgb(var(--color-foreground)); display: inline-block; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; font-size: 1.3rem; }
  .cs-offer-context__tiers { background: rgba(var(--color-foreground), .03); border: 1px solid rgba(var(--color-foreground), .12); border-radius: 1.2rem; padding: 3rem; }
  .cs-offer-context__tiers-head { text-align: center; margin-bottom: 2.4rem; }
  .cs-offer-context__tiers-head strong { display: block; font-size: 1.4rem; letter-spacing: .12em; text-transform: uppercase; margin-bottom: .6rem; }
  .cs-offer-context__tiers-head span { font-size: 1.2rem; opacity: .7; }
  .cs-offer-context__tiers-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  .cs-offer-context__tier { display: flex; flex-direction: column; align-items: center; padding: 1.6rem .8rem; border: 1px solid rgba(var(--color-foreground), .15); border-radius: .8rem; text-align: center; }
  .cs-offer-context__tier-qty { font-size: 1.1rem; letter-spacing: .1em; opacity: .7; text-transform: uppercase; }
  .cs-offer-context__tier-discount { font-size: 2.4rem; font-weight: 700; margin: .4rem 0; }
  .cs-offer-context__tier-label { font-size: 1rem; letter-spacing: .1em; opacity: .7; text-transform: uppercase; }
  .cs-offer-context__tier--highlight { background: rgb(var(--color-foreground)); color: rgb(var(--color-background)); border-color: rgb(var(--color-foreground)); }
  .cs-offer-context__tiers-foot { display: block; text-align: center; margin-top: 1.4rem; font-size: 1.05rem; letter-spacing: .08em; opacity: .6; text-transform: uppercase; }
  [data-empty="true"] { outline: 2px dashed rgba(var(--color-foreground), .35); outline-offset: -16px; }
  @media (max-width: 749px) {
    .cs-offer-context { padding: var(--cs-offer-pad-y-mobile, 4rem) 0; }
    .cs-offer-context__tiers { padding: 2rem; }
    .cs-offer-context__tiers-grid { grid-template-columns: 1fr; }
  }
{% endstyle %}

{% schema %}
{
  "name": "Contexto da oferta",
  "tag": "section",
  "class": "section section--offer-context",
  "settings": [
    { "type": "header", "content": "Conteúdo da oferta" },
    { "type": "text",     "id": "eyebrow",         "label": "Eyebrow (badge superior)", "default": "FINAL LIQUIDATION" },
    { "type": "text",     "id": "brand_name",      "label": "Nome da marca",            "info": "Preencher pra ativar a section. Vazio = section oculta na storefront.", "default": "[sua marca]" },
    { "type": "text",     "id": "offer_tagline",   "label": "Tagline curta (1 frase)",  "default": "[escreva uma tagline curta]" },
    { "type": "textarea", "id": "offer_story",     "label": "História da oferta",       "info": "Por que essa oferta existe. Vai aparecer como parágrafo principal.", "default": "[escreva uma breve história justificando o motivo da oferta]" },
    { "type": "text",     "id": "bullets",         "label": "Bullets (separar por |)",  "default": "80% OFF, entire collection|Final units. No restocks. Ever.|Buy more, save even more, extra volume discount at checkout" },
    { "type": "text",     "id": "cta_label",       "label": "Linha de fechamento",      "default": "WHEN THE LAST UNIT SHIPS, THE OFFER ENDS PERMANENTLY." },

    { "type": "header", "content": "Painel de descontos progressivos (opcional)" },
    { "type": "checkbox", "id": "show_discount_tiers", "label": "Mostrar painel de tiers",            "default": true },
    { "type": "text",     "id": "tiers_heading",      "label": "Heading do painel",                  "default": "BUY MORE, SAVE EVEN MORE" },
    { "type": "text",     "id": "tiers_subheading",   "label": "Subheading do painel",               "default": "All prices already reflect the base discount, buy more to unlock an extra discount on top." },
    { "type": "text",     "id": "tiers_csv",          "label": "Tiers (qtd|desconto|label, separados por vírgula)", "info": "Ex: 2 pcs|+20%|EXTRA OFF,3 pcs|+25%|EXTRA OFF,4+ pcs|+30%|EXTRA OFF. Último tier vira destaque.", "default": "2 pcs|+20%|EXTRA OFF,3 pcs|+25%|EXTRA OFF,4+ pcs|+30%|EXTRA OFF" },
    { "type": "text",     "id": "tiers_footnote",     "label": "Rodapé do painel",                   "default": "*Applied automatically at checkout on top of base discount" },

    { "type": "header", "content": "Cores" },
    { "type": "color_scheme", "id": "color_scheme", "label": "Esquema de cor (usa tokens da marca)", "default": "scheme-1" }
  ],
  "presets": [
    { "name": "Contexto da oferta", "category": "Collection" }
  ],
  "enabled_on": { "templates": ["collection"] }
}
{% endschema %}
```

**Inserir no template** `templates/collection.json` (e em cada `templates/collection.{suffix}.json`) ANTES do bloco `main`:

```json
{
  "sections": {
    "offer_context": {
      "type": "cs-offer-context",
      "settings": {
        "brand_name": "",
        "offer_tagline": "",
        "offer_story": "",
        "show_discount_tiers": true
      }
    },
    "banner": { "type": "main-collection-banner", "settings": {} },
    "product-grid": { "type": "main-collection-product-grid", "settings": { "products_per_page": 16 } }
  },
  "order": ["offer_context", "banner", "product-grid"]
}
```

> **Quality Gate adicional (G1):** após push, verificar `https://{loja}/collections/{handle}` numa aba anônima. A section `cs-offer-context` deve estar VISIVELMENTE OCULTA (zero altura, zero conteúdo) porque `brand_name` está vazio. Só no Theme Editor (`?preview_theme_id=X`) ela aparece com outline tracejado + placeholders. Se a section vazar pra storefront → bug no early-return, corrigir antes de avançar.

#### 13.4d - Page templates (multi-variante — Princípio 2)

> **Iterar sobre TODAS as variantes detectadas no Passo 1.5.C.** `pages/about` com hero único vira `templates/page.about.json` enquanto `pages/contact` com formulário vira `templates/page.contact.json`. Atribuir `templateSuffix` em cada página via `pageUpdate`.

#### 13.4c - Cart drawer template

Se a referência usa cart drawer (não cart page), verificar se está habilitado em `config/settings_data.json`:
```json
{
  "cart_type": "drawer"
}
```

Configurar `sections/cart-drawer.liquid` se precisar de customizações.

#### 13.5 - Montar os templates de TODAS as páginas

Para CADA página no site de referência, criar/atualizar o template JSON correspondente:
- `templates/index.json` - Home
- `templates/collection.json` - Coleção (padrão)
- `templates/product.json` - Produto
- `templates/page.json` - Páginas genéricas
- `templates/blog.json` - Blog
- `templates/article.json` - Artigo do blog
- `templates/cart.json` - Carrinho (se não usar drawer)

Para páginas com layout especial (ex: about com hero próprio), criar template alternativo: `templates/page.about.json`.

#### 13.5b - Header e footer (com cor correta)

Configurar `sections/header.liquid` e `sections/footer.liquid` via `config/settings_data.json`:

```json
{
  "header_menu": "main-menu",
  "header_color_scheme": "scheme-3",
  "sticky_header_type": "on-scroll-up",
  "footer_color_scheme": "scheme-2"
}
```

Verificar se o header usa transparência sobre o hero (overlay):
```json
{
  "enable_transparent_header": true
}
```

#### 13.6 - Cart drawer

Se a referência tem cart drawer customizado (cor diferente, layout diferente):
- Editar `sections/cart-drawer.liquid`
- Ajustar CSS em `assets/component-cart-drawer.css` ou em `custom.css`

#### 13.6b - Carrinho com desconto progressivo (OPCIONAL)

> **Gatilho:** ativar APENAS quando o usuário pedir desconto progressivo no carrinho (frases tipo "põe desconto progressivo no carrinho", "buy 2 get X% off", "barra de progresso pra desconto", "volume discount no cart"). NUNCA ativar por default — modifica o checkout flow e exige Shopify Function/Script ou Discount Code.
>
> **Princípio Mestre (regra 19):** o bloco vira `snippet` `cs-cart-progressive-discount.liquid` chamado de DENTRO do `cart-drawer.liquid` E `cart.liquid` (ambos), com settings duplicados desktop/mobile no schema da section pai. NÃO duplicar markup.

**Quando ativar perguntar ao usuário UMA mensagem:**

> "Posso configurar o carrinho com desconto progressivo (tipo `add 1 more to unlock 20% off` + tabela de tiers). Confirma os tiers? Default: 2 pcs → 20%, 3 pcs → 25%, 4+ pcs → 30%. Pode mudar quantidades/percentuais ou usar valor fixo (R$)."

Aguardar a resposta antes de gerar o código. Após confirmar, criar:

**1. Snippet** `/tmp/tema-clone/snippets/cs-cart-progressive-discount.liquid`:

```liquid
{%- comment -%}
  Renderiza barra de progresso + grid de tiers de desconto no cart drawer / cart page.
  Usa só tokens da marca (rgb(var(--color-foreground|background)) + color schemes do tema).
  Lê tiers de section.settings.tiers_csv (ou do bloco pai via tiers_csv passado como arg).

  Args opcionais:
  - tiers_csv (string)   default = section.settings.tiers_csv
  - heading_blocked      default = "Add {n} more to unlock {pct} off"
  - heading_unlocked     default = "You unlocked {pct} off"
  - mode                 "qty" (default) | "amount" — gatilho do tier por quantidade ou valor
-%}
{%- liquid
  assign raw_tiers = tiers_csv | default: section.settings.tiers_csv | default: '2|20,3|25,4|30'
  assign mode = mode | default: section.settings.cs_cart_mode | default: 'qty'
  assign cart_total_qty = cart.item_count
  assign cart_total_amt = cart.total_price
  assign tiers_list = raw_tiers | split: ','
  assign current_pct = 0
  assign next_threshold = 0
  assign next_pct = 0
  for tier in tiers_list
    assign parts = tier | split: '|'
    assign threshold = parts[0] | strip | times: 1
    assign pct = parts[1] | strip | times: 1
    if mode == 'amount'
      assign threshold_value = threshold | times: 100
      if cart_total_amt >= threshold_value
        assign current_pct = pct
      else
        if next_threshold == 0
          assign next_threshold = threshold
          assign next_pct = pct
        endif
      endif
    else
      if cart_total_qty >= threshold
        assign current_pct = pct
      else
        if next_threshold == 0
          assign next_threshold = threshold
          assign next_pct = pct
        endif
      endif
    endif
  endfor

  if mode == 'amount'
    assign remaining_raw = next_threshold | times: 100 | minus: cart_total_amt
    if remaining_raw < 0
      assign remaining_raw = 0
    endif
    assign remaining_label = remaining_raw | money_without_trailing_zeros
  else
    assign remaining_qty = next_threshold | minus: cart_total_qty
    if remaining_qty < 0
      assign remaining_qty = 0
    endif
    assign remaining_label = remaining_qty | append: ' more'
  endif

  comment
    Progresso linear até o próximo tier. Quando ultrapassa o último, fica 100%.
  endcomment
  if next_threshold == 0
    assign progress_pct = 100
  else
    if mode == 'amount'
      assign progress_pct = cart_total_amt | times: 100 | divided_by: next_threshold | divided_by: 100
    else
      assign progress_pct = cart_total_qty | times: 100 | divided_by: next_threshold
    endif
    if progress_pct > 100
      assign progress_pct = 100
    endif
  endif
-%}

<div class="cs-cart-discount color-{{ section.settings.cs_color_scheme | default: 'scheme-2' }}" data-cs-cart-discount>
  <p class="cs-cart-discount__headline">
    {%- if current_pct > 0 and next_threshold == 0 -%}
      You unlocked <strong>{{ current_pct }}% off</strong>
    {%- elsif next_threshold > 0 -%}
      Add <strong>{{ remaining_label }}</strong> to unlock <strong class="cs-cart-discount__pct">{{ next_pct }}% off</strong>
    {%- else -%}
      Start adding items to unlock discounts
    {%- endif -%}
  </p>

  <div class="cs-cart-discount__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="{{ progress_pct }}">
    <span class="cs-cart-discount__bar-fill" style="width: {{ progress_pct }}%"></span>
  </div>

  <div class="cs-cart-discount__tiers">
    {% for tier in tiers_list %}
      {%- assign parts = tier | split: '|' -%}
      {%- assign t_threshold = parts[0] | strip | times: 1 -%}
      {%- assign t_pct = parts[1] | strip | times: 1 -%}
      {%- assign reached = false -%}
      {%- if mode == 'amount' -%}
        {%- assign t_value = t_threshold | times: 100 -%}
        {%- if cart_total_amt >= t_value -%}{%- assign reached = true -%}{%- endif -%}
      {%- else -%}
        {%- if cart_total_qty >= t_threshold -%}{%- assign reached = true -%}{%- endif -%}
      {%- endif -%}
      <div class="cs-cart-discount__tier {% if reached %}is-reached{% endif %}" aria-label="Tier {{ t_threshold }}">
        <span class="cs-cart-discount__tier-qty">
          {%- if mode == 'amount' -%}
            {{ t_threshold | times: 100 | money_without_trailing_zeros }}+
          {%- else -%}
            {{ t_threshold }}{%- if forloop.last %}+{% endif %} pcs
          {%- endif -%}
        </span>
        <span class="cs-cart-discount__tier-pct">-{{ t_pct }}%</span>
      </div>
    {% endfor %}
  </div>
</div>
```

**2. CSS** — adicionar em `/tmp/tema-clone/assets/cs-cart-discount.css` (referenciar via `stylesheet_tag` no `cart-drawer.liquid` e `main-cart-items.liquid`):

```css
.cs-cart-discount {
  --cs-cd-radius: 1.2rem;
  --cs-cd-fg: rgb(var(--color-foreground));
  --cs-cd-bg: rgb(var(--color-background));
  --cs-cd-accent: rgb(var(--color-button));
  --cs-cd-accent-text: rgb(var(--color-button-text));
  --cs-cd-track: rgba(var(--color-foreground), .15);

  background: var(--cs-cd-fg);
  color: var(--cs-cd-bg);
  border-radius: var(--cs-cd-radius);
  padding: 1.6rem;
  margin: 1.2rem 0 2rem;
  font-size: 1.4rem;
  line-height: 1.4;
}
.cs-cart-discount__headline { margin: 0 0 1rem; font-weight: 500; }
.cs-cart-discount__headline strong { font-weight: 700; }
.cs-cart-discount__pct { color: var(--cs-cd-accent); }
.cs-cart-discount__bar { height: .5rem; background: rgba(var(--color-background), .2); border-radius: 999px; overflow: hidden; margin: 0 0 1.4rem; }
.cs-cart-discount__bar-fill { display: block; height: 100%; background: var(--cs-cd-accent); border-radius: 999px; transition: width .35s ease; }
.cs-cart-discount__tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: .8rem; }
.cs-cart-discount__tier { display: flex; flex-direction: column; align-items: center; padding: 1rem .6rem; border: 1px solid rgba(var(--color-background), .25); border-radius: .8rem; text-align: center; transition: all .2s ease; }
.cs-cart-discount__tier-qty { font-size: 1.4rem; font-weight: 700; letter-spacing: .02em; }
.cs-cart-discount__tier-pct { font-size: 1.2rem; opacity: .8; margin-top: .2rem; }
.cs-cart-discount__tier.is-reached { background: var(--cs-cd-accent); color: var(--cs-cd-accent-text); border-color: var(--cs-cd-accent); }
@media (max-width: 749px) {
  .cs-cart-discount { padding: 1.2rem; font-size: 1.3rem; }
  .cs-cart-discount__tiers { gap: .6rem; }
  .cs-cart-discount__tier { padding: .8rem .4rem; }
}
```

**3. Plug nas sections existentes do Dawn:**

| Arquivo | Onde plugar | Como |
|---|---|---|
| `sections/cart-drawer.liquid` | Logo após `<div class="drawer__inner-empty">` block close, ANTES do `<form>` de items | `{% render 'cs-cart-progressive-discount' %}` |
| `sections/main-cart-items.liquid` (cart page) | Topo do `<div class="cart__items">`, antes da `<table>` | `{% render 'cs-cart-progressive-discount' %}` |

Adicionar no schema dessas DUAS sections (`{% schema %}`):

```json
{ "type": "header", "content": "Desconto progressivo" },
{ "type": "checkbox", "id": "cs_cart_discount_enabled", "label": "Ativar barra de desconto progressivo", "default": true },
{ "type": "select", "id": "cs_cart_mode", "label": "Gatilho do tier", "options": [
  { "value": "qty", "label": "Quantidade de itens" },
  { "value": "amount", "label": "Valor do carrinho" }
], "default": "qty" },
{ "type": "text", "id": "tiers_csv", "label": "Tiers (limite|% desconto, separados por vírgula)", "info": "Ex qty: 2|20,3|25,4|30 — Ex amount: 100|10,200|15,300|20 (valores em moeda inteira)", "default": "2|20,3|25,4|30" },
{ "type": "color_scheme", "id": "cs_color_scheme", "label": "Esquema de cor do bloco", "default": "scheme-2" }
```

E proteger o `{% render %}` com:

```liquid
{% if section.settings.cs_cart_discount_enabled %}
  {{ 'cs-cart-discount.css' | asset_url | stylesheet_tag }}
  {% render 'cs-cart-progressive-discount' %}
{% endif %}
```

**4. Atualização dinâmica no drawer (CRÍTICO):** o cart-drawer do Dawn recarrega via `fetch /?section_id=cart-drawer` ao adicionar item. O snippet recalcula via Liquid no servidor, então atualiza sozinho a cada change. **Validação obrigatória:**

```js
// Em /tmp/tema-clone/assets/cs-cart-discount.js (carregar via cart-drawer.liquid):
document.addEventListener('cart:updated', () => {
  const drawer = document.querySelector('cart-drawer, cart-items');
  if (!drawer) return;
  // Dawn já dispara re-render do section_id quando publishCartUpdate dispara.
  // Esse listener é só pra emitir telemetria/log se precisar debugar.
  console.debug('[cs-cart-discount] cart updated', drawer.dataset.cartCount);
});
```

**5. Como o desconto vira REAL no checkout (NON-NEGOTIABLE):**

A barra é só UI. O desconto efetivo precisa de UMA das opções abaixo, perguntar ao usuário antes de pushar:

| Opção | Trigger | Setup |
|---|---|---|
| **A. Discount Code automático** (mais simples) | Aplicar automaticamente via `/discount/{code}` redirect ou app de auto-apply | Criar `DiscountAutomaticBxgyCreate` ou `DiscountAutomaticBasicCreate` via Admin GraphQL com tiers correspondentes |
| **B. Shopify Function (Cart Transform)** | Plus only | Subir Function `cart_transform` que aplica desconto on-the-fly ao adicionar quantidade |
| **C. App de progressive discount** (Bold, Discounty, etc) | Qualquer plano | Apontar pra app e desabilitar tiers da função do tema |

Default: criar **DiscountAutomaticBasic** com mesmas thresholds via mutation no Passo 22:

```graphql
mutation discountAutomaticBasicCreate($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
  discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) {
    automaticDiscountNode { id }
    userErrors { field message }
  }
}
```

Cada tier vira UMA discount automática separada (mesma loja pode ter as 3 ativas simultaneamente — Shopify aplica a melhor). Documentar IDs criados no relatório final.

**6. Quality Gate adicional (G1) pro cart progressive discount:**

- [ ] Snippet `cs-cart-progressive-discount.liquid` salvo
- [ ] CSS `cs-cart-discount.css` salvo e referenciado
- [ ] Setting `cs_cart_discount_enabled` adicionado nos schemas de `cart-drawer.liquid` E `main-cart-items.liquid`
- [ ] Render protegido por `{% if section.settings.cs_cart_discount_enabled %}` em AMBAS sections
- [ ] Discount automático (opção A) ou Function (B) ou app (C) confirmado pelo usuário
- [ ] Cart drawer aberto em aba anônima mostra: barra + tiers + headline "Add N more to unlock X% off"
- [ ] Adicionar item via JS dispara re-render correto (qty + pct + bar width atualizam)
- [ ] Tier alcançado fica destacado com `--color-button`/`--color-button-text` (cores da marca)
- [ ] Mobile (390px): tiers grid mantém legibilidade (gap ajustado)

Anti-pattern: hardcode de cor hex no CSS desse bloco. SEMPRE usar `rgb(var(--color-*))` pra herdar tokens do tema clonado.

#### 13.7 - Mobile menu

O menu mobile do Dawn é um drawer que abre da esquerda. Se a referência tem um estilo diferente:
- Editar `sections/header.liquid` pra ajustar o mobile menu
- Adicionar CSS mobile-specific em `custom.css`
- Ajustar tipografia, cores, espaçamento do menu mobile


---

### 🔁 LOOP DE COMPARAÇÃO VISUAL — Obrigatório após cada seção (Fase 3)

**Este loop deve ser executado após construir e fazer push de CADA seção do Passo 13.**

#### Loop: Comparação Visual por Seção

Após construir e fazer push de CADA seção:

**1. Screenshot da referência** (página correspondente):
- `mcp__chrome-devtools__select_page` → selecionar aba da referência
- `mcp__chrome-devtools__resize_page` → `{width: 1440, height: 900}`
- Rolar até a seção construída via `mcp__chrome-devtools__evaluate_script` com `window.scrollTo(0, Y)`
- `mcp__chrome-devtools__take_screenshot` → capturar (desktop)
- `mcp__chrome-devtools__resize_page` → `{width: 390, height: 844}`
- `mcp__chrome-devtools__take_screenshot` → capturar (mobile)

**2. Screenshot da loja destino** (mesma página):
- `mcp__chrome-devtools__select_page` → selecionar aba da loja destino
- `mcp__chrome-devtools__resize_page` → `{width: 1440, height: 900}`
- Rolar até a seção equivalente
- `mcp__chrome-devtools__take_screenshot` → capturar (desktop)
- `mcp__chrome-devtools__resize_page` → `{width: 390, height: 844}`
- `mcp__chrome-devtools__take_screenshot` → capturar (mobile)

**3. Comparação lado a lado** — avaliar as 4 dimensões:

| Dimensão | Tolerância | Status |
|---|---|---|
| Layout / estrutura geral | Equivalente (±10%) | [ ] |
| Tipografia (família, peso, tamanho) | Deve bater | [ ] |
| Paleta de cores | Deve bater | [ ] |
| Espaçamentos e proporções | ±15px desktop, ±8px mobile | [ ] |

**4. Decisão**:
- ✅ Todos os 4 itens aprovados → registrar `[x] CSS ok` no checklist-sections e prosseguir para próxima seção
- ❌ Qualquer item reprovado → **CORRIGIR AGORA** antes de avançar:
  - Identificar diferença específica
  - Ajustar CSS/settings/Liquid
  - Push novamente (com verificação pós-push obrigatória)
  - Repetir comparação
  - **NÃO passar para próxima seção com diff pendente**

**5. Registro no checklist-sections**:
Atualizar `06. Anexos/checklist-sections-{loja}.md`:
```
| NomeSeção | [x] Construída | [x] CSS ok | [x] Mobile ok | ✅ Comparação aprovada |
```


### Passo 14 - CSS customizado pra fidelidade visual (DETALHADO)

Este passo garante que o Dawn replica o visual da referência com 100% de fidelidade. Criar arquivo `assets/custom.css` (se não existir) e adicionar os estilos necessários.

> **NON-NEGOTIABLE — CSS pixel-perfect (Pilar 1, 2ª metade).** Cada componente é RECRIADO com CSS que sobrescreve o Dawn até bater 1:1 com a ref. Não é "aproximar": é reproduzir os valores computados (cor, font-family, font-weight, font-size, letter-spacing, line-height, padding, margin, border, border-radius) de `computed-ref-{componente}.json`.
>
> **Segurança (shopify-theme-safety):** a fidelidade se constrói em `assets/custom.css` (asset NOVO), settings de section e `<style>` scoped. NUNCA editar `layout/theme.liquid`, `assets/base.css` nem o JS principal do Dawn.
>
> **Checkpoint (bloqueio):** cada componente fecha quando `getComputedStyle(destino)` casa com `computed-ref-{componente}.json` dentro das tolerâncias do 24.D. Diff fora = `[ ]` → corrigir o CSS AGORA.

**Estrutura do custom.css:**
```css
/* ===================================
   CUSTOM CSS — Tema Clonado
   Loja destino: {loja_destino}
   Referência: {url_referencia}
   Data: {data}
   =================================== */

/* === TIPOGRAFIA === */
/* Aplicar fonte da referência em componentes específicos */

/* === ANNOUNCEMENT BAR === */
.announcement-bar { /* ... */ }

/* === HEADER === */
.header { /* ... */ }
.header__menu-item { /* ... */ }

/* === HERO / IMAGE BANNER === */
.image-banner { /* ... */ }

/* === FEATURED COLLECTION === */
.featured-collection { /* ... */ }
.card-wrapper { /* ... */ }

/* === FOOTER === */
.footer { /* ... */ }

/* === MOBILE === */
@media (max-width: 749px) {
  /* Ajustes mobile específicos */
}
```

**Pra cada componente visual (announcement bar, header, cards de produto, produto, botões/CTAs, preços, carrinho, rodapé), extrair via Chrome Brain:**
```javascript
const el = document.querySelector('SELETOR');
const cs = getComputedStyle(el);
return {
  backgroundColor: cs.backgroundColor,
  color: cs.color,
  padding: cs.padding,
  margin: cs.margin,
  fontSize: cs.fontSize,
  fontFamily: cs.fontFamily,
  fontWeight: cs.fontWeight,
  border: cs.border,
  borderRadius: cs.borderRadius
};
```

Comparar com os valores da referência (Passo 3) e criar regras CSS que sobrescrevam o padrão do Dawn.

**Propriedades críticas que frequentemente divergem:**
- `--color-button`: cor do botão principal
- `--font-heading--family`: fonte dos headings
- `--page-width`: max-width do container
- Padding interno de seções (`--section-padding-top`, `--section-padding-bottom`)

### Passo 15 - Upload de assets (imagens, ícones)

1. Para cada imagem no Inventário de Imagens (Passo 2.11) com status `[ ] pendente`:
   - Baixar a imagem da URL CDN via WebFetch
   - Fazer upload para a loja destino via Shopify Admin API:
     ```
     POST /admin/api/2024-01/themes/{TEMA_ID}/assets.json
     {
       "asset": {
         "key": "assets/{nome-arquivo}",
         "attachment": "{base64_do_arquivo}"
       }
     }
     ```
   - Atualizar status no inventário: `[ ] pendente` → `[x] ok`

2. Para imagens bloqueadas (403/CORS): substituir por imagem de placeholder livre de royalties (Unsplash/Pexels) com dimensões equivalentes.

3. Para SVGs inline: extrair o código SVG completo e salvar como arquivo `assets/{nome}.svg`.

4. Ao final: verificar que o inventário não tem nenhuma linha `[ ] pendente`.

### Passo 16 - Push do tema modificado

> Integra `theme check` local (P7), push 1-por-1 com `sleep 10` (P2 operacionalizado), pull-back diff por arquivo (P5), gate de confirmação pra `templates/*.json` (P8) e fallback `themeFilesUpsert` pela Admin API.

#### 16.1 Pull-back fresh (P6 — sessão longa)

Se a sessão já tem >30min ou >5 pushes anteriores neste run, pull-back fresh em pasta limpa antes:
```bash
TS=$(date +%s)
VERIFY_DIR="/tmp/tema-verify-$TS"
shopify theme pull --store <destino> --theme <id> --path "$VERIFY_DIR" --live
# Detectar diff vs /tmp/tema-clone/ — se houver mudanças do merchant, mergear ANTES de empurrar
diff -rq /tmp/tema-clone/ "$VERIFY_DIR/" | head -30
```

Se merchant editou algo entre o pull inicial e agora, alertar usuário e resolver antes de empurrar.

#### 16.2 `theme check` LOCAL (P7 — bloqueante)

```bash
shopify theme check --path /tmp/tema-clone/ 2>&1 | tee /tmp/theme-check-pre-push.log | head -100
```

Se houver QUALQUER `[error]` ou `[warn]` em sections/snippets/blocks/templates: **abortar push** e corrigir local. Falha local é barata, falha em prod tira o site do ar.

Salvar `/tmp/theme-check-pre-push.log` em `06. Anexos/theme-check-{data}.txt` (gate de Quality Gate Fase 3).

#### 16.3 Detectar arquivos sensíveis (P8 — confirmação humana)

```bash
ARQUIVOS_EDITADOS=$(git -C /tmp/tema-clone/ diff --name-only HEAD 2>/dev/null || find /tmp/tema-clone/ -newer /tmp/tema-clone-pull-marker -type f)

# Filtrar templates/*.json e sections/*-group.json
SENSITIVE=$(echo "$ARQUIVOS_EDITADOS" | grep -E '(templates/.*\.json|sections/.*-group\.json)$' || true)

if [ -n "$SENSITIVE" ]; then
  echo "ATENÇÃO: vou empurrar os seguintes arquivos sensíveis (sobrescrevem config do theme editor):"
  echo "$SENSITIVE"
  echo ""
  echo "Esses arquivos podem ter settings configurados pelo cliente. Confirma? (sim/não)"
  # AGUARDAR resposta humana. Só prosseguir após "sim" explícito.
fi
```

Se cliente disser não, marcar pra revisão manual e pular esses arquivos.

#### 16.4 Push 1-por-1 com pull-back diff (P2 operacionalizado)

```bash
PUSH_LOG="/tmp/push-log-$(date +%s).txt"

for ARQ in $ARQUIVOS_EDITADOS; do
  echo "Pushing $ARQ..." | tee -a "$PUSH_LOG"
  shopify theme push --store <destino> --theme <id> --path /tmp/tema-clone/ --only "$ARQ" --allow-live 2>&1 | tee -a "$PUSH_LOG"
  sleep 10  # rate-limit cooldown — NUNCA push em batch sem sleep

  # Pull-back e diff
  shopify theme pull --store <destino> --theme <id> --path /tmp/verify/ --only "$ARQ" 2>&1 >/dev/null
  if diff -q "/tmp/tema-clone/$ARQ" "/tmp/verify/$ARQ" >/dev/null; then
    echo "  OK $ARQ — push confirmado" | tee -a "$PUSH_LOG"
  else
    echo "  FAIL $ARQ — fallback themeFilesUpsert" | tee -a "$PUSH_LOG"
    # Recuperar pela Admin API com a mutation themeFilesUpsert
  fi
done

cp "$PUSH_LOG" "06. Anexos/push-diff-log.txt"  # evidência pro Quality Gate
```

> **NUNCA usar `--only "a,b,c"` (vírgula) ou `--only` com múltiplos arquivos.** Causa false-positive — CLI reporta success mas snippet/section pode não chegar ao servidor. Sempre 1 por vez com `sleep 10`.

#### 16.5 Para templates JSON: validação HTTP pós-push (P8 protocolo anti-404)

Pra cada arquivo de `templates/*.json` no `$SENSITIVE` que foi empurrado:

```bash
ROTA=$(echo "$ARQ" | sed -E 's|templates/(.+)\.json|/\1|' | sed 's|/product|/products/{handle-exemplo}|' | sed 's|/collection|/collections/{handle-exemplo}|')
STATUS=$(curl -sI "https://{loja}.myshopify.com$ROTA" -o /dev/null -w "%{http_code}")

if [ "$STATUS" != "200" ]; then
  echo "ERRO 404 em $ROTA — restaurando $ARQ do backup e re-push"
  # Restaurar do /tmp/tema-clone-pull-marker e re-push (loop seguro)
fi
```

#### 16.6 Verificação storefront via Chrome Brain (smoke test)

Após push, abrir o storefront destino no Chrome Brain em ABA ANÔNIMA (sem cookies, sem cache):
1. Home renderiza sem `Liquid error`
2. Coleção principal renderiza
3. PDP de produto exemplo renderiza
4. Cart drawer abre

Se algum quebrar, voltar Passo 16.2 + corrigir + repetir.

> **Detectar `dialog beforeunload`** no navegador: é falha grave de salvamento. Implementado também no Passo 24.A (validação visual).

---

# CHECKPOINT FASE 3 — Construção do Tema (Quality Gate ESTRITO)

**BLOQUEIO ABSOLUTO:** Cada item exige evidência. Sem evidência = `[ ]`.

| # | Item | Evidência exigida | Status |
|---|------|-------------------|--------|
| 1 | Inventário de liquids/sections: TODAS as linhas com `Schema válido = [x]` + `Render visível = [x]` | inventário atualizado | [ ] |
| 2 | `shopify theme check` sem warnings em sections/ snippets/ blocks/ | output do `theme check` salvo em `06. Anexos/theme-check-{data}.txt` | [ ] |
| 3 | Cada push verificado via pull diff (P2/P3 — checksum cache) | output do `diff` por arquivo, salvo em `06. Anexos/push-diff-log.txt` | [ ] |
| 4 | Screenshots loja destino tirados em 8 breakpoints × 5 páginas | paths `06. Anexos/clone-dest-{B*}-{P*}.png` | [ ] |
| 5 | Diff visual comparativo ref vs dest em todas as áreas-foco aprovado | tabela diff em `06. Anexos/diff-f3-{data}.md` com tolerâncias atendidas | [ ] |
| 6 | Header idêntico (logo, menu, ícones com `d` path SVG idêntico, cor, transparency) | computed style JSON em `06. Anexos/computed-header-B2.json` com match | [ ] |
| 7 | Footer idêntico (colunas, links, social, newsletter, copyright) | computed style JSON em `06. Anexos/computed-footer-B2.json` | [ ] |
| 8 | Announcement bar idêntica (texto SHA256 match + cor + links) | linha do inventário de copy marcada `[x] match` | [ ] |
| 9 | Sections CUSTOM instaladas e visíveis no theme editor | screenshot do editor mostrando section na lista | [ ] |
| 10 | Vídeos do inventário (Passo 2.13) renderizando no destino (autoplay/loop/muted/poster idênticos) | inventário-videos com TODAS as linhas `Match? = [x]` + screenshot do storefront | [ ] |
| 11 | Assets de tema carregados (hero, logos, ícones SVG, backgrounds, fonts) | listagem `shopify theme list assets` ou ls de `/tmp/tema-completo/assets/` | [ ] |
| 12 | Equivalência 1:1: `count(sections renderizadas no destino) === count(sections mapeadas na ref)` | grep `data-section-type` no DOM ref vs dest | [ ] |

**Validação rápida de CSS antes de avançar:**
Para cada section do checklist, abrir no browser e verificar via Chrome Brain:
```javascript
// Confirmar que não há elementos com height: 0, overflow: hidden não intencional, ou cor #000 em fundo esperado diferente
const broken = [...document.querySelectorAll('section')].filter(s => {
  const st = getComputedStyle(s);
  return parseFloat(st.height) < 10 && s.children.length > 0;
});
return broken.map(s => s.className);
```
Se retornar algum elemento → corrigir antes de avançar.
