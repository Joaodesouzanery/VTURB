# Regras críticas do clone

> Carregado quando precisa consultar regras aprendidas em produção. NÃO é uma fase de execução: é referência durante TODAS as fases.

> Os códigos `R1` a `R92` e `P1` a `P8` são os números das regras deste mesmo arquivo, usados para uma fase citar a outra. Não existe skill nem documento com esses números fora daqui.

## Regras críticas (frontmatter)

1. **A extração da loja modelo não usa admin.** Tudo que o motor lê vem do que a loja publica: `/products.json`, as páginas, os menus e o HTML das telas, abertos pelo navegador automatizado. Não tente autenticar o Shopify CLI na loja modelo: o roteiro não conta com isso e o acesso admin da loja modelo não é requisito.
2. **Tema Dawn é a base.** Não instalar outros temas. Customizar o Dawn instalado na loja destino.
3. **Fidelidade visual.** O objetivo é a loja nova ficar visualmente igual à loja modelo. O que não ficar igual vai para a tabela de diff e se corrige antes de finalizar.
4. **Não inventar dados.** Se um produto na referência tem 3 variantes, criar exatamente 3 variantes. Se o menu tem 5 itens, criar exatamente 5 itens.
5. **Usar apenas ferramentas disponíveis.** Se uma ferramenta falhar, registrar o erro, tentar alternativa, e informar o usuário sobre limitações.

## Regras aprendidas na prática (R1-R55)

**R1. `image_height: "adapt"` é OBRIGATÓRIO** em todos os banners Dawn. `"large"` e `"medium"` cortam a imagem. Sem exceção.

**R2. Publicar em TODOS os canais antes do re-push do template.** Se um produto não está publicado no canal Online Store, ele não aparece nas featured-collection sections mesmo que exista na loja. Verificar via Admin API: `published_at` não-nulo e `published_scope: "web"`.

**R3. `full_width: true` em TODAS as featured-collection sections** (Regra obrigatória do Dawn). Sem isso, a section fica com max-width limitado e não vai de borda a borda.

**R4. Seção de vídeo com altura fixa,** não `auto`. Dawn não tem controle de aspect-ratio nativo pra vídeos. CSS obrigatório: `aspect-ratio: 16/9` ou `height: 600px`.

**R5. Carousel vs grid:** Impact usa carousel pra featured collections; Dawn usa grid por padrão. Ativar `enable_desktop_slider: true` pra replicar carousel. Verificar breakpoints mobile (Dawn usa 2 colunas mobile por padrão - verificar se referência usa 1 ou 2).

**R6. CSS de announcement bar:** Separar os dois esquemas de cor. A announcement bar (scheme-1) e o header (scheme-3 ou outro) são seções DISTINTAS no Dawn. Não aplicar a mesma cor pra ambos sem verificar a referência.

**R7. Featured collection section pega APENAS produtos publicados** no canal Online Store. Sempre verificar publicação antes de testar renderização.

**R8. Imagens do tema (hero, coleção):** Fazer upload via Shopify Admin API (`POST /admin/api/2024-01/themes/{id}/assets.json`), não via CLI. CLI tem limite de tamanho. Imagens vão pra `shopify://shop_images/nome-arquivo.jpg`.

**R9. Fontes custom:** Se a referência usa fonte não disponível no Shopify Font Library (ex: Cardo, Playfair Display via Google Fonts não-listada), fazer upload do arquivo de fonte como asset e usar `@font-face` no CSS. Não assumir que a fonte existe na biblioteca.

**R10. Menu handle:** Ao criar menus via API, o handle é gerado automaticamente pelo Shopify (slug do título). Não tentar criar com handle customizado via REST (usar GraphQL `menuCreate` se precisar de handle específico). Respeitar a ordem (position).

**R11. Após QUALQUER push de tema, verificar via Chrome Brain.** Nunca assumir que o push ficou correto. Abrir o site via Chrome Brain, tirar screenshot e comparar com a referência ANTES de passar pro próximo passo.

**R12. CSS: usar `!important` com parcimônia.** Dawn tem especificidade CSS alta em alguns seletores. Se um seletor não está funcionando, aumentar especificidade em vez de usar `!important` (ex: `.section-header .header__menu-item` em vez de `.header__menu-item`).

**R13. Variant options:** Dawn renderiza seletores de variante apenas se o produto tem mais de 1 variante. Se a referência mostra seletores mesmo com 1 variante, pode ser que o produto tenha variantes "Default" escondidas - verificar no JSON.

**R14. Schema de seção customizada:** SEMPRE incluir `"presets"` no schema, mesmo que vazio (`"presets": [{"name": "Nome da Seção"}]`). Sem presets, a seção não aparece no editor de temas pra adicionar novas instâncias.

**R15. Cart drawer vs cart page:** Dawn tem cart drawer por padrão. Se a referência usa cart page (URL `/cart`), desabilitar o drawer nas configurações do tema (`cart_type: "page"` em `config/settings_data.json`) ou via `theme settings_data.json`.

**R16. Sticky header:** Dawn tem sticky header nativo. Se a referência não tem sticky (header some ao scrollar), verificar `header_sticky_type` nas settings. Valor correto: `"none"` (não sticky) vs `"on-scroll-up"` ou `"always"`.

**R17. Announcement bar slideshow:** Se a referência tem múltiplas mensagens rotacionando na announcement bar, usar o recurso de blocos do Dawn (`"blocks"` no schema da announcement bar). Cada bloco = 1 mensagem.

**R18. Image banner com texto embutido:** Se o banner da referência tem texto DENTRO da imagem (texto faz parte do arquivo de imagem), NÃO adicionar blocos de heading/subheading no Dawn - causa texto duplicado. Deixar apenas o bloco do botão se houver CTA.

**R19. Collection list vs featured collection:** Dawn tem duas sections distintas. `collection-list` mostra thumbnails de coleções (com imagem da coleção). `featured-collection` mostra produtos de UMA coleção. Verificar qual a referência usa em cada slot.

**R20. Mega menu:** Dawn não tem mega menu nativo. Se a referência tem mega menu (dropdown com colunas/imagens), criar custom section ou usar o mega menu do Dawn Pro (se disponível) ou simular com CSS customizado no header.

**R21. Logo SVG:** Se a referência usa logo SVG inline (não via `<img>`), o Dawn não suporta SVG inline no campo de logo. Fazer upload como arquivo SVG via assets e referenciar via `asset_url`. Ou converter pra PNG se a qualidade for suficiente.

**R22. Preload de imagens hero:** Imagens acima do fold devem ter `loading="eager"` (padrão no Dawn) e não `loading="lazy"`. Verificar no HTML renderizado se o Dawn está aplicando lazy em alguma imagem crítica.

