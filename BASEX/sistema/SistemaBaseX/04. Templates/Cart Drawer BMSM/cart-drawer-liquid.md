---
tipo: template-code
area: loja
tags: [shopify, cart-drawer, buy-more-save-more, streetch, liquid-code]
criado: 2026-06-01
atualizado: 2026-06-01
formato: liquid-em-code-block
nota: ".liquid nao e sincronizado pelo Obsidian Sync. Este .md contem o liquid embutido em code block."
---

# Cart Drawer BMSM - Codigo Liquid Completo

> Cart-drawer.liquid v3 (validado 2026-06-01) embutido em code block .md pra propagar via Obsidian Sync.

## Como extrair em outro PC

### Caminho A - Admin Theme Editor (sem CLI)

1. Abra este .md no Obsidian
2. Posicione cursor no inicio do `(BMSM_PAYLOAD_START)` no fim deste arquivo
3. Selecione tudo entre o code fence ` ```liquid ` e ` ``` ` (sem incluir as linhas dos fences nem dos comentarios HTML)
4. Copiar (Cmd+C / Ctrl+C)
5. Admin > Online Store > Themes > Edit code > sections/cart-drawer.liquid > sobrescrever todo conteudo > Save

### Caminho B - Extracao via Python (CLI / scripts)

Substitua `__BEGIN_MARKER__` e `__END_MARKER__` no script abaixo pelas strings reais que aparecem em letras maiusculas no final deste arquivo (sao 2 comentarios HTML com prefixo `BMSM-CART-LIQUID-PAYLOAD-`):

```python
import re
md = open("/PATH/SistemaBaseX/04. Templates/Cart Drawer BMSM/cart-drawer-liquid.md").read()
pattern = r'__BEGIN_MARKER__\n```liquid\n(.*?)\n```\n__END_MARKER__'
m = re.search(pattern, md, re.DOTALL)
open("/tmp/cart-drawer.liquid", "w").write(m.group(1))
print(f"extracted {len(m.group(1))} bytes")
```

Esperado: ~36123 bytes.

### Caminho C - via Claude Code (mais simples, recomendado pra colaborador)

No PC do colaborador, no Obsidian vault sincronizado, abrir Claude Code e mandar:

> "Aplica o cart-drawer do `[[cart-drawer-liquid]]` na loja LOJA.myshopify.com, paleta da marca {NOME}: primaria #XXXXXX, accent #XXXXXX..."

O BaseX-Master roteia, extrai via regex, faz pull do tema da loja alvo, substitui paleta, push via `themeFilesUpsert`, valida storefront.

## Customizar paleta (obrigatorio antes de aplicar)

No topo do liquid, dentro de `<style>`, trocar hex pela paleta da marca:

```css
:root {
  --io-iron: #3A3733;    /* timer bg + botao checkout */
  --io-oak:  #8B6F4E;    /* accent warm */
  --io-forge:#0F0E0D;    /* texto */
  --io-cream:#F4EFE6;    /* fundo dos tiers */
  --io-sage: #7F8B6F;    /* tier ativo + savings */
}
```

## Conexoes

- README com 3 caminhos detalhados: [[README]]
- Metodologia: [[Carrinho Buy More Save More - Guia de Replicacao]]

---

## Conteudo `sections/cart-drawer.liquid`

