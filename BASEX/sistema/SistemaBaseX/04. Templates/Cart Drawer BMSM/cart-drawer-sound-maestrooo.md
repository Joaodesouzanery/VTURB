---
tipo: template
area: loja
tags:
  - shopify
  - cart-drawer
  - buy-more-save-more
  - sound
  - maestrooo
  - impact
criado: '2026-06-02'
atualizado: '2026-06-02'
compatibilidade:
  - Sound (Style Hatch)
  - Maestrooo Impact / Focal / Warehouse
  - temas com sections/cart-drawer.liquid autocontido usando <cart-drawer>, v-stack, h-stack, slot="footer" e snippet price-list (original_line_price/final_line_price)
aplicado_em:
  - validado em tema Sound/Maestrooo
---

# Cart Drawer BMSM — Variante Sound / Maestrooo (Impact)

> Versão validada em tema Sound/Maestrooo em 2026-06-02. Carrinho "Buy More Save More" com timer de reserva translúcido, bloco de totais unificado (Descuentos verde + Envío com geolocalização + Total), nota de descontos, ícones de pagamento e botão de checkout na cor do header. **Cole o liquid completo** num tema do mesmo tipo, ajuste 2 coisas (cor do header + idioma) e dá push.

> Para tema base Streetch/Spotlight/Dawn use [[cart-drawer-liquid]]. Para Horizon use [[cart-drawer-horizon]].

---

## O que vem incluso

| # | Componente | Onde |
|---|---|---|
| 1 | CSS vars com paleta derivada do header + override do botão checkout | `<style>` no topo |
| 2 | Título "Compra más y ahorra" em negrito (peso 800, 16px) | header do drawer |
| 3 | Timer de reserva 20min, **fundo translúcido**, sem cadeado, persistência localStorage | dentro do `cart-drawer__top` |
| 4 | Bloco de totais unificado (Descuentos / Envío / Total) — **mesma fonte e tamanho** | footer |
| 5 | Linha **Descuentos** em verde = soma de (preço cortado − preço atual) por item | footer |
| 6 | Linha **Envío a {país}** com **geolocalização por IP do lead** + "Envío gratis" | footer |
| 7 | Nota "Los descuentos se aplican automáticamente al pagar" | antes do botão |
| 8 | **Ícones de pagamento** (`shop.enabled_payment_types`) | abaixo do botão |

---

## Passo a passo de replicação

### 1. Confirmar compatibilidade do tema
O tema alvo precisa ter `sections/cart-drawer.liquid` autocontido com a marcação Maestrooo/Sound: elemento `<cart-drawer>`, classes `v-stack`/`h-stack`/`h5`/`count-bubble`, `slot="footer"`, e o snippet `price-list` (que risca preço via `original_line_price > final_line_price`). Se for Horizon ou Streetch, use as outras variantes (links acima).

### 2. Backup + cópia de trabalho (nunca editar o live direto)
```bash
shopify theme pull --store LOJA.myshopify.com --theme LIVE_ID --path ./tema
shopify theme push --store LOJA.myshopify.com --unpublished -t "LOJA - BMSM Cart" --path ./tema --json
```

### 3. Customizar (2 pontos obrigatórios)

**a) Cor do header** — pegar `current.header_background` de `config/settings_data.json` e colocar nas vars:
```css
--mb-primary: #SEUHEX;          /* header_background */
--mb-primary-rgb: R, G, B;      /* o mesmo hex em RGB, p/ translucidez */
```
(Ajustar `--mb-accent` para um tom levemente mais claro se quiser.)

**b) Idioma** — trocar as strings pelo idioma da loja (abaixo estão em espanhol):

| String | Onde |
|---|---|
| `Compra más y ahorra` | título |
| `Asegura tu pedido · Reserva:` | timer |
| `Descuentos` | linha de savings |
| `Envío a {país}` / `Envío gratis` | linha de envio |
| `Los descuentos se aplican automáticamente al pagar` | nota |
| `Métodos de pago` | aria-label dos ícones |

### 4. Substituir o arquivo e dar push na cópia
Cole o payload (abaixo) em `sections/cart-drawer.liquid` da cópia, depois:
```bash
shopify theme push --store LOJA.myshopify.com --theme COPIA_ID --path ./tema --only "sections/cart-drawer.liquid" --json
shopify theme check --path ./tema   # cart-drawer deve ficar sem ofensas
```

### 5. Validar com produto no carrinho
```bash
# adicionar item via sessão e renderizar a section
curl -s "https://LOJA.myshopify.com/?section_id=cart-drawer" | grep -o "mb-bmsm__[a-z-]*"
```
Visual: timer rodando, Descuentos verde (se houver desconto/compare-at), Envío com país, Total, ícones de pagamento.