**R23. Currency format:** Se a referência mostra `R$ 199,90` e a loja destino mostra `$199.90`, verificar `money_format` nas configurações da loja (Admin > Settings > Store details > Unit system and language). Pode precisar de ajuste manual pós-clone.

**R24. Metafields:** Se a referência exibe dados que não existem nos campos padrão do produto (ex: "Composição: 100% algodão" como campo separado), verificar se são metafields. Replicar via `metafield_definitions` e preencher nos produtos.

**R25. Color swatches:** Dawn mostra swatch de cor como bloco de texto/botão por padrão, não como círculo colorido. Se a referência tem swatches coloridos, verificar se é via metafield `color` ou CSS custom. Implementar via `custom.css` se necessário.

**R26. Product media:** Dawn suporta múltiplas mídias (imagens, vídeo, modelo 3D). Se a referência tem vídeo no produto, adicionar como media (não como metafield). Ordem das mídias importa pra qual aparece primeiro.

**R27. Section order:** A ordem das seções em `templates/index.json` define a ordem visual. SEMPRE replicar a ordem exata da referência. Verificar via DOM quais seções aparecem primeiro no scroll.

**R28. Hero title/CTA dinâmico:** Em lojas de moda, o hero title/CTA frequentemente muda por campanha (ex: "VERÃO 2025" → "SALE 50% OFF"). Não hardcodar esses textos diretamente no Liquid - usar settings do tema ou custom-liquid com settings editáveis. Incluir: heroTitle (text), heroSubtitle (text), heroCTA (text), heroCTAlink (url), heroBgImg (image_picker).

Workflow: re-rodar `inspect heroTitle/heroCTA/heroBgImg` via Chrome Brain apos terminar tudo. Se mudou, atualizar custom-liquid.

**R29. Featured collection: detectar layout carousel vs grid no mobile.** Referências com Impact geralmente usam carousel mobile (swipe). Dawn por padrão usa grid 2 colunas. Verificar a referência no mobile e ajustar `columns_mobile` + `enable_mobile_slider` no settings da section.

**R30. Newsletter section:** Se a referência tem newsletter integrada (ex: Klaviyo, Mailchimp), Dawn tem integração nativa apenas com Shopify Email. Para integrações externas, usar o campo de "custom HTML" da section ou embed de formulário externo. Documentar qual plataforma está em uso.

**R31. Políticas não são seções.** `/policies/refund-policy` é uma página especial do Shopify, não uma section do tema. Configurar via Admin API `POST /admin/api/2024-01/policies.json` ou diretamente nas configurações da loja.

**R32. Blog articles com imagens:** Ao criar artigos via API, as imagens do blog NÃO podem ser enviadas como attachment (limite de 4MB na API). Solução: fazer upload da imagem via assets do tema ou via `POST /admin/api/2024-01/products/{id}/images` para produtos relacionados. Para blogs, usar URL externa ou CDN.

**R33. Menu links pra coleções:** `collection_link` no menu usa o handle da coleção. Se a coleção na referência é `"Camisetas"` e o handle é `camisetas`, o link deve ser `/collections/camisetas`. Verificar que o handle da coleção criada bate com o esperado pelo menu.

**R34. Template de página:** Se a referência tem páginas com layouts diferentes (ex: about com design especial), verificar se o Dawn usa um template alternativo (`templates/page.about.json`). Criar template alternativo se necessário.

**R35. Favicon:** Deve ser quadrado (1:1). Dawn aceita imagens de qualquer tamanho mas redimensiona pra 32x32. Fazer upload do favicon como asset (`assets/favicon.png`) e referenciar no `theme.liquid`.

**R36. Social proof / reviews (NÃO via app):** Se a ref exibe avaliações (Yotpo, Judge.me, Loox, Stamped), NÃO instalar app no destino. Clonar o VISUAL como section custom `cs-reviews` (Passo 13.3.R, estrelas SVG) e embutir as reviews REAIS como blocks estáticos no template JSON do PDP (Passo 22b). Zero app instalado. Detalhe em R90.

**R37. Preloader/splash screen:** Algumas lojas premium têm preloader animado (tela preta ou logo que desaparece antes da home aparecer). Se detectado, implementar via custom JS em `assets/preloader.js` e `{% render 'preloader' %}` no `theme.liquid`.

**R38. Cookies consent banner:** Se a referência exibe banner de LGPD/GDPR, verificar se é nativo do Shopify (Privacy > Cookie consent) ou via app externa. Dawn tem suporte nativo via configurações do tema.

**R39. Custom fonts via @font-face:** Ao fazer upload de fontes como assets, respeitar os formatos suportados pelos browsers modernos: `.woff2` (preferido), `.woff`, `.ttf`. Sempre incluir fallback genérico: `font-family: 'MinhaFonte', sans-serif`.

**R40. Discount badge:** Se a referência exibe "SALE" ou percentual de desconto nos cards de produto, verificar se é calculado via Liquid (`{% if product.compare_at_price > product.price %}`) ou hardcoded. Dawn tem esse recurso nativo mas pode estar desabilitado nas settings do produto.

**R41. Infinite scroll vs paginação:** Dawn usa paginação por padrão. Se a referência usa infinite scroll (mais produtos carregam ao scrollar), verificar se é via app ou custom JS. Implementar via `IntersectionObserver` em custom JS se necessário.

**R42. Quantity selector no PDP:** Dawn tem quantity selector nativo. Se a referência remove o quantity selector (comum em lojas de luxury/drop), desabilitar via settings: `show_quantity_selector: false` no template do produto.

**R43. Shipping bar / upsell bar:** Se a referência tem "Frete grátis acima de R$X" dinâmico, é geralmente uma app ou custom JS que lê o valor do carrinho via AJAX. Implementar via custom section se necessário.

**R44. Back-in-stock / notify me:** Se produtos out-of-stock têm botão "Avise-me", é app externa (Back In Stock, Klaviyo). Documentar e informar o usuário.

**R45. Size guide:** Se a referência tem modal/popup de guia de tamanhos no PDP, verificar se é metafield, app, ou section customizada. Implementar via custom-liquid com modal CSS/JS se necessário.

**R46. Password page customizada:** Se a referência tem password page com design especial (não o padrão do Shopify), verificar `templates/password.json` e `sections/main-password-header.liquid`. Customizar via seção equivalente no Dawn.

**R47. Checkout customizations:** Shopify não permite customizar o checkout via theme files (exceto checkout.liquid em Shopify Plus). Se a referência tem checkout customizado (cores, logo, campos extras), informar o usuário que customização de checkout requer Shopify Plus ou Checkout Extensibility.