<!--BMSM-CART-LIQUID-PAYLOAD-START-->
```liquid
{%- if request.page_type != 'cart' -%}
  <cart-drawer id="cart-drawer" class="drawer drawer--cart color-scheme color-scheme--{{ section.settings.color_scheme.id }}" aria-label="{{ 'cart.general.title' | t | escape }}" handle-editor-events>
    {%- comment -%}HEADER PART{%- endcomment -%}
    <div class="text-with-icon" slot="header">
      {%- render 'icon' with 'cart' -%}
      <h2 class="h7">Buy More Save More{% unless cart.empty? %} &bull; {{ cart.item_count }} {{ cart.item_count | pluralize: 'item', 'items' }}{% endunless %}</h2>
    </div>

    {%- comment -%} ================ BASEX BMSM CUSTOMIZATION ================ {%- endcomment -%}
    <style>
      :root {
        --io-iron: #3A3733;
        --io-oak: #8B6F4E;
        --io-forge: #0F0E0D;
        --io-cream: #F4EFE6;
        --io-sage: #7F8B6F;
        --io-stone: #8E867A;
        --io-on-iron: #F4EFE6;
        --io-on-sage: #FFFFFF;
      }
      .io-bmsm-banner {
        background: var(--io-iron);
        color: var(--io-on-iron);
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        font-size: 13px;
        letter-spacing: 0.04em;
        font-weight: 500;
      }
      .io-bmsm-banner__label { opacity: 0.85; }
      .io-bmsm-banner__time {
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        letter-spacing: 0.05em;
        padding: 2px 8px;
        background: rgba(255,255,255,0.08);
        border-radius: 3px;
      }
      .io-bmsm-tiers {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        padding: 12px 16px;
        background: var(--io-cream);
      }
      .io-bmsm-tier {
        text-align: center;
        padding: 10px 6px;
        border: 1px solid rgba(58, 55, 51, 0.16);
        border-radius: 4px;
        background: #fff;
        display: flex;
        flex-direction: column;
        gap: 2px;
        color: var(--io-forge);
      }
      .io-bmsm-tier--active {
        background: var(--io-sage);
        color: var(--io-on-sage);
        border-color: var(--io-sage);
      }
      .io-bmsm-tier__qty {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        opacity: 0.85;
      }
      .io-bmsm-tier__pct {
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.01em;
        line-height: 1;
      }
      .io-bmsm-tier__suffix {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        opacity: 0.75;
      }
      .io-bmsm-discount-row {
        font-size: 14px;
        color: var(--io-forge);
      }
      .io-bmsm-discount-value {
        color: #2C5234;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
      }
      .io-bmsm-footer-note {
        text-align: center;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--io-iron);
        opacity: 0.7;
        padding: 8px 0 4px;
      }
      /* Checkout button — force Iron Charcoal */
      cart-drawer button[name="checkout"],
      cart-drawer button[type="submit"][name="checkout"] {
        background: var(--io-iron) !important;
        color: var(--io-on-iron) !important;
        border-color: var(--io-iron) !important;
      }
      cart-drawer button[name="checkout"]:hover { opacity: 0.92; }
    </style>

    {%- comment -%} ================ END BASEX BMSM STYLE ================ {%- endcomment -%}

    {%- comment -%}
    IMPLEMENTATION NOTE: for the content, we first capture the offers and the main cart content (with line items). If there are offers, we conditionnally
                        render the content in tabs. If there are no offers, we render the cart content directly. This allows to make sure we do not create
                        tabs for nothing, as this forces extra JavaScript.
    {%- endcomment -%}

    {%- capture offers_content -%}
      {%- capture offers_blocks -%}
        {%- for block in section.blocks -%}
          {%- case block.type -%}
            {%- when 'offer_banner' -%}
              <div class="cart-offers__item {% if block.settings.layout == 'full_width' %}cart-offers__item--full{% endif %}" {{ block.shopify_attributes }}>
                <div class="offer-item offer-item--lg" style="{% render 'surface', background: block.settings.background, text_color: block.settings.text_color %}">
                  <div class="offer-item__content">
                    {%- render 'icon', image: block.settings.icon, width: block.settings.icon_width -%}

                    {%- if block.settings.subheading != blank or block.settings.content != blank -%}
                      <div class="v-stack gap-1">
                        {%- if block.settings.subheading != blank -%}
                          <p class="bold">{{- block.settings.subheading -}}</p>
                        {%- endif -%}

                        {%- if block.settings.content != blank -%}
                          <div class="prose prose--compact text-subdued">
                            {{- block.settings.content -}}
                          </div>
                        {%- endif -%}
                      </div>
                    {%- endif -%}
                  </div>

                  {%- if block.settings.button_copy_on_click -%}
                    <copy-button class="contents" data-text="{{ block.settings.button_text | escape }}">
                      {%- render 'button', content: block.settings.button_text, href: block.settings.button_link, style: 'outline', size: 'sm', text_color: block.settings.text_color, class: 'shrink-0' -%}
                    </copy-button>
                  {%- else -%}
                    {%- render 'button', content: block.settings.button_text, href: block.settings.button_link, style: 'outline', size: 'sm', text_color: block.settings.text_color, class: 'shrink-0' -%}
                  {%- endif -%}
                </div>
              </div>

            {%- when 'offer_image' -%}
              <div class="cart-offers__item {% if block.settings.layout == 'full_width' %}cart-offers__item--full{% endif %} @container/content-box" {{ block.shopify_attributes }}>
                <div class="content-box" style="{% render 'surface', text_color: block.settings.text_color %}">
                  <div class="content-box__background-media">
                    {%- if block.settings.background_image != blank -%}
                      {{- block.settings.background_image | image_url: width: block.settings.background_image.width | image_tag: loading: 'lazy', widths: '200,300,400,500,600,800,1000,1200' -}}
                    {%- else -%}
                      {{- 'image' | placeholder_svg_tag -}}
                    {%- endif -%}
                  </div>

                  <div class="place-self-center">
                    <div class="prose prose-justify-center prose--compact">
                      {%- if block.settings.heading != blank -%}
                        <p class="h6">{{ block.settings.heading }}</p>
                      {%- endif -%}

                      {%- render 'button', content: block.settings.button_text, href: block.settings.button_link, size: 'sm', style: block.settings.button_style, background: block.settings.button_background, text_color: block.settings.button_text_color, class: 'shrink-0' -%}
                    </div>
                  </div>
                </div>
              </div>
          {%- endcase -%}
        {%- endfor -%}
      {%- endcapture -%}

      {%- if offers_blocks != blank -%}
        <div class="cart-offers">
          {{- offers_blocks -}}
        </div>
      {%- endif -%}
    {%- endcapture -%}

    {%- capture cart_content -%}
      {%- if cart.empty? -%}
        <div class="empty-state">
          <div class="prose prose-justify-center">
            <p class="h5">{{ 'cart.general.empty' | t }}</p>

            {%- assign button_label = 'cart.general.continue_shopping' | t -%}
            {%- render 'button', content: button_label, href: settings.cart_empty_cart_link -%}
          </div>
        </div>
      {%- else -%}
        <div class="v-stack gap-5">
          {%- comment -%} ====== BASEX BMSM — timer + tiers ====== {%- endcomment -%}
          <div class="io-bmsm-banner" data-bmsm-banner>
            <span class="io-bmsm-banner__label">Secure your order &bull; Reservation:</span>
            <span class="io-bmsm-banner__time" data-bmsm-timer>20:00</span>
          </div>

          <div class="io-bmsm-tiers" aria-label="Buy more, save more tiers">
            {%- assign io_qty = cart.item_count -%}
            <div class="io-bmsm-tier{% if io_qty == 2 %} io-bmsm-tier--active{% endif %}">
              <span class="io-bmsm-tier__qty">2 Pieces</span>
              <span class="io-bmsm-tier__pct">+20%</span>
              <span class="io-bmsm-tier__suffix">Extra off</span>
            </div>
            <div class="io-bmsm-tier{% if io_qty == 3 %} io-bmsm-tier--active{% endif %}">
              <span class="io-bmsm-tier__qty">3 Pieces</span>
              <span class="io-bmsm-tier__pct">+25%</span>
              <span class="io-bmsm-tier__suffix">Extra off</span>
            </div>
            <div class="io-bmsm-tier{% if io_qty >= 4 %} io-bmsm-tier--active{% endif %}">
              <span class="io-bmsm-tier__qty">4+ Pieces</span>
              <span class="io-bmsm-tier__pct">+30%</span>
              <span class="io-bmsm-tier__suffix">Extra off</span>
            </div>
          </div>

          <script>
            (function() {
              var timerEl = document.querySelector('cart-drawer [data-bmsm-timer]');
              if (!timerEl) return;
              var KEY = 'io_bmsm_reserve_end';
              var DURATION_MS = 20 * 60 * 1000;
              var end = parseInt(localStorage.getItem(KEY) || '0', 10);
              var now = Date.now();
              if (!end || end <= now) {
                end = now + DURATION_MS;
                localStorage.setItem(KEY, String(end));
              }
              function tick() {
                var left = Math.max(0, end - Date.now());
                var m = Math.floor(left / 60000);
                var s = Math.floor((left % 60000) / 1000);
                timerEl.textContent = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
                if (left <= 0) {
                  localStorage.removeItem(KEY);
                  end = Date.now() + DURATION_MS;
                  localStorage.setItem(KEY, String(end));
                }
              }
              tick();
              if (window.__ioBmsmInterval) clearInterval(window.__ioBmsmInterval);
              window.__ioBmsmInterval = setInterval(tick, 1000);
            })();
          </script>
          {%- comment -%} ====== END BMSM ====== {%- endcomment -%}

          {%- if settings.cart_show_free_shipping_bar -%}
            {%- render 'free-shipping-bar' -%}
          {%- endif -%}

          <div class="v-stack gap-4">
            {%- comment -%}TRUST BADGES{%- endcomment -%}
            {%- assign trust_badges_block = section.blocks | where: 'type', 'trust_badges' | first -%}
            
            {%- if trust_badges_block != blank -%}
              {%- assign rendered_item_count = 0 -%}

              {%- capture trust_badge_items -%}
                {%- for i in (1..3) -%}
                  {%- liquid
                    assign icon_setting = 'trust_' | append: i | append: '_icon'
                    assign icon_width_setting = 'trust_' | append: i | append: '_icon_width'
                    assign subheading_setting = 'trust_' | append: i | append: '_subheading'
                    assign content_setting = 'trust_' | append: i | append: '_content'
                  -%}

                  {%- if trust_badges_block.settings[subheading_setting] != blank or trust_badges_block.settings[content_setting] != blank -%}
                    {%- assign rendered_item_count = rendered_item_count | plus: 1 -%}

                    {%- capture subheading -%}
                      {%- if trust_badges_block.settings[subheading_setting] != blank -%}
                        <p class="medium">{{ trust_badges_block.settings[subheading_setting] }}</p>
                      {%- endif -%}
                    {%- endcapture -%}

                    <div class="offer-item justify-items-start" {{ trust_badges_block.shopify_attributes }}>
                      <div class="h-stack gap-2">
                        {%- render 'icon', image: trust_badges_block.settings[icon_setting], width: trust_badges_block.settings[icon_width_setting] -%}
                        {{- subheading -}}
                      </div>

                      {%- if trust_badges_block.settings[content_setting] != blank -%}
                        <div class="prose">
                          <p>{{ trust_badges_block.settings[content_setting] }}</p>
                        </div>
                      {%- endif -%}
                    </div>
                  {%- endif -%}
                {%- endfor -%}
              {%- endcapture -%}

              {%- if rendered_item_count > 0 -%}
                <div class="offer-carousel {% if rendered_item_count > 1 %}offer-carousel--navigation-inline{% endif %}" style="{% render 'surface', background: trust_badges_block.settings.background, text_color: trust_badges_block.settings.text_color %}">
                  <scroll-carousel id="carousel-{{ trust_badges_block.id }}" class="offer-carousel__scroller scroll-area">
                    {{- trust_badge_items -}}
                  </scroll-carousel>

                  {%- if rendered_item_count > 1 -%}
                    <carousel-navigation class="scroll-marker-group scroll-marker-group--dots scroll-marker-group--dots-sm" aria-controls="carousel-{{ trust_badges_block.id }}">
                      {%- for i in (1..rendered_item_count) -%}
                        <button class="scroll-marker" type="button" aria-current="{% if forloop.first %}true{% else %}false{% endif %}">
                          <span class="sr-only">{{ 'general.accessibility.go_to_item' | t: index: forloop.index }}</span>
                        </button>
                      {%- endfor -%}
                    </carousel-navigation>
                  {%- endif -%}
                </div>
              {%- endif -%}
            {%- endif -%}

            {%- comment -%}LINE ITEMS{%- endcomment -%}

            {%- for line_item in cart.items -%}
              {%- render 'line-item', line_item: line_item, show_line_price: true, hide_unit_price: true, show_quantity_selector: true -%}
            {%- endfor -%}

            {%- comment -%}CROSS-SELL{%- endcomment -%}

            {%- if section.settings.enable_cross_sell -%}
              <product-recommendations hidden product="{{ cart.items.first.product_id }}" limit="10" intent="complementary" section-id="{{ section.id }}">
                {%- if recommendations.performed? and recommendations.intent == 'complementary' and recommendations.products_count > 0 -%}
                  {%- assign recommendations_count = 0 -%}
                  {%- assign carousel_id = 'cart-drawer-cross-sell-' | append: section.id -%}

                  {%- capture product_recommendations -%}
                    <scroll-carousel id="{{ carousel_id }}" class="cart-drawer__cross-sell-carousel scroll-area bleed">
                      {%- for product in recommendations.products -%}
                        {%- assign line_items_for_product = cart.items | where: 'product_id', product.id -%}

                        {%- if line_items_for_product.size == 0 -%}
                          {%- comment -%}We only show recommendations of products that do not exist in the cart yet{%- endcomment -%}
                          {%- assign recommendations_count = recommendations_count | plus: 1 -%}

                          {%- render 'product-cross-sell', product: product, layout: 'horizontal', show_quick_buy: true, background: section.settings.color_scheme.settings.secondary_background -%}
                        {%- endif -%}
                      {%- endfor -%}
                    </scroll-carousel>
                  {%- endcapture -%}
                  
                  {%- if recommendations_count > 0 -%}
                    <div class="cart-drawer__cross-sell">
                      <div class="h-stack justify-between gap-2">
                        {%- if section.settings.cross_sell_title != blank -%}
                          <p class="h7">{{ section.settings.cross_sell_title }}</p>
                        {%- endif -%}

                        {%- if recommendations_count > 1 -%}
                          <div class="h-stack gap-2">
                            <carousel-prev-button aria-controls="{{ carousel_id }}">
                              <button type="button" class="circle-button" disabled>
                                <span class="sr-only">{{ 'general.accessibility.previous' | t }}</span>
                                {%- render 'icon' with 'big-arrow-left', width: 9, direction_aware: true -%}
                              </button>
                            </carousel-prev-button>

                            <carousel-next-button aria-controls="{{ carousel_id }}">
                              <button type="button" class="circle-button">
                                <span class="sr-only">{{ 'general.accessibility.next' | t }}</span>
                                {%- render 'icon' with 'big-arrow-right', width: 9, direction_aware: true -%}
                              </button>
                            </carousel-next-button>
                          </div>
                        {%- endif -%}
                      </div>

                      {{- product_recommendations -}}
                    </div>
                  {%- endif -%}
                {%- endif -%}
              </product-recommendations>
            {%- endif -%}
          </div>
        </div>
      {%- endif -%}
    {%- endcapture -%}

    {%- if offers_content != blank -%}
      <x-tabs class="tab-pills">
        <button type="button" slot="tab">
          {%- render 'icon' with 'cart' -%}
          <span class="subheading">{{ 'cart.general.title' | t }}</span>
        </button>
    
        <div slot="tabpanel" {% if cart.empty? %}class="align-self-center"{% endif %}>{{- cart_content -}}</div>
    
        <button type="button" slot="tab">
          {%- render 'icon' with 'gift' -%}
          <span class="subheading tab-pills__dot-indicator">{{- 'cart.general.offers' | t -}}</span>
        </button>
    
        <div slot="tabpanel">{{- offers_content -}}</div>
      </x-tabs>
    {%- else -%}
      {{- cart_content -}}
    {%- endif -%}

    {%- comment -%}FOOTER PART{%- endcomment -%}
    {%- unless cart.empty? -%}
      <div slot="footer">
        {%- form 'cart', cart -%}
          {%- if section.settings.show_cart_note or section.settings.show_shipping_estimator -%}
            <div class="cart-drawer__footer-actions divide-x">
              {%- if section.settings.show_cart_note -%}
                <x-drawer-popover class="drawer-popover" id="cart-drawer-order-note-popover">
                  <p slot="header" class="subheading">{{ 'cart.general.order_note' | t }}</p>
                  
                  <div class="form">
                    {%- assign field_label = 'cart.general.add_order_note' | t -%}

                    <cart-note>
                      {%- render 'input', name: 'note', value: cart.note, label: field_label, multiline: 5 -%}
                    </cart-note>

                    <dialog-close-button>
                      {%- assign button_label = 'cart.general.save_note' | t -%}
                      {%- render 'button', type: 'button', content: button_label, class: 'justify-self-start' -%}
                    </dialog-close-button>
                  </div>
                </x-drawer-popover>

                <button type="button" class="cart-drawer__footer-action-button subheading" aria-controls="cart-drawer-order-note-popover" aria-expanded="false">
                  {%- render 'icon' with 'order-note' -%}
                  {{- 'cart.general.order_note' | t -}}
                </button>
              {%- endif -%}

              {%- if section.settings.show_shipping_estimator -%}
                <x-drawer-popover class="drawer-popover" id="cart-drawer-shipping-estimator-popover">
                  <p slot="header" class="subheading">{{ 'cart.shipping_estimator.estimate_shipping' | t }}</p>
                  
                  {%- render 'shipping-estimator' -%}
                </x-drawer-popover>

                <button type="button" class="cart-drawer__footer-action-button subheading" aria-controls="cart-drawer-shipping-estimator-popover" aria-expanded="false">
                  {%- render 'icon' with 'shipping-estimator' -%}
                  {{- 'cart.shipping_estimator.estimate_shipping' | t -}}
                </button>
              {%- endif -%}
            </div>
          {%- endif -%}

          <div class="cart-drawer__footer-inner">
            <div class="v-stack gap-4">
              {%- if section.settings.show_terms_of_service_checkbox -%}
                <!-- TERMS BOX -->
                <div class="checkbox-control text-xs">
                  <input id="cart-drawer-terms-of-service" type="checkbox" class="checkbox" required value="1">

                  {%- if shop.terms_of_service == blank -%}
                    <label for="cart-drawer-terms-of-service">{{ 'cart.general.terms_of_services_checkbox' | t }}</label>
                  {%- else -%}
                    <label for="cart-drawer-terms-of-service">{{ 'cart.general.terms_of_services_checkbox_with_link_html' | t: link: shop.terms_of_service.url }}</label>
                  {%- endif -%}
                </div>
              {%- endif -%}

              <!-- TOTALS -->
              {%- comment -%} ====== BASEX — compute savings (compare_at - price) ====== {%- endcomment -%}
              {%- assign io_savings_cents = 0 -%}
              {%- for item in cart.items -%}
                {%- if item.variant.compare_at_price and item.variant.compare_at_price > item.variant.price -%}
                  {%- assign io_diff = item.variant.compare_at_price | minus: item.variant.price -%}
                  {%- assign io_item_save = io_diff | times: item.quantity -%}
                  {%- assign io_savings_cents = io_savings_cents | plus: io_item_save -%}
                {%- endif -%}
              {%- endfor -%}

              <div class="v-stack gap-1.5">
                {% for discount_application in cart.cart_level_discount_applications %}
                  <div class="h-stack justify-between gap-4">
                    <span class="h-stack gap-2">{%- render 'icon' with 'discount', width: 12 -%} {{- discount_application.title -}}</span>
                    <span class="text-subdued">-{{ discount_application.total_allocated_amount | money }}</span>
                  </div>
                {% endfor %}

                {%- if io_savings_cents > 0 -%}
                  <div class="h-stack justify-between gap-4 io-bmsm-discount-row">
                    <span>Discounts</span>
                    <span class="io-bmsm-discount-value">-{{ io_savings_cents | money }}</span>
                  </div>
                {%- endif -%}

                <div class="h-stack justify-between gap-4">
                  <span class="medium uppercase">{{ 'cart.general.total' | t }}</span>
                  <span class="medium">{{ cart.total_price | money }}</span>
                </div>
              </div>

              <p class="io-bmsm-footer-note">Discounts apply automatically at checkout</p>
              {%- comment -%} ====== END BASEX ====== {%- endcomment -%}

              <!-- BUTTONS -->
              <div class="v-stack gap-3">
                <div class="button-group button-group--same-width w-full">
                  {%- liquid
                    if section.settings.show_view_cart_button
                      assign button_content = 'cart.general.view_cart' | t
                      assign button_style = 'solid'

                      if section.settings.show_checkout_button
                        assign button_style = 'outline'
                      endif

                      render 'button', content: button_content, style: button_style, href: routes.cart_url, type: 'button'
                    endif

                    if section.settings.show_checkout_button
                      assign button_content = 'cart.general.checkout' | t
                      render 'button', content: button_content, type: 'submit', name: 'checkout'
                    endif
                  -%}
                </div>

                {%- if section.settings.show_shipping_text -%}
                  {%- liquid
                    if cart.taxes_included and shop.shipping_policy.body != blank
                      assign shipping_text = 'cart.general.taxes_included_and_shipping_policy_html' | t: link: shop.shipping_policy.url
                    elsif cart.taxes_included
                      assign shipping_text = 'cart.general.taxes_included_but_shipping_at_checkout' | t
                    elsif shop.shipping_policy.body != blank
                      assign shipping_text = 'cart.general.taxes_and_shipping_policy_at_checkout_html' | t: link: shop.shipping_policy.url
                    else
                      assign shipping_text = 'cart.general.taxes_and_shipping_at_checkout' | t
                    endif
                  -%}

                  <p class="text-center text-subdued text-xs">{{ shipping_text }}</p>
                {%- endif -%}
              </div>
            </div>
          </div>
        {%- endform -%}
      </div>
    {%- endunless -%}
  </cart-drawer>
{%- endif -%}

{% schema %}
{
  "name": "t:sections.cart_drawer.name",
  "class": "shopify-section--cart-drawer",
  "tag": "section",
  "settings": [
    {
      "type": "paragraph",
      "content": "t:sections.cart_drawer.page_info"
    },
   { 
      "type": "paragraph",
      "content": "t:sections.cart_drawer.free_shipping_bar_info"
    },
    {
      "type": "color_scheme",
      "id": "color_scheme",
      "label": "t:global.colors.scheme",
      "default": "scheme-1"
    },
    {
      "type": "checkbox",
      "id": "show_cart_note",
      "label": "t:sections.cart_drawer.show_cart_note",
      "default": true
    },
    {
      "type": "checkbox",
      "id": "show_shipping_estimator",
      "label": "t:sections.cart_drawer.show_shipping_estimator",
      "default": true
    },
    {
      "type": "checkbox",
      "id": "show_shipping_text",
      "label": "t:sections.cart_drawer.show_shipping_text",
      "default": true
    },
    {
      "type": "checkbox",
      "id": "show_terms_of_service_checkbox",
      "label": "t:sections.cart_drawer.show_terms_of_service_checkbox",
      "info": "t:sections.cart_drawer.show_terms_of_service_checkbox_info",
      "default": false
    },
    {
      "type": "checkbox",
      "id": "show_view_cart_button",
      "label": "t:sections.cart_drawer.show_view_cart_button",
      "default": false
    },
    {
      "type": "checkbox",
      "id": "show_checkout_button",
      "label": "t:sections.cart_drawer.show_checkout_button",
      "default": true
    },
    {
      "type": "header",
      "content": "t:sections.cart_drawer.cross_sell_category",
      "info": "t:sections.cart_drawer.cross_sell_category_info"
    },
    {
      "type": "checkbox",
      "id": "enable_cross_sell",
      "label": "t:sections.cart_drawer.enable_cross_sell",
      "default": true
    },
    {
      "type": "inline_richtext",
      "id": "cross_sell_title",
      "label": "t:global.text.title",
      "default": "You may also like"
    }
  ],
  "blocks": [
    {
      "type": "trust_badges",
      "limit": 1,
      "name": "t:sections.cart_drawer.blocks.trust_badges.name",
      "settings": [
        {
          "type": "paragraph",
          "content": "t:sections.cart_drawer.blocks.trust_badges.instructions"
        },
        {
          "type": "color",
          "id": "background",
          "label": "t:global.colors.background",
          "default": "#eef3fd"
        },
        {
          "type": "color",
          "id": "text_color",
          "label": "t:global.colors.text",
          "default": "#0033dd"
        },
        {
          "type": "header",
          "content": "t:sections.cart_drawer.blocks.trust_badges.trust_1_category"
        },
        {
          "type": "image_picker",
          "id": "trust_1_icon",
          "label": "t:global.icons.icon",
          "info": "t:global.icons.custom_icon_info"
        },
        {
          "type": "range",
          "id": "trust_1_icon_width",
          "label": "t:global.icons.icon_width",
          "min": 16,
          "max": 48,
          "step": 2,
          "unit": "px",
          "default": 16
        },
        {
          "type": "inline_richtext",
          "id": "trust_1_subheading",
          "label": "t:global.text.subheading"
        },
        {
          "type": "inline_richtext",
          "id": "trust_1_content",
          "label": "t:global.text.content"
        },
        {
          "type": "header",
          "content": "t:sections.cart_drawer.blocks.trust_badges.trust_2_category"
        },
        {
          "type": "image_picker",
          "id": "trust_2_icon",
          "label": "t:global.icons.icon",
          "info": "t:global.icons.custom_icon_info"
        },
        {
          "type": "range",
          "id": "trust_2_icon_width",
          "label": "t:global.icons.icon_width",
          "min": 16,
          "max": 48,
          "step": 2,
          "unit": "px",
          "default": 16
        },
        {
          "type": "inline_richtext",
          "id": "trust_2_subheading",
          "label": "t:global.text.subheading"
        },
        {
          "type": "inline_richtext",
          "id": "trust_2_content",
          "label": "t:global.text.content"
        },
        {
          "type": "header",
          "content": "t:sections.cart_drawer.blocks.trust_badges.trust_3_category"
        },
        {
          "type": "image_picker",
          "id": "trust_3_icon",
          "label": "t:global.icons.icon",
          "info": "t:global.icons.custom_icon_info"
        },
        {
          "type": "range",
          "id": "trust_3_icon_width",
          "label": "t:global.icons.icon_width",
          "min": 16,
          "max": 48,
          "step": 2,
          "unit": "px",
          "default": 16
        },
        {
          "type": "inline_richtext",
          "id": "trust_3_subheading",
          "label": "t:global.text.subheading"
        },
        {
          "type": "inline_richtext",
          "id": "trust_3_content",
          "label": "t:global.text.content"
        }
      ]
    },
    {
      "type": "offer_banner",
      "name": "t:sections.cart_drawer.blocks.offer_banner.name",
      "settings": [
        {
          "type": "select",
          "id": "layout",
          "label": "t:sections.cart_drawer.blocks.offer.layout",
          "options": [
            {
              "value": "half_width",
              "label": "t:sections.cart_drawer.blocks.offer.layout_options.half_width"
            },
            {
              "value": "full_width",
              "label": "t:sections.cart_drawer.blocks.offer.layout_options.full_width"
            }
          ],
          "default": "full_width"
        },
        {
          "type": "image_picker",
          "id": "icon",
          "label": "t:global.icons.icon",
          "info": "t:global.icons.custom_icon_info"
        },
        {
          "type": "range",
          "id": "icon_width",
          "label": "t:global.icons.icon_width",
          "min": 16,
          "max": 48,
          "step": 2,
          "unit": "px",
          "default": 24
        },
        {
          "type": "inline_richtext",
          "id": "subheading",
          "label": "t:global.text.subheading",
          "default": "Subheading"
        },
        {
          "type": "richtext",
          "id": "content",
          "label": "t:global.text.content",
          "default": "<p>Share a discount code, promote a sale or free shipping offer...</p>"
        },
        {
          "type": "text",
          "id": "button_text",
          "label": "t:global.text.button_text",
          "default": "Button text"
        },
        {
          "type": "url",
          "id": "button_link",
          "label": "t:global.text.button_link"
        },
        {
          "type": "checkbox",
          "id": "button_copy_on_click",
          "label": "t:sections.cart_drawer.blocks.offer.button_copy_on_click",
          "default": false
        },
        {
          "type": "header",
          "content": "t:global.colors.category"
        },
        {
          "type": "color",
          "id": "background",
          "label": "t:global.colors.background",
          "default": "#eef3fd"
        },
        {
          "type": "color",
          "id": "text_color",
          "label": "t:global.colors.text",
          "default": "#0033dd"
        }
      ]
    },
    {
      "type": "offer_image",
      "name": "t:sections.cart_drawer.blocks.offer_image.name",
      "settings": [
        {
          "type": "select",
          "id": "layout",
          "label": "t:sections.cart_drawer.blocks.offer.layout",
          "options": [
            {
              "value": "half_width",
              "label": "t:sections.cart_drawer.blocks.offer.layout_options.half_width"
            },
            {
              "value": "full_width",
              "label": "t:sections.cart_drawer.blocks.offer.layout_options.full_width"
            }
          ],
          "default": "full_width"
        },
        {
          "type": "image_picker",
          "id": "background_image",
          "label": "t:global.image.background_image",
          "info": "t:sections.cart_drawer.blocks.offer_image.background_image_size_recommendation"
        },
        {
          "type": "inline_richtext",
          "id": "heading",
          "label": "t:global.text.content",
          "default": "Share something"
        },
        {
          "type": "text",
          "id": "button_text",
          "label": "t:global.text.button_text",
          "default": "Button text"
        },
        {
          "type": "url",
          "id": "button_link",
          "label": "t:global.text.button_link"
        },
        {
          "type": "select",
          "id": "button_style",
          "label": "t:global.text.button_style",
          "options": [
            {
              "value": "outline",
              "label": "t:global.text.button_style_options.outline"
            },
            {
              "value": "solid",
              "label": "t:global.text.button_style_options.solid"
            },
            {
              "value": "link",
              "label": "t:global.text.button_style_options.link"
            }
          ],
          "default": "solid"
        },
        {
          "type": "header",
          "content": "t:global.colors.category"
        },
        {
          "type": "color",
          "id": "text_color",
          "label": "t:global.colors.text",
          "default": "#ffffff"
        },
        {
          "type": "color",
          "id": "button_background",
          "label": "t:global.colors.button_background",
          "default": "#ffffff"
        },
        {
          "type": "color",
          "id": "button_text_color",
          "label": "t:global.colors.button_text",
          "default": "#000000"
        }
      ]
    }
  ]
}
{% endschema %}

```
<!--BMSM-CART-LIQUID-PAYLOAD-END-->
