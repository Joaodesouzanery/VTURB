# Fase 1b — Extração de dados públicos (Passos 5-10)

> Carregado depois da fase 1. Extrai produtos, coleções, páginas, menus, blog, políticas via endpoints públicos.

---

### Passo 5 - Extrair produtos via endpoints públicos

1. Acessar `{url_referencia}/products.json?limit=250&page=1` via WebFetch ou Chrome Brain.
   - Se o endpoint retornar 404 ou erro → cair no fallback de scraping (Passo 5b).
   - Paginar incrementando `page` até receber array vazio.

2. Para CADA produto, extrair:
   - `title`, `handle`, `body_html`, `product_type`, `vendor`, `tags`
   - `variants[]`: `title`, `sku`, `price`, `compare_at_price`, `option1/2/3`, `weight`, `weight_unit`, `requires_shipping`, `taxable`, `inventory_quantity` (se disponível), `inventory_policy`
   - `options[]`: `name`, `values[]`
   - `images[]`: `src` (URL CDN), `alt`, `position`
   - `published_at`, `created_at`

3. Salvar como JSON em `/tmp/produtos-referencia.json`.
   - Incluir contagem total: "Total: X produtos extraídos"
   - Se tiver mais de 250 produtos, avisar ao usuário antes de continuar (processo lento).

4. Criar um **resumo** do catálogo:
   - Quantos produtos únicos
   - Quantas variantes por produto (mín/máx/média)
   - Tipos de produto (product_types únicos)
   - Vendors únicos

5. Avisar o usuário: "Extraí X produtos da referência. Iniciando criação na loja destino..."

> **NON-NEGOTIABLE — Extração popula TUDO (Pilar 2).** `products.json`/`collections.json` públicos são a fonte da verdade. A extração + populate reproduz TUDO: cada produto, cada variante (`price`, `compare_at_price`, `sku`, `option1/2/3`, `weight`), cada imagem na `position` original, cada coleção e a ORDEM manual dos produtos. Nada de amostra.
>
> **Gate de contagem 1:1 (bloqueio):** `count(produtos extraídos) == count(produtos criados)` e `count(variantes) == count(variantes)`. Reconferir no Checkpoint F4 (25.D itens 6-7). Se `/products.json` responder 404/bloqueio, o fallback 5b (scraping via Chrome Brain) é OBRIGATÓRIO.

#### Passo 5b - Fallback: scraping via Chrome Brain (se /products.json bloqueado)

Se o endpoint JSON estiver bloqueado:

1. Navegar pra `/collections/all` (todos os produtos).
2. Scrollar até o fim pra carregar todos (infinite scroll ou paginação).
3. Extrair links de todos os produtos.
4. Para cada produto, navegar pra página individual e extrair:
   - Título, descrição, preço, preço comparativo
   - Variantes (selectors/options no DOM)
   - Imagens (todas as URLs do gallery)
   - Tags e tipo (do meta ou breadcrumb)

### Passo 6 - Extrair coleções

1. Acessar `{url_referencia}/collections.json` via WebFetch.
   - Se bloqueado → scraping via Chrome Brain (navegar no menu, identificar coleções).

2. Para CADA coleção:
   - `title`, `handle`, `body_html`, `image` (se houver), `sort_order`
   - Acessar `{url_referencia}/collections/{handle}/products.json?limit=250` pra listar os produtos da coleção (paginar).
   - Guardar a **ordem dos produtos** dentro de cada coleção.

3. **Tipos de coleção:** Identificar se a coleção é manual (ordem fixa) ou automática (condições de filtro). Se automática, anotar as condições (ex: `product_type = "Camiseta"`).

4. Salvar em `/tmp/colecoes-referencia.json`.

### Passo 7 - Extrair páginas

Páginas não tem endpoint JSON público. Extrair via Chrome Brain:

1. Identificar todas as páginas pelos links do header e footer (ex: `/pages/about`, `/pages/faq`, `/pages/contato`).
2. Navegar pra cada página via Chrome Brain.
3. Extrair:
   - Título da página (do `<h1>` ou `<title>`)
   - Handle (da URL: `/pages/{handle}`)
   - Conteúdo HTML (inner HTML do `main` ou `article`)
   - Metafields se visíveis

4. Salvar em `/tmp/paginas-referencia.json`.

### Passo 8 - Extrair menus

Extrair estrutura de menus via Chrome Brain:

1. **Menu principal (header):**
   - Navegar pra home.
   - Extrair todos os itens do menu principal:
     ```javascript
     const menuItems = [...document.querySelectorAll('header nav a, .header__menu a')].map(a => ({
       text: a.textContent.trim(),
       href: a.href,
       handle: a.href.split('/').pop()
     }));
     ```
   - Para sub-menus, abrir cada dropdown e extrair os itens.

2. **Menu do footer:**
   - Extrair cada coluna de links do footer com título e itens.

3. **Menu mobile** (se diferente do desktop):
   - Abrir o drawer mobile e extrair os itens.

4. Salvar em `/tmp/menus-referencia.json`.

### Passo 9 - Extrair blog e artigos (se existir)

1. Verificar se existe blog: acessar `{url_referencia}/blogs.json`.
2. Para cada blog, acessar `{url_referencia}/blogs/{handle}/articles.json?limit=250`.
3. Para cada artigo extrair:
   - `title`, `handle`, `author`, `body_html`, `summary_html`
   - `image` (URL da imagem de capa, se houver)
   - `tags`, `published_at`
4. Salvar em `/tmp/blog-referencia.json`.

### Passo 10 - Extrair políticas

Navegar via Chrome Brain pra cada URL de política:

1. `{url_referencia}/policies/refund-policy`
2. `{url_referencia}/policies/privacy-policy`
3. `{url_referencia}/policies/terms-of-service`
4. `{url_referencia}/policies/shipping-policy`

Extrair o HTML do conteúdo de cada política.

# CHECKPOINT FASE 2 — Extração de Dados (Quality Gate ESTRITO)

**BLOQUEIO ABSOLUTO:** Cada item exige evidência (path do arquivo JSON). Sem evidência = `[ ]`.

| # | Item | Evidência exigida | Status |
|---|------|-------------------|--------|
| 1 | Produtos extraídos com TODOS os campos (título, handle, body_html, variantes, opções, preços, compare_at_price, imagens, alt, tags, vendor, product_type) | `/tmp/produtos-referencia.json` com `Total: N produtos` no topo | [ ] |
| 2 | Contagem `N_ref` anotada e registrada para validação no Checkpoint F4 | linha no JSON + nota | [ ] |
| 3 | Coleções extraídas com produtos E ordem manual replicável | `/tmp/colecoes-referencia.json` com array `products_ordered` por coleção | [ ] |
| 4 | Páginas do menu extraídas com `body_html` completo (não summary) | `/tmp/paginas-referencia.json` | [ ] |
| 5 | Menus mapeados (header + footer + mobile drawer) com nesting de sub-menus | `/tmp/menus-referencia.json` com array de níveis | [ ] |
| 6 | Blog e artigos extraídos com `body_html`, `tags`, `published_at`, `image` (se houver) | `/tmp/blog-referencia.json` ou nota "loja sem blog" | [ ] |
| 7 | Políticas extraídas (refund, privacy, terms, shipping) com HTML completo | `/tmp/politicas-referencia.json` | [ ] |
| 8 | Body HTML dos produtos contém TODA a copy da PDP (descrição, bullets, FAQ inline) | spot-check de 3 produtos: diff entre `body_html` extraído e DOM via Chrome Brain == zero | [ ] |
| 9 | Reviews extraídas para `reviews-referencia-{loja}.json` (agregadas por handle) + VISUAL do widget capturado, prontas para embed como blocks estáticos da `cs-reviews` (R90 — ZERO app) | `06. Anexos/reviews-referencia-{loja}.json` + `reviews-visual-{loja}.md` | [ ] |
| 10 | Vídeos baixados localmente ou URLs externas validadas (HEAD 200) prontas para re-upload | `/tmp/videos-ref/` ou inventário com URLs verificadas | [ ] |
| 11 | Comparação visual aprovada das páginas tocadas nesta fase (não há mudança visual, só extração — gate é "extração não quebrou referência") | screenshot pós-extração igual ao pré | [ ] |

**Gate de copy completa:**
```
copy_ref = inventário de copy (Passo 2.12)
copy_extracted = soma de TODAS as strings em produtos + coleções + páginas + menus + políticas + blog
∀ linha em copy_ref → existe em copy_extracted (sha256 match)
```
Se alguma linha de `copy_ref` não tem origem identificável nos JSONs extraídos → BLOQUEIO. Voltar e completar extração.

Se qualquer item estiver `[ ]` ou sem evidência → voltar ao passo correspondente.