**R48. Hero com vídeo background (OBRIGATÓRIO quando referência usa vídeo no hero):** Impact e Dawn não suportam vídeo no bloco de slideshow nativamente. Solução cirúrgica obrigatória:
1. Adicionar campo `"type": "text", "id": "video_url"` ao schema do bloco `image` em `sections/slideshow.liquid`
2. No Liquid, renderizar `<video autoplay muted loop playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">` ANTES do bloco de imagem
3. Lógica: `if block.settings.video_url != blank` → vídeo; `elsif block.settings.image` → imagem; `else` → fallback hero-banner.jpg
4. Usar URL mp4 direto do CDN da referência (ver R50)

**R49. Seções CUSTOM são obrigatórias quando estrutura é diferente (NÃO aproximar com seção existente):** Quando a referência tem layout estruturalmente distinto (bento grid, fan carousel, 3-colunas com mídia mista), criar o `.liquid` completo com schema, presets e CSS inline. Nunca substituir por seção existente do tema — a diferença visual é imediata e o cliente nota. Padrão de seções custom que precisam ser criadas do zero:
- **Bento grid / masonry de coleções** → `bw-bento-grid.liquid` com suporte a `video_url` + `image` por card
- **Fan carousel de vídeos** → `bw-video-slider.liquid` com Swiper.js, efeito coverflow, som toggle
- **3-colunas mídia + texto** → `bw-why-choose-media.liquid` com `<video>` ou `<img>` por coluna

**R50. CDN de vídeos da referência — usar diretamente:** URLs `https://referencia.com/cdn/shop/videos/c/vp/...mp4` são válidas para uso direto em `<video src="">`. Não tentar baixar e re-hospedar. Extrair via `document.querySelectorAll('video source')` + `video[src]` na referência. Isso é o que dá paridade visual real com a referência — os mesmos vídeos, não aproximações.

**R51. Formato de handle em product/collection settings:** Campos `product` em `featured-product` e `shop-the-look` aceitam APENAS o handle como string simples (`"super-car-pcs-3466"`) — nunca `"shopify://products/super-car-pcs-3466"`. Campos `collection` aceitam o handle da coleção (`"best-sellers"`) — nunca GID. O formato `shopify://` é exclusivo de `image_picker` settings. Erro comum que faz a seção renderizar placeholder em vez do produto.

**R52. Schema validation pitfalls — verificar ANTES do push:**
- `block_border_radius`: step=4, valores inválidos (ex: 6) causam push error silencioso
- Block type `text` dentro de `rich-text` section → deve ser `richtext`
- `primary` field em `ShopLocaleInput` não existe na API 2024-10
- Sempre rodar `shopify theme check` antes de qualquer push para capturar erros de schema

**R53. Push cirúrgico com `--only` é OBRIGATÓRIO:** Nunca fazer push sem `--only arquivo1 arquivo2`. Push sem `--only` sobrescreve TODOS os arquivos do tema — destrói customizações do editor de temas e imagens já configuradas. Única exceção: push inicial de tema novo sem customizações.

**R54. Auditoria anti-duplicatas OBRIGATÓRIA antes de qualquer adição ao index.json:** Antes de adicionar qualquer seção ao `order` array, auditar os tipos já presentes. Tipos que NÃO podem duplicar sem intenção explícita: newsletter, text-with-icons, featured-product, faq. Casos reais: (1) newsletter_sec no index.json + bloco newsletter no footer settings_data.json = dois formulários; (2) trust_icons existia desde o build inicial e foi readicionado em sessão posterior. Regra: antes de adicionar, grep o tipo no index.json. Se já existe, atualizar o existente. O footer conta como seção — sempre verificar settings_data.json também.

**R55. Sempre trabalhar com o arquivo live do tema, nunca com cópia local stale:** Antes de qualquer edição no `templates/index.json`, fazer `shopify theme pull --only templates/index.json` para obter o estado atual. Nunca editar o arquivo `/tmp/<loja>-theme/templates/index.json` sem ter feito pull primeiro — o usuário pode ter editado o tema no admin, criando divergência. Toda edição cirúrgica deve ser feita via `python3` no arquivo pulled, depois push imediato. Schema de sections também: se adicionar setting ao JSON mas o schema não declara o campo, o Liquid usa `| default: X` e ignora o valor do JSON silenciosamente.


---

## Bloco R56 a R80 — retrospectiva de clone

> Codifica 10 aprendizados de uma clonagem real entre dois temas premium diferentes + 12 gates URL-específicos derivados de crítica adversária. NON-NEGOTIABLE. Toda execução DEVE ler este bloco no kick-off (R65).

### R56 — Sections detectadas SEMPRE viram CUSTOM (nunca Dawn nativa 1:1)

**Contexto real:** numa clonagem entre dois temas premium, a section de mesmo nome (`slideshow`) tinha block schemas opostos entre um tema e o outro. Hero ficou com white card overlay em vez de full-bleed. Reaplicado ao URL clone: sections detectadas via `querySelectorAll` não mapeiam pra nativas Dawn 1:1.

**Regra:** Regra Mestra Princípio 4 exige schema `desktop_*/mobile_*` duplicado. Nativas Dawn não têm. Section detectada NUNCA é reutilizada 1:1. O match ≥90% só decide se CUSTOM herda esqueleto da nativa (parcial reuse) ou é 100% novo. **Nunca** substituir custom por nativa.

**Aplicação:** Passo 4 classificação + Passo 13.2 build.

### R57 — Default é clone completo, nunca oferecer surgical

**Contexto real:** Vendedor da opção C ("full rewrite") a framou como "2-5 dias, alto risco". Feita em 20 minutos. Framing errado gastou 3 rounds.

**Regra:** "Deixa igual" ou "clona" = full clone. Skill é scriptada 4-8h com fidelidade 100%. NUNCA framar como "alto risco" ou "dias de trabalho". Só oferecer surgical se user disser explicitamente "só quero as cores" ou "só quero os produtos".

**Aplicação:** Passo 1 elicitação.

### R58 — CDN download com 3-tier fallback + mime/size validation

**Contexto real:** Pull silenciosamente perdeu theme.css/theme.js (arquivos >200KB vinham como URL body). Reaplicado ao URL clone: CDN pode retornar 200/302/403.