### 6. Publicar (só após aprovação)
```bash
shopify theme push --store LOJA.myshopify.com --theme LIVE_ID --path ./tema --only "sections/cart-drawer.liquid" --allow-live --json
```

---

## Notas técnicas

- **Savings**: soma de `(preço cortado − preço atual)` por item, onde cortado = `max(original_line_price, compare_at_price×qty)` e atual = `final_line_price`. Cobre **desconto automático** (line-level) E **compare-at**. Só usar `compare_at_price` falha quando o desconto é automático.
- **Geolocalização**: `https://get.geojs.io/v1/ip/country.json` (grátis, sem key, CORS liberado). `ipwho.is` foi descartado (403). Fallback server-side = `localization.country.name`. A bandeira-emoji não renderiza no Windows desktop (mostra código), mas renderiza em mobile/Mac/Android.
- **Push seguro**: sempre `--only sections/cart-drawer.liquid` com `--path` no tema completo (ver [[05. Shopify Theme Push - Regras de Segurança]]). Nunca push de diretório parcial sem `--only`.
- A injeção do timer fica **dentro do `cart-drawer__top`** (nunca em `slot="header"`).
- Forms de PDP devem usar `<product-form>` pra abrir o drawer em vez de redirecionar pra `/cart`.

---

## Payload — `sections/cart-drawer.liquid` completo

