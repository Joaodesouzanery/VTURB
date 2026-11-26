---
type: cache
name: "Schemas Dawn Nativas — Cache Pinado"
dawn_version_pinned: "14.0.0"
sha256_last_refresh: pending
refreshed_at: 2026-07-01
refresh_script: _engine/criar-tema-clonado/refresh-dawn-cache.py
consumed_by: [R56, R62, G5, G7]
---

# Schemas Dawn Nativas — Cache Pinado v14.0.0

> **NON-NEGOTIABLE:** cache stale gera false negatives no Gate G5 (marca CUSTOM tudo). SEMPRE checar versão Dawn do target antes de comparar. Se target tem Dawn diferente, WARNING obrigatório + oferecer refresh.

## Versão pinada

- **Dawn version:** `14.0.0`
- **Fonte:** https://github.com/Shopify/dawn (tag v14.0.0)
- **Refresh script:** `_engine/criar-tema-clonado/refresh-dawn-cache.py` (baixa sections/*.liquid do GitHub, extrai schemas, atualiza este cache)
- **Refresh policy:** trimestral OU quando target loja tem Dawn > cached version

## Validação pré-uso (obrigatório)

Antes de usar este cache no Gate G5 ou G7:

```python
# Query versão Dawn do target
q = "query themeMetadata($id: ID!) { theme(id: $id) { name themeStoreId processing } }"
# Ou pull sections/main-product.liquid do target e comparar comentários de versão
```

Se versão do target > cached: **WARNING** + pedir refresh via `refresh-dawn-cache.py`.

## Section schemas cacheados

> Estrutura: cada section abaixo lista schema JSON parcial (settings + blocks) pra comparação de fingerprint no Gate G5. Não inclui `presets` nem `default` values (irrelevantes pra comparação estrutural).

### announcement-bar

```json
{
  "name": "Announcement bar",
  "class": "announcement-bar-section",
  "settings": [
    {"type": "select", "id": "color_scheme", "options": ["accent-1","accent-2","background-1","background-2","inverse"]},
    {"type": "checkbox", "id": "show_line_separator"}
  ],
  "blocks": [
    {"type": "announcement", "settings": ["text", "text_alignment", "link"]}
  ]
}
```

### header

```json
{
  "name": "Header",
  "class": "section-header",
  "settings": [
    {"type": "select", "id": "logo_position"},
    {"type": "image_picker", "id": "logo"},
    {"type": "range", "id": "logo_width"},
    {"type": "link_list", "id": "menu"},
    {"type": "select", "id": "menu_type_desktop"},
    {"type": "checkbox", "id": "sticky_header"},
    {"type": "checkbox", "id": "show_line_separator"},
    {"type": "select", "id": "color_scheme"},
    {"type": "select", "id": "mobile_logo_position"}
  ]
}
```

### image-banner

```json
{
  "name": "Image banner",
  "class": "spaced-section",
  "settings": [
    {"type": "image_picker", "id": "image"},
    {"type": "image_picker", "id": "image_2"},
    {"type": "range", "id": "image_overlay_opacity", "min": 0, "max": 100, "step": 10, "unit": "%"},
    {"type": "select", "id": "image_height"},
    {"type": "select", "id": "desktop_content_position"},
    {"type": "checkbox", "id": "show_text_box"},
    {"type": "select", "id": "desktop_content_alignment"},
    {"type": "select", "id": "color_scheme"},
    {"type": "select", "id": "image_behavior"},
    {"type": "select", "id": "mobile_content_alignment"}
  ],
  "blocks": [
    {"type": "heading", "settings": ["heading", "heading_size"]},
    {"type": "text", "settings": ["text", "text_style"]},
    {"type": "buttons", "settings": ["button_label_1", "button_link_1", "button_style_secondary_1", "button_label_2", "button_link_2", "button_style_secondary_2"]}
  ]
}
```

### slideshow

```json
{
  "name": "Slideshow",
  "class": "slideshow-section",
  "max_blocks": 12,
  "settings": [
    {"type": "select", "id": "slide_height"},
    {"type": "select", "id": "slider_visual"},
    {"type": "checkbox", "id": "auto_rotate"},
    {"type": "range", "id": "change_slides_speed"},
    {"type": "checkbox", "id": "show_text_below"},
    {"type": "select", "id": "accessibility_info"}
  ],
  "blocks": [
    {"type": "slide", "settings": [
      "image", "heading", "heading_size", "subheading", "button_label", "link",
      "button_style_secondary", "box_align", "show_text_box", "text_alignment",
      "image_overlay_opacity", "color_scheme", "text_alignment_mobile"
    ]}
  ]
}
```

### featured-collection

```json
{
  "name": "Featured collection",
  "class": "section",
  "settings": [
    {"type": "text", "id": "title"},
    {"type": "select", "id": "heading_size"},
    {"type": "richtext", "id": "description"},
    {"type": "checkbox", "id": "show_description"},
    {"type": "select", "id": "description_style"},
    {"type": "collection", "id": "collection"},
    {"type": "range", "id": "products_to_show", "min": 2, "max": 25},
    {"type": "range", "id": "columns_desktop", "min": 1, "max": 5},
    {"type": "select", "id": "image_ratio"},
    {"type": "select", "id": "image_shape"},
    {"type": "checkbox", "id": "show_secondary_image"},
    {"type": "checkbox", "id": "show_vendor"},
    {"type": "checkbox", "id": "show_rating"},
    {"type": "checkbox", "id": "enable_quick_add"},
    {"type": "checkbox", "id": "show_view_all"},
    {"type": "select", "id": "view_all_style"},
    {"type": "select", "id": "color_scheme"},
    {"type": "select", "id": "columns_mobile"},
    {"type": "checkbox", "id": "swipe_on_mobile"}
  ]
}
```

### collection-list

```json
{
  "name": "Collection list",
  "class": "section",
  "settings": [
    {"type": "text", "id": "title"},
    {"type": "range", "id": "columns_desktop"},
    {"type": "select", "id": "image_ratio"},
    {"type": "select", "id": "color_scheme"}
  ],
  "blocks": [
    {"type": "featured_collection", "settings": ["collection"]}
  ]
}
```

### image-with-text

```json
{
  "name": "Image with text",
  "class": "section",
  "settings": [
    {"type": "select", "id": "image_ratio"},
    {"type": "select", "id": "content_layout"},
    {"type": "select", "id": "section_color_scheme"},
    {"type": "select", "id": "height"},
    {"type": "select", "id": "desktop_image_width"},
    {"type": "select", "id": "layout"},
    {"type": "select", "id": "desktop_content_position"},
    {"type": "select", "id": "desktop_content_alignment"},
    {"type": "select", "id": "content_color_scheme"}
  ],
  "blocks": [
    {"type": "heading", "settings": ["heading", "heading_size"]},
    {"type": "caption", "settings": ["caption", "caption_size", "caption_style", "caption_upper"]},
    {"type": "text", "settings": ["text"]},
    {"type": "button", "settings": ["button_label", "button_link", "button_style_secondary"]}
  ]
}
```

### rich-text

```json
{
  "name": "Rich text",
  "class": "section",
  "settings": [
    {"type": "select", "id": "desktop_content_position"},
    {"type": "select", "id": "content_alignment"},
    {"type": "select", "id": "color_scheme"},
    {"type": "select", "id": "full_width"}
  ],
  "blocks": [
    {"type": "heading", "settings": ["heading", "heading_size"]},
    {"type": "caption", "settings": ["caption", "text_style", "caption_size"]},
    {"type": "text", "settings": ["text"]},
    {"type": "buttons", "settings": ["button_label_1", "button_link_1", "button_style_secondary_1", "button_label_2", "button_link_2", "button_style_secondary_2"]}
  ]
}
```

### multicolumn

```json
{
  "name": "Multicolumn",
  "class": "section",
  "settings": [
    {"type": "text", "id": "title"},
    {"type": "select", "id": "heading_size"},
    {"type": "select", "id": "image_width"},
    {"type": "select", "id": "image_ratio"},
    {"type": "range", "id": "columns_desktop"},
    {"type": "select", "id": "column_alignment"},
    {"type": "select", "id": "background_style"},
    {"type": "text", "id": "button_label"},
    {"type": "url", "id": "button_link"},
    {"type": "select", "id": "color_scheme"},
    {"type": "select", "id": "columns_mobile"},
    {"type": "checkbox", "id": "swipe_on_mobile"}
  ],
  "blocks": [
    {"type": "column", "settings": ["image", "title", "text", "link_label", "link"]}
  ]
}
```

### video

```json
{
  "name": "Video",
  "class": "section",
  "settings": [
    {"type": "text", "id": "heading"},
    {"type": "select", "id": "heading_size"},
    {"type": "video", "id": "video"},
    {"type": "url", "id": "video_url"},
    {"type": "text", "id": "description"},
    {"type": "image_picker", "id": "cover_image"},
    {"type": "select", "id": "full_width"},
    {"type": "select", "id": "color_scheme"}
  ]
}
```

### collapsible-content

```json
{
  "name": "Collapsible content",
  "class": "section",
  "settings": [
    {"type": "text", "id": "caption"},
    {"type": "text", "id": "heading"},
    {"type": "select", "id": "heading_size"},
    {"type": "select", "id": "heading_alignment"},
    {"type": "select", "id": "layout"},
    {"type": "select", "id": "open_first_collapsible_row"},
    {"type": "select", "id": "color_scheme"},
    {"type": "select", "id": "container_color_scheme"},
    {"type": "image_picker", "id": "image"},
    {"type": "select", "id": "desktop_layout"},
    {"type": "select", "id": "mobile_layout"}
  ],
  "blocks": [
    {"type": "collapsible_row", "settings": ["heading", "icon", "row_content", "page"]}
  ]
}
```

### newsletter

```json
{
  "name": "Email signup",
  "class": "section",
  "settings": [
    {"type": "select", "id": "color_scheme"},
    {"type": "select", "id": "full_width"}
  ],
  "blocks": [
    {"type": "heading", "settings": ["heading", "heading_size"]},
    {"type": "paragraph", "settings": ["text"]},
    {"type": "email_form", "settings": []}
  ]
}
```

### footer

```json
{
  "name": "Footer",
  "settings": [
    {"type": "select", "id": "color_scheme"},
    {"type": "checkbox", "id": "newsletter_enable"},
    {"type": "text", "id": "newsletter_heading"},
    {"type": "checkbox", "id": "enable_follow_on_shop"},
    {"type": "checkbox", "id": "show_social"},
    {"type": "select", "id": "show_country_selector"},
    {"type": "select", "id": "show_locale_selector"},
    {"type": "checkbox", "id": "payment_enable"},
    {"type": "checkbox", "id": "show_policy"},
    {"type": "select", "id": "margin_top"}
  ],
  "blocks": [
    {"type": "link_list", "settings": ["heading", "menu"]},
    {"type": "text", "settings": ["heading", "subtext"]},
    {"type": "image", "settings": ["image", "image_width", "alignment"]}
  ]
}
```

## Como comparar (Gate G5)

```python
import json, re
from pathlib import Path

CACHE = Path("_engine/criar-tema-clonado/fases/schemas-dawn-cache.md")

def get_dawn_schema(section_type):
    """Extract JSON schema from this cache markdown."""
    content = CACHE.read_text()
    # Parse section by heading match
    m = re.search(rf'###\s+{re.escape(section_type)}\n\n```json\n(.*?)\n```', content, re.DOTALL)
    if not m: return None
    return json.loads(m.group(1))

def fingerprint_match(detected_section, section_type):
    """Return % match between detected section and Dawn native."""
    dawn = get_dawn_schema(section_type)
    if not dawn: return 0.0
    dawn_settings = {s['id'] for s in dawn.get('settings', []) if 'id' in s}
    detected_settings = set(detected_section.get('settings_keys', []))
    if not dawn_settings: return 0.0
    intersection = dawn_settings & detected_settings
    # Match ratio: how much of Dawn schema the detected section covers
    return len(intersection) / len(dawn_settings)

# Uso:
# match = fingerprint_match(detected, 'image-banner')
# if match >= 0.9: use CUSTOM herdando esqueleto nativo
# else: use CUSTOM 100% novo
```

## Anti-patterns FORBIDDEN

- Usar cache stale sem validar versão Dawn do target
- Comparar section detectada com cache sem log de % match
- Assumir 100% match e reutilizar nativa Dawn (viola R56/R62 — sempre CUSTOM wrapper)
- Skip Gate G5 pra "economizar tempo" (silenciosamente quebra Regra Mestra)

## Refresh manual

```bash
node _engine/criar-tema-clonado/refresh-dawn-cache.py --version=v14.1.0
# Baixa Dawn v14.1.0 do GitHub, extrai schemas, atualiza este arquivo, atualiza frontmatter
```