**Regra:**
1. WebFetch direto
2. Se 302 redirect, seguir até URL final
3. Se 403/hotlink, fallback Playwright (browser context com Referer do site fonte)
4. Validar content-type esperado (image/*, video/*, font/*)
5. Validar size > 0
6. Fonts: fallback Google Fonts equivalente se WOFF2 bloqueado

**Gate:** `assets_baixados == assets_referenciados`. Se falhar, ABORTAR Passo 15.

**Aplicação:** Passo 15.

### R59 — Schema constraint transformation pre-push

**Contexto real:** Push falhou com `heading_letter_spacing<0`, `image_overlay_opacity step errado`, `badge_text tipo inválido`, `faq inexistente`, `newsletter dup no order`. 5+ round-trips desnecessários.

**Regra:** Antes de push com valores extraídos do site fonte, transformar:
- **cores rgba/hsl → hex #RRGGBB** via biblioteca Python `tinycolor` ou `colour` (NOT canvas — canvas não disponível em agent headless)
- Se **rgba com alpha<1** e schema rejeita: converter hex + adicionar CSS var `--overlay-opacity-{key}: {alpha}` em `assets/custom.css` (preserva alpha visualmente)
- **Range** → arredondar para o step do schema Dawn (ex: `image_overlay_opacity` step=10 → `round(value/10)*10`)
- **letter-spacing negativo** → checar schema Dawn v14 atual (aceita). Não clamp cego pra 0.
- **NaN/undefined** → default do schema

Log de todas transformações aplicadas em `.tmp/criar-tema-clonado/schema-transformations.md`.

**Aplicação:** Passo 13 (geração templates) + Passo 16 (pre-push).

### R60 — Theme role check antes de cada push (estende P8)

**Contexto real:** Usuário trocou MAIN entre 3 temas durante sessão. Pushes iam pra tema errado.

**Regra (estende P8, não substitui):** Antes de cada `themeFilesUpsert` ou `shopify theme push`:
```graphql
query themes { themes(first: 25) { nodes { id name role } } }
```
Confirmar: (a) targetId ainda existe; (b) role=UNPUBLISHED (esperado durante clone). Se role=MAIN, **seguir protocolo P8 existente** (confirmação humana explícita "você quer mesmo pushar direto pra live?"). Cache 15min.

**Aplicação:** Passo 16 e 23.

### R61 — Screenshot pós-batch com stylesheet detection (estende Passo 24.A)

**Contexto real:** `userErrors: []` retornado, mas render quebrado. Sem screenshot pós-push, só descobriu quando user mostrou print.

**Regra (estende o Passo 24.A, não duplica):** Após cada batch push:
1. `curl -sL "https://{loja}.myshopify.com/?preview_theme_id={target_id}&pb=0"` (pb=0 obrigatório)
2. `grep -oE 'shopify-section-template--[0-9]+__[a-zA-Z0-9_-]+' | sort -u` → sections esperadas apareceram?
3. Chrome Brain: `navigate` + `wait_for` + `take_screenshot` fullpage 1440 + 390 (multi-viewport)
4. `evaluate_script(() => document.styleSheets.length)` — deve ser > 5
5. Verificar `<link rel="stylesheet">` no HTML — CSS carregou?
6. Se qualquer falhar: **rollback do batch via R66 snapshot batch-a-batch** (não backup Passo 11)

Salvar screenshots em `.tmp/criar-tema-clonado/screenshots/post-batch-N-{desktop|mobile}.png`.

**Aplicação:** Passo 16, 23, 24.A.

### R62 — Nunca nativa Dawn 1:1 sem wrapper custom (reforço R56)

**Regra:** Ao classificar section detectada pela % de match com nativa Dawn:
- ≥90% match → CUSTOM que **herda esqueleto nativo** (settings + blocks) + Regra Mestra `desktop_*/mobile_*`
- <90% match → CUSTOM 100% novo
- **NUNCA** usar nativa Dawn 1:1 sem wrapper (viola Regra Mestra Princípio 4)

**Aplicação:** Passo 4 + Passo 13.2.

### R63 — Dedup + auto-decision no order array

**Contexto real:** o `cart.json` ficou com a section `newsletter` nativa do tema e uma section de newsletter customizada, as duas ao mesmo tempo. Dois newsletters renderizando na mesma página.

**Regra:** Ao gerar `templates/*.json`:
- `order = list(dict.fromkeys(order))` (dedup)
- Cada ID em `order` tem entrada em `sections`
- Se detectado 2 sections do mesmo tipo funcional (2 newsletters, 2 announcement bars): **auto-manter** a de fingerprint match mais alto do audit Passo 1.5, remover a outra
- Confirmação humana só se fingerprints idênticos (ex: 2 announcement top+bottom intencionalmente)

**Aplicação:** Passo 13.5.

### R64 — Screenshot side-by-side DEPOIS de Passo 1.5

**Contexto real:** Rodou workflow paralelo de 528K tokens comparando metadata antes de screenshot. Curl + screenshot resolveria em 30s o que fanout demorou 8min.

**Regra:** Passo 1.5 (audit multi-template) é NON-NEGOTIABLE por Princípio 2 (SEMPRE rodar). Screenshot side-by-side vem DEPOIS, para decidir:
- Que wrappers custom sobre nativas Dawn vs custom 100% (via % match do Gate G5)
- **NÃO** para decidir surgical vs full clone (full é sempre default por R57)

**Aplicação:** entre Passo 1.5 e Passo 2.

### R65 — Load regras críticas + execution log no kick-off

**Regra:** Antes de Passo 1:
1. Ler este arquivo completo (R1-R55 + R56-R80 + R81-R88 + R89)
2. Iniciar `.tmp/criar-tema-clonado/execution-log.md` com timestamp
3. Log de cada gate violation + ação corretiva
4. Meta: zero rollback não-planejado

**Aplicação:** kick-off da skill.

### R66 — Snapshot batch-a-batch

**Contexto real:** Passo 11 = 1 snapshot do Dawn puro pré-clone. Se batch 47 quebra visual, você não tem estado batch 46 pra restaurar. Perde 45 batches de trabalho.

**Regra:** Após CADA batch push com sucesso, salvar estado completo dos arquivos modificados em `.tmp/criar-tema-clonado/batches/{N}/`. Rollback aponta pra último snapshot healthy, não pra backup inicial.

**Engine:** `_engine/criar-tema-clonado/snapshot-batch.py` (portado de `_engine/clonar-tema-shopify-1x1/rollback.py`).

**Aplicação:** Passo 16 + Passo 23.

### R67 — Cloudflare / bot detection bypass no site fonte

**Regra:** Sites protegidos por Cloudflare Bot Fight Mode, Kasada, PerimeterX levam 403/challenge. WebFetch e Chrome headless levam challenge em ~15% das lojas Shopify premium. HTML retornado é challenge page, não a loja real. Invalida silenciosamente Passos 2/3/4.

**Pre-flight (Gate G3.5 novo):**
1. `curl -I` e detectar `cf-mitigated`, `cf-challenge`, ou title "Just a moment..."
2. Se detectado: escalar para Playwright stealth mode (user-agent real, headers `Accept-Language`/`Sec-Ch-Ua` completos, viewport realista, wait for `cf_clearance` cookie)
3. Fallback: pedir usuário abrir URL manualmente e passar cookies exportados

**Aplicação:** Passo 1 (antes de scraping).

### R68 — App dependency check

**Regra:** Sections detectadas podem depender de JS injetado por apps do site fonte (Judge.me, Klaviyo, ReCharge, Loop, Vitals, BOLD, Yotpo). Sem app instalada no target, section renderiza vazia mesmo com clone perfeito.

**Pre-flight:**
1. Extrair scripts externos via `document.scripts` (host !== source origin)
2. Mapear para apps conhecidos via tabela `_engine/criar-tema-clonado/fases/apps-known-signatures.md`
3. Cross-check com a lista de apps detectados na loja modelo
4. Bloquear Passo 16 push até apps críticos serem confirmados instalados no target (query installed apps via Admin API do target)

**Aplicação:** Passo 4 + Passo 20.

### R69 — Rate limiting em scrape agressivo

**Regra:** Shopify rate limits em 60 req/min. Passo 1.5 pode requisitar 250+ PDPs.
- Throttle: 1 req/1.5s no Chrome Brain durante Passo 1.5
- Backoff exponencial em 429 responses
- Se >5 backoffs consecutivos: ABORTAR fase e pedir usuário rodar via VPN diferente

**Aplicação:** Passo 1.5.

### R70 — SPA/headless detection (Hydrogen, Next Commerce, Nuxt)

**Regra:** Sites headless: `document.querySelectorAll('[data-section-type]')` retorna vazio. Passo 4 quebra silenciosamente.

**Pre-flight detect:**
- `window.Shopify.theme.name` undefined?
- `meta[name='generator']` contém "Next.js" ou "Hydrogen"?
- `__NEXT_DATA__` ou `__NUXT__` presente no window?

Se headless: mudar estratégia pra clonagem por **visual regions** (não por sections detectadas), avisar user que fidelidade cai pra ~80%.

**Aplicação:** Passo 1 pre-flight.

### R71 — Comparação visual objetiva (SSIM + pixelmatch)

**Contexto:** Passo 24 usava `diff visual ±10% por área ±15px` — métrica frágil que ora marca antialiasing subpixel como diff, ora passa letter-spacing 1px diferente.

**Regra:** Substituir por métrica objetiva:
- `pixelmatch` threshold=0.1
- `SSIM` (structural similarity) ≥0.95 por região (hero, cards, footer)
- Diff image salvo em `.tmp/criar-tema-clonado/diffs/`
- Regiões com SSIM<0.85 → review humano obrigatório

**Aplicação:** Passo 24.D (Self-Healing Diff Loop).

### R72 — Overlay cleanup pré-screenshot

**Regra:** Cookie banner (Cookiebot, OneTrust), popup newsletter, chat widget (Intercom, Tidio), age gate poluem screenshot.

Antes de Playwright screenshot:
1. `evaluate_script` fechando: `[aria-label*='cookie'] button`, `.cookie-banner`, `[class*='popup'] .close`, `iframe[src*='intercom']`, `iframe[src*='tidio']`
2. Setar `localStorage`/cookies: `cookieConsent=accepted`, `popupClosed=true`, `age_verified=true`
3. Retry screenshot se overlay detectado no snapshot

**Aplicação:** Passo 2.1 + Passo 24.A.

### R73 — Chrome preview URL com pb=0

**Regra:** Preview de tema unpublished no Shopify: `?preview_theme_id={id}&pb=0`. Sem `pb=0`, storefront pode servir versão cacheada.

Todas navegações Playwright pra loja destino usam URL completo com `preview_theme_id + pb=0`.

**Aplicação:** Passo 24.A + Fase 2.

### R74 — Section groups (header/footer) sempre CUSTOM

**Regra:** `sections/header-group.json` e `sections/footer-group.json` do Dawn têm block schemas fixos (image-banner, menu, contact-info). Sites premium sempre têm variações que não batem (mega menu com preview de produto, announcement rotativo, newsletter inline, payment icons animados, accordion mobile).

Se header/footer detectados têm >2 sub-elementos únicos: criar `sections/custom-header.liquid` + `sections/custom-footer.liquid`, remover `header-group.json`/`footer-group.json` do templates use.

**Aplicação:** Passo 13.1.

### R75 — Pinar contexto de scraping (A/B tests, geo, personalization)

**Regra:** Sites com Optimizely, VWO, Convert, Nosto, Rebuy, Dynamic Yield podem servir HTML diferente por request.

**Setup Passo 1.3 (novo sub-passo):**
- Playwright `context.addCookies` fixos: `optimizelyEndUserId=fixed`, `vwo_uuid=fixed`, etc
- Block requests trackers: `*.optimizely.com`, `*.vwo.com`, `*.segment.io`, `*.nostojs.com`
- Force locale + timezone: `Accept-Language: en-US`, `timezoneId: 'America/New_York'`
- MutationObserver DOM nos primeiros 3s (detecta personalization frameworks injetando sections post-load)
- Se ainda houver variabilidade: alertar user "site tem A/B test ativo — resultado pode divergir a cada refresh"

Log de requests blocked em `audit-referencia-{loja}.md`.

**Aplicação:** Passo 1.3 novo.

### R76 — Fonts capturadas do site fonte

**Regra:** Fonts próprias (Adobe Fonts, Typekit, self-hosted WOFF2) com CORS/hotlink protection. Linkar CDN externo pode: (a) bloquear headers de outro domínio; (b) sumir se site fonte trocar; (c) violar TOS (Adobe Fonts).

**Fluxo:** Após extração de `fontFamily` (Passo 3.1):
1. Classificar: `google` | `custom-CDN` | `self-hosted`
2. **google:** usar via Google Fonts (nativo Shopify — sem download)
3. **custom-CDN:** tentar download WOFF2/WOFF via Playwright (com Referer do site fonte)
4. **self-hosted:** download direto
5. **Se 403 (Adobe Fonts license):** mapear pra Google Fonts equivalente (Inter/DM Sans/Manrope/Space Grotesk) + documentar substituição no Copy Map
6. **Pre-check Shopify Font Library primeiro** — se fonte existe nativamente, usar nativa (economiza rehosting)

Baixadas salvas em `assets/fonts/`, injetar `@font-face` em `assets/custom.css`.

**Aplicação:** Passo 3.1 + Passo 15.

### R77 — SVG inline → snippets

**Regra:** Sites premium usam SVGs inline (ícones, logos, decorações) direto no HTML. Skill atual copia HTML rendered → templates repetido incha, vira unmaintainable.

**Passo 2.11 (novo):**
1. `evaluate_script` extract todos `<svg>...</svg>` inline
2. Dedup por sha256 do conteúdo
3. Salvar cada único como `snippets/icon-{nome-slug}.liquid`
4. Templates JSON referenciam via `{% render 'icon-{nome-slug}' %}`
5. Report count no Copy Map

**Aplicação:** Passo 2.11 novo.

### R78 — Animations + transitions capturados

**Regra:** Marquee scroll, hover effects (scale/fade), auto-play carousel, parallax. Extração só de estilos estáticos via `getComputedStyle` miss animation-*.

**Passo 3.5 (novo):** Extrair:
- `animation-name`, `animation-duration`, `animation-timing-function`, `animation-iteration-count`
- `transition-property`, `transition-duration`, `transition-timing-function`
- Hover states: `evaluate_script` disparando `mouseenter` e capturar transform via `getComputedStyle` no state hovered

Custom section `.liquid` embute `@keyframes` e transitions em `<style scoped>`.

**Aplicação:** Passo 3.5 novo.

### R79 — Multi-viewport expandido (5 breakpoints)

**Regra:** Regra atual: 1440 + 390 (2 viewports). Insuficiente. Sites premium quebram em tablet 768.

Matriz nova: **1920 / 1440 / 1024 / 768 / 390** (5 viewports).
Alinhar Passo 2 (extração) com Passo 24 (validação) usando mesma matriz.

**Aplicação:** Passo 2.1 + Passo 24.A.

### R80 — Password / Markets / Metafields / Bundles / Search checks

**Regra completa (múltiplos checks agrupados):**

- **Password protection do site fonte:** validar `senha_referencia` funciona ANTES de Passo 1.
  - `POST /password` com password field
  - Seguir redirect
  - Verificar cookie `storefront_password_bypass=*` setado
  - Se falhar: ABORTAR com mensagem "senha_referencia inválida ou expirada"

- **Shopify Markets:** detectar via `meta[name='shopify-checkout-api-token']` — capturar HTML de mercado correto (locale/currency que user quer clonar). Sem detecção, HTML capturado é do mercado default do IP do agente (US ou BR conforme geoip do Chrome Brain), não o mercado esperado.

- **Metafields visíveis no HTML:** extrair `metafield_definitions` referenciados (material, care instructions, badges custom) via análise de `data-*` attributes ou textContent. Criar `metafieldDefinitionCreate` no target ANTES de push das sections. Senão section custom aponta pra metafield inexistente.

- **Shopify Bundles:** detectar nativo (Shopify Bundles product.type=bundle) vs app (Bundler, Simple Bundles, KachingBundles). HTML renderiza igual, mas source de dados diferente. Sem detecção, clone cria produtos individuais → quebra add-to-cart flow do bundle.

- **Search & Discovery filters custom:** configurados no Admin > Search & Discovery, não em section liquid. Skill não replica automaticamente. Documentar como pendência manual no relatório final (Passo 26).

- **A/B fingerprint via MutationObserver:** DOM changes nos primeiros 3s após load → detecta personalization frameworks (Nosto, Rebuy, Dynamic Yield). Se detectado, pinar variante 'A' via cookie fixo em todas sessões de scrape.

**Aplicação:** Passo 1 pre-flight, Passo 3, Passo 5, relatório final.

---

## Bloco R81 a R88 — fidelidade visual

> Fecham os últimos gaps de paridade visual identificados em revisão. Três frentes: estados interativos, resolução de imagem e detalhes fora do screenshot estático. NON-NEGOTIABLE. Incluídos na leitura obrigatória do kick-off (R65).

### R81 — Validação de estados interativos

**Contexto:** O gate de validação (Passo 24) compara screenshots de páginas em repouso. Os pontos onde clones mais denunciam diferença são justamente os estados que só existem após interação: um clone pode passar no SSIM de página fechada e ter um cart drawer completamente diferente.

**Regra:** Nova dimensão "estados" na matriz de validação. Estados-chave a capturar (onde existirem na referência):

| Estado | Como disparar (Chrome Brain) |
|---|---|
| Cart drawer aberto | adicionar 1 item ao carrinho (`form[action*='/cart/add'] button`) ou click no ícone do cart |
| Menu mobile aberto | viewport 390 + click no hamburger (`[aria-label*='menu']`, `summary.header__icon--menu`) |
| Search overlay aberto | click no ícone de busca + digitar termo com resultados |
| Modal quick-view / size guide | click no trigger correspondente no card/PDP |
| Acordeão PDP expandido | click em cada `details`/accordion do PDP |
| Variante selecionada | click no swatch/opção não-default → validar troca de imagem + estado ativo do swatch |

Fluxo: disparar a MESMA interação na referência e no destino, aguardar animação (500ms), screenshot, comparar com SSIM/pixelmatch (R71). Salvar em `.tmp/criar-tema-clonado/screenshots/estados/{estado}-{ref|dest}.png`.

**Aplicação:** Passo 2 (captura da referência) + Passo 24.A + 24.D (matriz de diff ganha a dimensão "estados").

### R82 — Imagens sempre na resolução master (estende R58)

**Contexto:** O `src` renderizado aponta pra variante reduzida do CDN (`arquivo_600x.jpg`). Baixar essa variante deixa o clone borrado em telas retina, e nenhum diff visual em viewport 1x detecta.

**Regra:**
1. Antes do download, normalizar a URL removendo transformações de tamanho do CDN Shopify: sufixos `_{W}x`, `_{W}x{H}`, `_{W}x{H}_crop_*` e query params `?width=`, `&height=`
2. Baixar a URL master; extrair dimensões reais do arquivo baixado (Python PIL ou `identify`)
3. **Gate objetivo:** largura baixada ≥ 2× a largura renderizada no maior breakpoint em que a imagem aparece
4. Se o master não existir (404), tentar `_2048x` → `_1600x` → maior variante disponível
5. Se nem 2× for atingível, registrar como divergência no inventário de imagens (`[!] resolução abaixo do gate`)

**Aplicação:** Passo 2.11 (inventário registra URL master + largura renderizada) + Passo 15 (download com gate).

### R83 — Estados de scroll validados (estende R16)

**Contexto:** Sticky header que encolhe ou muda de fundo, animações reveal-on-scroll (IntersectionObserver), sticky add-to-cart na PDP e back-to-top só aparecem depois de rolar. Screenshot do topo da página não pega nada disso.

**Regra:**
1. **Extração (Passo 2.1/3.5):** na referência, capturar screenshot em 3 profundidades — topo, ~800px, rodapé — em desktop e mobile. Via `evaluate_script`, comparar `classList` do header/body antes e depois do scroll pra extrair classes toggled (`scrolled-past-header`, `shopify-section-header-sticky`, etc.) e os estilos computados do header em cada estado
2. **Detecção de reveal:** elementos com `opacity: 0` + `transform` no load que mudam após scroll = reveal-on-scroll; registrar seletor + animação
3. **PDP:** rolar além do formulário de compra e verificar se aparece sticky ATC bar; registrar layout dela
4. **Validação (Passo 24.A):** repetir as mesmas 3 profundidades no destino e comparar os elementos fixos em cada profundidade com SSIM/pixelmatch

**Aplicação:** Passo 2.1 + 3.5 + 24.A.

### R84 — Timing de carrossel JS-driven (estende R78)

**Contexto:** R78 captura `animation-*`/`transition-*` do CSS, mas autoplay de carrossel via `setInterval`/lib JS (Swiper, Flickity) é invisível a `getComputedStyle`.

**Regra:** Pra cada carrossel com autoplay na referência:
1. `evaluate_script` com MutationObserver no container do carrossel, cronometrando o intervalo entre mudanças de slide (atributo `aria-hidden`, classe `is-active`, ou `transform` do track)
2. Observar ≥2 ciclos completos pra confirmar o intervalo (ex: 4000ms)
3. Replicar no setting de autoplay da section custom (`autoplay_speed`) ou do slideshow Dawn (`auto_rotate` + `change_slides_speed`)
4. Registrar no design system (Passo 3) junto com as animações CSS

**Aplicação:** Passo 3.5.

### R85 — Identidade fora da página (estende R35)

**Contexto:** Favicon, ícone de atalho iOS, cor da barra do navegador mobile e imagem de compartilhamento social não aparecem em screenshot de página, mas fazem parte do "idêntico".

**Regra:** Extrair da referência e aplicar no destino:
1. **Favicon:** `link[rel*='icon']` — baixar na maior resolução disponível, aplicar via settings do Dawn (R35)
2. **Apple touch icon:** `link[rel='apple-touch-icon']` — subir como asset se existir
3. **theme-color:** `meta[name='theme-color']` — replicar no `settings_data.json`/snippet meta equivalente
4. **OG image:** `meta[property='og:image']` — se for arte dedicada (não a foto do 1º produto), subir e configurar como imagem social da loja (Admin → Preferences)

4 checks correspondentes no relatório final (Passo 26).

**Aplicação:** Passo 12 + 25.

### R86 — Money format + badges + swatches viram gates (eleva R23/R25/R40)

**Contexto:** R23 (money format), R25 (swatches) e R40 (badges) existiam como observações "verificar se". Em produção, são fonte frequente de diff em PDP/card e escapavam do mapeamento de sections.

**Regra (3 gates):**
1. **Moeda + money format:** a moeda principal da loja destino vem do input obrigatório `moeda_principal`, perguntado ao usuário na coleta de inputs — NUNCA inferida da referência (a referência pode vender em moeda diferente da loja destino). Da referência extrai-se apenas o ESTILO de formatação dos preços renderizados (separador decimal, posição do símbolo — `€10,00` vs `EUR 10.00`) e aplica-se à moeda informada. Validar a moeda configurada na loja destino (`shop.currency` via Admin API): se divergir do input, ALERTAR o usuário antes de prosseguir (mudança de moeda de loja é config de Admin, às vezes exige suporte Shopify). Money format ajustado via Admin (`shop.money_format`) ou registrado como pendência manual EXPLÍCITA no relatório (nunca silenciosa)
2. **Lógica de badges:** pra cada badge visto nos cards/PDP da referência (Sale, New, Sold out, % off), identificar o gatilho: `compare_at_price > price`? tag específica? `published_at` recente? estoque zero? Replicar a LÓGICA no Liquid da section, não só o CSS do badge. Registrar gatilho por badge no Copy Map
3. **Swatches de variante:** classificar o estilo da referência (círculo de cor sólida / imagem de textura / botão de texto / dropdown). Se colorido: extrair o mapeamento nome→hex ou nome→imagem e replicar (metafield `color` ou config em `custom.css` — ver R25). Validar estado selecionado (borda/escala) no gate R81

**Aplicação:** Passo 2 (análise PDP) + Passo 13 (build) + Passo 17 (criação de produtos com tags/compare_at_price corretos).

### R87 — Popups são elementos de experiência, não ruído (complementa R72)

**Contexto:** R72 fecha popups pra limpar screenshots — correto pra validação, mas descarta silenciosamente um elemento da experiência da referência (popup de desconto/newsletter é parte da estratégia de conversão dela).

**Regra:**
1. ANTES de fechar qualquer popup (R72), inventariar: trigger (tempo em segundos / exit-intent / scroll %), conteúdo (copy completa), oferta (% ou valor), campos do formulário, screenshot do popup aberto
2. Detectar a origem: app (Klaviyo, Privy, OptiMonk — via `document.scripts`) ou nativo do tema
3. Registrar no inventário de experiência (`06. Anexos/inventario-popups-{loja}.md`)
4. Perguntar ao usuário na entrega: replicar via app equivalente, via section custom com trigger JS, ou não replicar. NUNCA omitir a existência do popup do relatório

**Aplicação:** Passo 2 + relatório final (Passo 26).

### R88 — Páginas secundárias no gate final

**Contexto:** A validação pesada cobre as páginas principais. Resultado de busca, 404, artigo de blog e contato costumam ficar "Dawn puro", destoando da identidade — giveaway instantâneo de clone.

**Regra:** Na Fase 5 (Passo 25), check de sanidade leve — 1 screenshot por página, sem Self-Healing Loop completo:
1. `/search?q={termo-com-resultados}` — cards de produto seguem o estilo clonado?
2. `/404` (URL inexistente) — tipografia/cores da marca aplicadas?
3. 1 artigo de blog (se blog existe) — template de artigo coerente?
4. Página de contato (se existe) — formulário estilizado?

Como as cores/fontes globais já foram clonadas no Passo 12, essas páginas herdam a identidade automaticamente na maioria dos casos — o check confirma. Página destoando: aplicar tokens globais no template correspondente + registrar pendência se precisar de trabalho além do sanity fix.

**Aplicação:** Fase 5 (Passo 25), antes do relatório final.

---

## Gate funcional de compra — R89

> Codifica a lição de um clone real: a fidelidade visual estava 100%, mas o carrinho e o checkout passaram quebrados porque ninguém completou uma compra de ponta a ponta na loja destino. Um clone bonito que não vende é um clone reprovado. NON-NEGOTIABLE. Incluído na leitura obrigatória do kick-off (R65).

### R89 — Gate funcional de carrinho e checkout antes de concluir

**Contexto real:** o clone passou em todas as áreas-foco visuais, mas dois defeitos só existiam no fluxo real de compra e escaparam:
1. **Idioma do checkout errado pro comprador.** O admin listava "Idioma do checkout: português (Brasil)", mas o checkout REAL do cliente renderizava **EN** (URL `/checkouts/cn/.../en-br`). O pt-BR era só a locale do preview do admin; edições de conteúdo no locale primário não chegavam ao buyer. Só foi descoberto por acaso.
2. **Checkout só com PayPal, sem cartão.** Shopify Payments não estava configurado, então quem quisesse pagar no cartão não conseguia comprar. Tráfego pago clicando e a compra morrendo na tela de pagamento.

Nenhum screenshot de página em repouso (24/25.A-D) pega isso — a validação visual prova que a loja está IDÊNTICA, nunca que ela VENDE.

**Regra:** Antes do Passo 26 (relatório), rodar o **Gate 25.E** — provar `add-to-cart → carrinho → checkout` de ponta a ponta na loja destino. Dois modos:
- **Multi-market / worldwide** (loja passou pela skill 04, tem markets/moedas): delegar 100% à skill 71, QA Funcional de Compra (`/qa-funcional-compra`) — matriz de países. O clone só conclui com o relatório da 71 anexado e ZERO FAIL crítico.
- **Single-market** (1 país/moeda): smoke-test inline mínimo (mesmos princípios da 71), 1 fluxo completo com a `moeda_principal` do input.

Os dois pontos que esse caso ensinou são gate explícito:
- **Idioma:** ler o idioma RENDERIZADO PRO COMPRADOR (texto real do checkout + o `{locale}` na URL `/checkouts/...`), NUNCA o "idioma do checkout" do admin. Divergência do idioma-alvo = FAIL crítico.
- **Pagamento:** confirmar cartão / Shopify Payments na tela de pagamento, não só PayPal/carteira. Só-carteira = FAIL crítico + pendência de config EXPLÍCITA no relatório.

**NON-NEGOTIABLE (herdado da skill 71, QA Funcional de Compra):** loja LIVE para na tela de pagamento (JAMAIS conclui compra / JAMAIS insere cartão real); dev store pode concluir 1 pedido via Bogus Gateway (cartão `1`) e cancela/reembolsa na MESMA sessão. Evidência = screenshot por etapa (G1) — sem screenshot, check não conta como PASS. Qualquer FAIL crítico → skill NÃO concluída: corrigir na fase responsável (idioma/pagamento/frete = geralmente skill 04 fase 5; add-to-cart quebrado = revisar bundle/variantes dos Passos 13/17) e re-rodar o gate.

**Aplicação:** Passo 25.E (novo) na Fase 5, antes do Passo 26.

---

## Bloco R90 a R92 — reviews e multi-template

> R90 (reviews como section estática `cs-reviews`, estrelas SVG, zero app), R91 (countdown reset meia-noite local), R92 (múltiplos templates de PDP NON-NEGOTIABLE).

### R90 — Reviews via clone visual estático (`cs-reviews`, estrelas SVG), ZERO app

**Contexto:** apps de review custam mensalidade, injetam JS pesado e amarram a loja a terceiro. O dono NÃO quer app. Prova social continua obrigatória — muda o COMO.

**Regra:** reviews NÃO migram via app. São reconstruídas como `sections/cs-reviews.liquid` (name `Reviews (clone visual)`, blocks `type: review`) com o VISUAL clonado 1:1 do widget da ref e as reviews REAIS embutidas como blocks estáticos no template JSON do PDP. Sem app, sem JS de coleta/paginação/filtro.

- **Base:** Dawn 14 não tem reviews nativo. `cs-reviews` nasce CUSTOM (R56/R62) herdando o grid do `multicolumn` + a nota do block `rating`.
- **Estrelas em SVG (não caractere):** o `<path>` do SVG é extraído do widget da ref (Passo 2.14) e renderizado 5x, fill cheio (`--cs-star`) para `i <= nota` e vazio (`--cs-star-empty`) para o resto. Fidelidade ao ícone do app.
- **Editável:** colunas desktop/mobile, cor/tamanho da estrela, rótulos + presets. Cada review é um block.
- **Gate:** >=95% — mede `.cs-reviews__card` no storefront, não app.

**Aplicação:** Passo 2.14 -> 13.3.R -> 22b. Substitui a estratégia de app/CSV de R36.

### R91 — Countdown de urgência (reset à meia-noite LOCAL, ZERO app)

**Contexto:** timers de urgência convertem, mas app custa mensalidade e data fixa zera e morre. O dono NÃO quer app.

**Regra:** se a ref exibe timer de urgência, clonar o VISUAL como snippet `cs-countdown.liquid` + `assets/cs-countdown.js`. O relógio NUNCA usa data-alvo fixa nem horário do servidor: conta até a **próxima meia-noite no fuso do VISITANTE** (`new Date` + `setHours(24,0,0,0)`) e reinicia sozinho todo dia às 00:00 locais. Formato HH:MM:SS. Visual 1:1 do `countdown-visual-{loja}.md`.

**Anti-patterns FORBIDDEN:** data-alvo fixa hardcoded; timer via horário do servidor (ignora o fuso do visitante); instalar app de countdown.

**Aplicação:** Passo 2.14 (detectar) -> Passo 13.3.C (construir).

### R92 — Múltiplos templates de PDP (NON-NEGOTIABLE)

**Contexto real:** a referencia servia 3 layouts de PDP por `templateSuffix`; a skill assumia 1 e **18 produtos** ficaram no layout errado. Multi-PDP é NON-NEGOTIABLE.

**Corrente (nenhum elo pulado):** **1.5.A** (auditar TODO produto do `/products.json`, fingerprint por sha256, tabela `Variante | # Produtos | Sample | Fingerprint | Template`) -> **13.4** (1 `product.{suffix}.json` por variante) -> **17** (cada produto recebe o `templateSuffix` da sua variante via `productUpdate`).

**Gate de igualdade tripla (bloqueio):** `count(variantes) === count(product.{suffix}.json) === count(grupos com suffix)`. Por variante: `count(produtos com suffix no destino) === # Produtos do audit`. **Spot-check:** abrir 1 PDP de cada variante e confirmar via DOM.

**Anti-patterns FORBIDDEN:** auditar só o produto principal; construir menos arquivos que variantes; criar produtos sem `templateSuffix`.

### Espinha dorsal — os 3 pilares

1. **Reconhecimento por componente + CSS pixel-perfect** (Fase 1 -> Fase 2 P14), sem tocar `layout/theme.liquid`/`base.css`.
2. **Extração populando TUDO** (`products/collections.json`) com gate de contagem 1:1 (25.D 6-7).
3. **Validação 8x5 com loop até `diff==0`** (Fase 4 -> Fase 5): 86 screenshots + diff zerado em 13 áreas x 8 breakpoints.


---

## Referências

- Skill que carrega este roteiro: `03. Skills/110. Montar a Loja a Partir do Modelo.md`
- Snapshot batch script: `_engine/criar-tema-clonado/snapshot-batch.py`
- Cache schemas Dawn: `_engine/criar-tema-clonado/fases/schemas-dawn-cache.md`