<!--BMSM-SOUND-CART-PAYLOAD-START-->
```liquid
{%- comment -%} BMSM cart pattern (vault) — paleta derivada do header da loja {%- endcomment -%}
<style>
  #cart-drawer {
    --mb-primary: #1b2c24;        /* cor do header da loja */
    --mb-primary-rgb: 27, 44, 36; /* mesma cor em rgb (p/ translucidez) */
    --mb-on-primary: #ffffff;     /* texto do header */
    --mb-accent: #2f4a3c;         /* tier ativo (verde mais claro) */
    --mb-tier-bg: #eef2f0;        /* fundo dos tiers */
    --mb-tier-border: #d6e0db;
    --mb-savings: #2c5234;        /* linha de desconto estilo checkout */
    --mb-text: #1a1a1a;           /* texto geral preto */
  }
  #cart-drawer .mb-bmsm__title { font-size: 16px; font-weight: 800; letter-spacing: 0; line-height: 1.2; }
  #cart-drawer .mb-bmsm { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
  #cart-drawer .mb-bmsm__timer { background: rgba(var(--mb-primary-rgb), .08); color: var(--mb-text); border: 1px solid rgba(var(--mb-primary-rgb), .15); border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; line-height: 1.2; }
  #cart-drawer .mb-bmsm__timer-clock { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 15px; background: rgba(var(--mb-primary-rgb), .14); color: var(--mb-text); padding: 3px 9px; border-radius: 6px; white-space: nowrap; }
  #cart-drawer .mb-bmsm__tiers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  #cart-drawer .mb-bmsm__tier { background: var(--mb-tier-bg); border: 1px solid var(--mb-tier-border); border-radius: 10px; padding: 8px 6px; text-align: center; line-height: 1.25; }
  #cart-drawer .mb-bmsm__tier strong { display: block; font-size: 13px; }
  #cart-drawer .mb-bmsm__tier span { font-size: 11px; opacity: .72; }
  #cart-drawer .mb-bmsm__tier--active { background: var(--mb-accent); border-color: var(--mb-accent); color: var(--mb-on-primary); }
  #cart-drawer .mb-bmsm__tier--active span { opacity: .9; }
  #cart-drawer .mb-bmsm__summary { display: flex; flex-direction: column; gap: 8px; }
  #cart-drawer .mb-bmsm__row { display: flex; align-items: center; justify-content: space-between; gap: 16px; font-family: inherit; font-size: 13px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; line-height: 1.3; color: var(--mb-text); }
  #cart-drawer .mb-bmsm__row .mb-bmsm__val { font-variant-numeric: tabular-nums; }
  #cart-drawer .mb-bmsm__row--discount, #cart-drawer .mb-bmsm__row--discount .mb-bmsm__val { color: var(--mb-savings); }
  #cart-drawer .mb-bmsm__row--total { font-weight: 700; }
  #cart-drawer .mb-bmsm__note { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--mb-text); opacity: .7; text-align: center; }
  #cart-drawer .buy-buttons [name="checkout"],
  #cart-drawer .buy-buttons button[type="submit"] { background: var(--mb-primary) !important; color: var(--mb-on-primary) !important; border-color: var(--mb-primary) !important; }
  #cart-drawer .mb-bmsm__shipping { font-size: 12px; letter-spacing: .05em; text-transform: uppercase; color: var(--mb-primary); }
  #cart-drawer .mb-bmsm__free { font-weight: 700; color: var(--mb-text); }
  #cart-drawer .mb-bmsm__payments { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px; margin-top: 10px; }
  #cart-drawer .mb-bmsm__payments svg { height: 24px; width: auto; border-radius: 4px; }
</style>
<cart-drawer {% if request.design_mode %}handle-section-events{% endif %} class="cart-drawer drawer drawer--lg" id="cart-drawer">
  {%- if cart.item_count == 0 -%}
    <button is="close-button" aria-label="{{ 'general.accessibility.close' | t | escape }}">
      {%- render 'icon' with 'close' -%}
    </button>

    <div class="empty-state align-self-center">
      <div class="empty-state__icon-wrapper">
        {%- render 'icon' with 'cart', width: 32, height: 32, stroke_width: 1 -%}
        <span class="count-bubble count-bubble--lg">0</span>
      </div>

      <div class="prose">
        <p class="h5">{{ 'cart.general.empty' | t }}</p>

        {%- assign button_content = 'cart.general.continue_shopping' | t -%}
        {%- render 'button', href: settings.cart_empty_button_link, size: 'xl', content: button_content -%}
      </div>
    </div>
  {%- else -%}
    <div>
      <div class="cart-drawer__top">
        <div class="h-stack items-center justify-between">
          <div class="h-stack grow gap-2 sm:gap-2.5">
            <p class="h5 mb-bmsm__title">Compra m&aacute;s y ahorra</p>
          </div>

          <button type="button" is="close-button" class="drawer__close-icon">
            <span class="sr-only">{{ 'general.accessibility.close' | t }}</span>
            {%- render 'icon' with 'close' -%}
          </button>
        </div>

        {%- if settings.cart_show_free_shipping_threshold -%}
          {%- render 'free-shipping-bar' -%}
        {%- endif -%}

        <div class="mb-bmsm">
          <div class="mb-bmsm__timer">
            <span>Asegura tu pedido &middot; Reserva:</span>
            <span class="mb-bmsm__timer-clock" data-mb-timer>20:00</span>
          </div>
        </div>
        <script>
          (function () {
            var el = document.querySelector('#cart-drawer [data-mb-timer]');
            if (!el || el.dataset.mbInit) return;
            el.dataset.mbInit = '1';
            var KEY = 'mb_bmsm_reserve_end';
            var end = parseInt(localStorage.getItem(KEY) || '0', 10);
            var now = Date.now();
            if (!end || end < now) { end = now + 20 * 60 * 1000; localStorage.setItem(KEY, String(end)); }
            function tick() {
              var diff = Math.max(0, end - Date.now());
              var m = Math.floor(diff / 60000), s = Math.floor((diff % 60000) / 1000);
              el.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
              if (diff <= 0) { end = Date.now() + 20 * 60 * 1000; localStorage.setItem(KEY, String(end)); }
            }
            tick();
            setInterval(tick, 1000);
          })();
        </script>
      </div>

      <div class="v-stack gap-6 sm:gap-8">
        <div class="cart-drawer__line-items">
          {%- for line_item in cart.items -%}
            {%- render 'line-item', line_item: line_item, show_desktop_quantity: true -%}
          {%- endfor -%}
        </div>

        {%- if section.settings.products.count > 0 -%}
          <div class="cart-drawer__recommendations">
            <div class="v-stack gap-2.5 sm:gap-4">
              {%- capture carousel_id -%}cart-drawer-recommendations{%- endcapture -%}

              {%- if section.settings.recommendations_title != blank or section.settings.products.count > 1 -%}
                <div class="h-stack justify-between gap-4">
                  {%- if section.settings.recommendations_title != blank -%}
                    <p>{{ section.settings.recommendations_title | escape }}</p>
                  {%- endif -%}

                  {%- if section.settings.products.count > 1 -%}
                    <div class="h-stack gap-2 hidden sm:flex">
                      <button is="prev-button" class="circle-chevron hover:colors" aria-controls="{{ carousel_id }}" aria-label="{{ 'general.accessibility.previous' | t | escape }}" disabled>{%- render 'icon' with 'chevron-left-small', direction_aware: true -%}</button>
                      <button is="next-button" class="circle-chevron hover:colors" aria-controls="{{ carousel_id }}" aria-label="{{ 'general.accessibility.next' | t | escape }}">{%- render 'icon' with 'chevron-right-small', direction_aware: true -%}</button>
                    </div>
                  {%- endif -%}
                </div>
              {%- endif -%}

              {%- assign horizontal_products_blends = true -%}
              {%- assign product_card_background = section.settings.product_card_background | default: product.settings.product_card_background -%}

              {%- if product_card_background != 'rgba(0,0,0,0)' and product_card_background != blank and product_card_background != settings.dialog_background -%}
                {%- assign horizontal_products_blends = false -%}
              {%- endif -%}

              <scroll-carousel selector=".horizontal-product" id="{{ carousel_id }}" class="horizontal-product-list-carousel {% unless horizontal_products_blends %}separate{% endunless %} scroll-area bleed">
                <div class="horizontal-product-list {% if horizontal_products_blends %}divide-x{% else %}separate{% endif %}">
                  {%- for recommended_product in section.settings.products -%}
                    {%- render 'horizontal-product', product: recommended_product, show_add_to_cart: true, background: section.settings.product_card_background, text_color: section.settings.product_card_text_color -%}
                  {%- endfor -%}
                </div>
              </scroll-carousel>
            </div>
          </div>
        {%- endif -%}
      </div>
    </div>

    <div class="v-stack gap-4 sm:gap-6" slot="footer">
      <div class="v-stack gap-1">
        {%- comment -%} Savings = soma de (preço cortado − preço atual) por produto.
             "preço cortado" = maior entre original_line_price (preço regular, pré-desconto)
             e compare_at_price*qty; "atual" = final_line_price. Replica o risco do tema. {%- endcomment -%}
        {%- assign mb_savings = 0 -%}
        {%- for item in cart.items -%}
          {%- assign mb_ref = item.original_line_price -%}
          {%- if item.variant.compare_at_price > item.variant.price -%}
            {%- assign mb_cap_line = item.variant.compare_at_price | times: item.quantity -%}
            {%- if mb_cap_line > mb_ref -%}
              {%- assign mb_ref = mb_cap_line -%}
            {%- endif -%}
          {%- endif -%}
          {%- if mb_ref > item.final_line_price -%}
            {%- assign mb_diff = mb_ref | minus: item.final_line_price -%}
            {%- assign mb_savings = mb_savings | plus: mb_diff -%}
          {%- endif -%}
        {%- endfor -%}
        {%- assign mb_ship_country = localization.country.name | default: shop.address.country -%}

        <div class="mb-bmsm__summary">
          {%- for discount_application in cart.cart_level_discount_applications -%}
            <div class="mb-bmsm__row mb-bmsm__row--discount">
              <span>{{ discount_application.title }}</span>
              <span class="mb-bmsm__val">-{{ discount_application.total_allocated_amount | money }}</span>
            </div>
          {%- endfor -%}
          {%- if mb_savings > 0 -%}
            <div class="mb-bmsm__row mb-bmsm__row--discount">
              <span>Descuentos</span>
              <span class="mb-bmsm__val">-{{ mb_savings | money }}</span>
            </div>
          {%- endif -%}

          <div class="mb-bmsm__row">
            <span data-mb-shipto>Env&iacute;o a {{ mb_ship_country | upcase }}</span>
            <span class="mb-bmsm__free">Env&iacute;o gratis</span>
          </div>

          <div class="mb-bmsm__row mb-bmsm__row--total">
            <span>Total</span>
            <span class="mb-bmsm__val" data-hulkapps-cart-total>{{- cart.total_price | money_with_currency -}}</span>
          </div>
        </div>
        <script>
          (function () {
            var el = document.querySelector('#cart-drawer [data-mb-shipto]');
            if (!el || el.dataset.mbGeo) return;
            el.dataset.mbGeo = '1';
            function flag(cc) {
              if (!cc || cc.length !== 2) return '';
              return cc.toUpperCase().replace(/./g, function (c) { return String.fromCodePoint(127397 + c.charCodeAt(0)); });
            }
            fetch('https://get.geojs.io/v1/ip/country.json')
              .then(function (r) { return r.json(); })
              .then(function (d) {
                var name = (d && (d.name || d.country)) ? (d.name || d.country) : '';
                if (name) {
                  el.textContent = 'Envío a ' + name.toUpperCase() + ' ' + flag(d.country);
                }
              })
              .catch(function () {});
          })();
        </script>

        {%- if section.settings.show_shipping_text -%}
          {%- if cart.taxes_included and shop.shipping_policy.body != blank -%}
            <p class="text-subdued text-sm">{{ 'cart.general.taxes_included_and_shipping_policy_html' | t: link: shop.shipping_policy.url }}</p>
          {%- elsif cart.taxes_included -%}
            <p class="text-subdued text-sm">{{ 'cart.general.taxes_included_but_shipping_at_checkout' | t }}</p>
          {%- elsif shop.shipping_policy.body != blank -%}
            <p class="text-subdued text-sm">{{ 'cart.general.taxes_and_shipping_policy_at_checkout_html' | t: link: shop.shipping_policy.url }}</p>
          {%- else -%}
            <p class="text-subdued text-sm">{{ 'cart.general.taxes_and_shipping_at_checkout' | t }}</p>
          {%- endif -%}
        {%- endif -%}

        {%- if section.settings.show_cart_note -%}
          <button type="button" class="justify-self-start" aria-controls="cart-drawer-note">
            <span class="link text-sm text-subdued">
              {%- if cart.note == blank -%}
                {{- 'cart.general.add_order_note' | t -}}
              {%- else -%}
                {{- 'cart.general.edit_order_note' | t -}}
              {%- endif -%}
            </span>
          </button>

          <cart-note-dialog id="cart-drawer-note" class="cart-drawer__note">
            <div class="cart-drawer__note-inner">
              <div class="v-stack gap-4 sm:gap-6">
                <p class="h5">{{ 'cart.general.order_note' | t }}</p>

                <cart-note class="v-stack gap-4">
                  {%- assign order_note = 'cart.general.order_note' | t -%}
                  {%- assign order_save_label = 'cart.general.save_note' | t -%}

                  {%- render 'input', name: 'note', multiline: 3, label: order_note, value: cart.note -%}

                  <div class="justify-self-start">
                    {%- render 'button', type: 'button', content: order_save_label, size: 'lg', is: 'close-button', secondary: true -%}
                  </div>
                </cart-note>
              </div>
            </div>
          </cart-note-dialog>
        {%- endif -%}
      </div>

      <p class="mb-bmsm__note">Los descuentos se aplican autom&aacute;ticamente al pagar</p>

      <form action="{{ routes.cart_url }}" method="POST" class="buy-buttons {% if section.settings.show_checkout_button %}buy-buttons--compact{% endif %}">
        {%- assign checkout_label = 'cart.general.checkout' | t -%}

        {%- if section.settings.show_view_cart_button or section.settings.show_checkout_button == false -%}
          <a href="{{ routes.cart_url }}" class="button button--xl {% if section.settings.show_checkout_button %}button--secondary{% endif %}" data-no-instant>
            {{- 'cart.general.view_cart' | t -}}
          </a>
        {%- endif -%}

        {%- if section.settings.show_checkout_button -%}
          {%- render 'button', type: 'submit', content: checkout_label, name: 'checkout', size: 'xl' -%}
        {%- endif -%}
      </form>

      {%- if shop.enabled_payment_types.size > 0 -%}
        <div class="mb-bmsm__payments" role="list" aria-label="M&eacute;todos de pago">
          {%- for type in shop.enabled_payment_types -%}
            {{ type | payment_type_svg_tag }}
          {%- endfor -%}
        </div>
      {%- endif -%}
    </div>
  {%- endif -%}
</cart-drawer>

{% schema %}
{
  "name": "Cart drawer",
  "settings": [
    { "type": "paragraph", "content": "Cart drawer won't appear to your customers if you have set the cart type to Page in the global theme settings." },
    { "type": "paragraph", "content": "Free shipping bar can be configured in global cart settings." },
    { "type": "checkbox", "id": "show_cart_note", "label": "Show cart note", "default": true },
    { "type": "checkbox", "id": "show_shipping_text", "label": "Show shipping text", "default": true },
    { "type": "checkbox", "id": "show_view_cart_button", "label": "Show view cart button", "default": true },
    { "type": "checkbox", "id": "show_checkout_button", "label": "Show checkout button", "default": true },
    { "type": "header", "content": "Product recommendations" },
    { "type": "text", "id": "recommendations_title", "label": "Heading", "default": "Trending this month" },
    { "type": "product_list", "id": "products", "label": "Recommendations", "info": "Suggest additional products to your customers.", "limit": 10 },
    { "type": "color", "id": "product_card_background", "label": "Product card background" },
    { "type": "color", "id": "product_card_text_color", "label": "Product card text" }
  ]
}
{% endschema %}
```
<!--BMSM-SOUND-CART-PAYLOAD-END-->

---

## Conexões

- README do template: [[README]]
- Variante Streetch/Spotlight/Dawn: [[cart-drawer-liquid]]
- Variante Horizon: [[cart-drawer-horizon]]
- Guia metodológico: [[Carrinho Buy More Save More - Guia de Replicacao]]
