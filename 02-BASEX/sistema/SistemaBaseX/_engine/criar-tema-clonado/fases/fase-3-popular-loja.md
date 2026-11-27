# Fase 3 — Popular loja com dados (Passos 17-23)

> Carregado depois do tema empurrado. Cria produtos, coleções, páginas, menus, blog, políticas, reviews, re-push templates.

---

### Passo 17 - Criar produtos na loja destino (com templateSuffix correto — Princípio 2)

> Cada produto recebe o `templateSuffix` correspondente à variante de PDP onde estava na referência. Mapeamento vem do `audit-pdp-templates-{loja}.md` (Passo 1.5.A). Produtos da Variante A → suffix vazio (default `product.json`). Variante B → suffix `bento`. E assim por diante.

1. Usar `shopify-plugin:shopify-admin` para criar produtos via API:
   ```graphql
   mutation productCreate($input: ProductInput!) {
     productCreate(input: $input) {
       product { id handle title }
       userErrors { field message }
     }
   }
   ```

2. Para CADA produto extraído:
   - Criar o produto com todos os campos
   - Criar variantes com preços, SKUs e opções corretos
   - Fazer upload de TODAS as imagens do produto
   - Verificar que o produto foi criado corretamente

3. Publicar o produto em todos os canais de venda:
   ```graphql
   mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
     publishablePublish(id: $id, input: $input) {
       publishable { ... on Product { publishedOnCurrentChannel } }
     }
   }
   ```

4. Após criar todos os produtos, verificar a contagem: total criado deve bater com total extraído.

5. **Atribuir o `templateSuffix` por produto (NON-NEGOTIABLE — R92).** Para CADA produto, ler a variante dele no `audit-pdp-templates-{loja}.md` (mapa `handle -> variante -> suffix`) e aplicar via `productUpdate(input:{id, templateSuffix})`. Variante default -> `templateSuffix: null`; variante B/C -> `"bento"`/`"chapter"`/etc.

6. **Gate de encadeamento 1.5.A -> 13.4 -> 17 (bloqueio).** `count(variantes detectadas) === count(product.{suffix}.json) === count(grupos com suffix atribuído)`. E por variante: `count(produtos com aquele suffix no destino) === # Produtos do audit`. Spot-check: abrir 1 PDP de CADA variante (aba anônima) e confirmar via DOM que as sections batem com o fingerprint.

7. **Gate de contagem 1:1 (Pilar 2 — bloqueio).** `count(produtos criados) === count(produtos em /tmp/produtos-referencia.json)`, cada um com o MESMO número de variantes e imagens (na `position` original). Enquanto não bater 1:1, o Passo 17 NÃO está concluído — inspecionar `userErrors` do `productCreate` e recriar o que faltou.

### Passo 18 - Criar coleções

1. Criar cada coleção com título, handle e descrição.
2. Para coleções manuais: adicionar produtos e definir a ordem (collectionsAddProducts mutation com position).
3. Para coleções automáticas: configurar as regras (conditions) via API.
4. Fazer upload da imagem de capa da coleção (se houver).

> **Gate de coleção 1:1 (Pilar 2 — bloqueio).** Cada coleção do `colecoes-referencia.json` existe no destino com os MESMOS produtos e, para manuais, a ORDEM idêntica (`collectionAddProducts` com `position`). `count(coleções dest) === count(coleções ref)`. Espelha o Checkpoint F4 (25.D item 7).

### Passo 19 - Criar páginas

Para cada página extraída no Passo 7:
1. Criar via `POST /admin/api/2024-01/pages.json`
2. Verificar que o handle da página criada bate com o handle do menu (Passo 8).

### Passo 20 - Criar menus

1. Criar o menu principal (header):
   ```
   POST /admin/api/2024-01/menus.json
   ```
   Com todos os itens e sub-menus na ordem correta.

2. Criar o menu do footer (cada coluna como um menu separado ou como sub-itens).

3. Verificar handles: links de coleção devem ter handles que existem na loja destino.

### Passo 21 - Criar blog e artigos (se houver)

1. Criar o blog: `POST /admin/api/2024-01/blogs.json`
2. Criar cada artigo: `POST /admin/api/2024-01/blogs/{blog_id}/articles.json`
3. Para artigos com imagens: usar URL externa ou fazer upload separado.

### Passo 22 - Configurar políticas

Via Admin API ou diretamente nas configurações:
`PUT /admin/api/2024-01/policies.json`

### Passo 22b - Migrar REVIEWS (OBRIGATÓRIO — gate de réplica exata)

Reviews são prova social crítica. Não podem ser ignoradas. Usar dados extraídos no Passo 2.14 + export do Checkpoint F2.

#### Passo 22b.0 — Pre-flight CDP por produto (NON-NEGOTIABLE)

**Antes de qualquer tentativa de migração**, verificar via Chrome DevTools Protocol se cada produto-fonte realmente tem reviews públicas renderizadas. Apps de review (BK Reviews, Loox, areviewsapp, Judge.me, etc.) retornam mensagens enganosas tipo "App do concorrente não compatível" quando o widget está presente mas vazio. Sem essa checagem, o gate falha sem causa diagnosticável.

**Por que CDP e não curl:** widgets de review carregam via JS depois do DOM inicial. `curl` retorna HTML estático = sempre 0 reviews aparentes. CDP renderiza o JS completo.

```js
import CDP from 'chrome-remote-interface';

async function countReviewsOnPDP(url, waitMs = 9000) {
  await fetch(`http://localhost:9222/json/new?${url}`, { method: 'PUT' });
  await new Promise(r => setTimeout(r, waitMs));
  const targets = await fetch('http://localhost:9222/json').then(r => r.json());
  const tab = targets.find(t => t.url === url && t.type === 'page');
  if (!tab) return { count: 0, error: 'tab not opened' };
  const client = await CDP({ target: tab.webSocketDebuggerUrl });
  await client.Runtime.enable();
  const r = await client.Runtime.evaluate({
    expression: `(() => {
      const m = document.body.innerText.match(/(\\d+)\\s*(reviews?|avaliações?|avis|reseñas)/i);
      const widgets = {
        loox: !!document.querySelector('#looxReviews, .loox-rating[data-rating]'),
        areviewsapp: !!document.querySelector('[class*="areviews"]'),
        bk: !!document.querySelector('#bk-reviews-root, .bk-reviews'),
        judgeme: !!document.querySelector('.jdgm-prev-badge__text'),
        yotpo: !!document.querySelector('.yotpo .write-review'),
        stamped: !!document.querySelector('.stamped-fa, .stamped-reviews')
      };
      return JSON.stringify({
        count: m ? parseInt(m[1]) : 0,
        widgetApp: Object.entries(widgets).find(([_, v]) => v)?.[0] || null
      });
    })()`,
    returnByValue: true
  });
  await client.close();
  await fetch(`http://localhost:9222/json/close/${tab.id}`).catch(() => {});
  return JSON.parse(r.result.value);
}
```

**Decisão por resultado:**

| count na fonte | Ação |
|---|---|
| `> 0` | Prosseguir com import normal nos passos abaixo |
| `0` mas widget presente | **STOP. Perguntar ao user:** "Produto X não tem reviews na fonte. Deixa sem ou gera via skill `colocar-reviews` modo CRIAR?" Esperar resposta antes de prosseguir |
| Erro/timeout no CDP | Reportar e perguntar se prossegue mesmo assim |

**Documentar resultado por produto no inventário:** adicionar coluna `reviews_count_src` antes de tentar migração. Produtos com 0 reviews na fonte ficam marcados explicitamente — não aparecem como "falha de migração" no relatório final.

**Estratégia (embutir na `cs-reviews`, ZERO app):**

As reviews de `06. Anexos/reviews-referencia-{loja}.json` viram **blocks estáticos** da section `cs-reviews` (construída no Passo 13.3.R, estrelas SVG) dentro do template JSON de cada PDP. Nenhum app é instalado no destino (R90). O widget dinâmico não é necessário.

**Fluxo:**

1. **Gerar o block-map por produto** a partir do JSON extraído (agregado por handle `{ "handle": [reviews...] }`). Cada review vira um block `review`:
   ```js
   import fs from 'node:fs';
   const data = JSON.parse(fs.readFileSync('06. Anexos/reviews-referencia-{loja}.json','utf8'));
   const out = {};
   for (const [handle, reviews] of Object.entries(data)) {
     const blocks = {}, order = [];
     reviews.forEach((rv, i) => {
       const id = `r${i+1}`;
       blocks[id] = { type: 'review', settings: {
         author: rv.author || 'Cliente',
         rating: Math.max(1, Math.min(5, Math.round(rv.rating || 5))),
         title: rv.title || '', body: rv.body || '', date: rv.date || '',
         verified: !!rv.verified, images: (rv.image_urls || []).join(',')
       }};
       order.push(id);
     });
     out[handle] = { type: 'cs-reviews', blocks, block_order: order,
       settings: { count_label: 'avaliações', star_color: '#f5a623', star_empty_color: '#dddddd', columns_desktop: 3, columns_mobile: 1 } };
   }
   fs.writeFileSync('/tmp/cs-reviews-blocks-{loja}.json', JSON.stringify(out, null, 2));
   ```

2. **Embutir no template do PDP.** Para cada fingerprint de PDP (Passo 13.4), adicionar a instância `cs_reviews` ao template JSON correspondente (`templates/product.json`, `product.bento.json`, etc.), abaixo do `main-product`, com os `blocks` e `block_order` do produto. Fotos externas podem ser mantidas por URL ou re-upload como Shopify File (registrar a escolha no inventário).

3. **Push seguro (P1-P8 — 1 arquivo por vez):** cada template JSON sobe INDIVIDUALMENTE, iterando um `--only ARQUIVO` por vez (`--only templates/product.json`, depois `--only templates/product.bento.json`, etc. — NUNCA glob `product*.json`, que casa múltiplos arquivos e viola P2/R53) + `shopify theme check` local. `layout/theme.liquid` NUNCA é tocado (shopify-theme-safety).

4. **Validação pós-embed (Chrome Brain no PDP do destino):**
   ```javascript
   return {
     cards: document.querySelectorAll('.cs-reviews__card').length,
     avg: document.querySelector('.cs-reviews__avg')?.textContent || null
   };
   ```
   Aceitar se `cards >= 0.95 * total_ref` por produto (medido na `cs-reviews`, não em app).

5. **Atualizar inventário:** marcar cada linha do `inventario-reviews-{loja}.md` com `Match (≥95%)? = [x]` + contagem real de `.cs-reviews__card`.

**Anti-pattern:** instalar Loox/Judge.me/Yotpo no destino "pra ficar mais fácil". O dono NÃO quer app — reviews são estáticas na `cs-reviews`. Se faltar review na fonte, perguntar ao user — nunca inventar.

### Passo 23 - Re-push dos templates do tema (pós-publicação)

Após criar todos os produtos e coleções, os templates do tema precisam ser atualizados com os handles reais (não placeholders).

1. Atualizar os templates JSON com handles reais:
   - `featured-collection` section: `collection: "handle-da-colecao-real"`
   - `collection-list` section: listar as coleções criadas

2. Fazer push apenas dos templates modificados:
   ```bash
   shopify theme push --store <destino> --theme <id-tema-dawn> --path /tmp/tema-clone/ --only "templates/index.json" --allow-live
   ```
   Repetir pra outros templates se necessário (`templates/collection.json`, etc.).

**Verificação pós-push obrigatória:**
```bash
shopify theme pull --only templates/index.json --theme {TEMA_ID} --store {STORE}
diff /tmp/tema-clone/templates/index.json /tmp/pulled/templates/index.json && echo "OK — upload confirmado" || echo "ERRO — arquivo não chegou ao servidor"
```
Se diff mostrar diferença → repetir push antes de prosseguir.

3. Verificar que a home page renderiza produtos reais (não placeholders).

---

# CHECKPOINT FASE 4 — População de Dados (Quality Gate ESTRITO)

**BLOQUEIO ABSOLUTO:** Cada item exige evidência. Sem evidência = `[ ]`.

| # | Item | Evidência exigida | Status |
|---|------|-------------------|--------|
| 1 | Inventário de IMAGENS: TODAS as linhas `[x] ok` (zero `[ ] pendente`) | inventário atualizado | [ ] |
| 2 | `count(produtos criados) === count(produtos extraídos)` | output do `productCount` GraphQL na destino vs `Total` no JSON | [ ] |
| 3 | Cada produto tem TODAS as imagens (não só a primeira) | spot-check de 5 produtos: `count(media) destino === count(images) ref` | [ ] |
| 4 | Coleções criadas com produtos + ordem manual idêntica | diff entre `products_ordered` do JSON ref e ordem real na destino | [ ] |
| 5 | Menus criados com nesting idêntico | comparação JSON do menu destino vs `menus-referencia.json` | [ ] |
| 6 | Páginas criadas com `body_html` idêntico (sha256 do HTML normalizado match) | linha do inventário de copy marcada `[x] match` para cada página | [ ] |
| 7 | Políticas configuradas com texto idêntico | sha256 match entre `politicas-referencia.json` e GET das policies destino | [ ] |
| 8 | Blog/artigos criados (se ref tinha blog) com `body_html` match | sha256 match por artigo | [ ] |
| 9 | Tudo publicado no canal Online Store | query `publishedOnCurrentPublication: true` para amostra de 5 produtos | [ ] |
| 10 | Re-push dos templates: handles reais nas sections (zero placeholders) | grep `gid://shopify/Collection/` em `templates/*.json` retorna URLs reais | [ ] |
| 11 | Home page renderiza produtos reais (não cards vazios) | screenshot da home destino mostrando produtos com título/preço | [ ] |
| 12 | **REVIEWS embutidas na `cs-reviews`** (ZERO app): cada produto com `cards_renderizados >= 0.95 * total_ref` na section estática | inventário-reviews com TODAS as linhas `Match (≥95%)? = [x]` + contagem de `.cs-reviews__card` no storefront | [ ] |
| 13 | **COPY 1:1**: TODAS as linhas do inventário-copy com `Match? = [x]` (sha256 ref == sha256 destino) | inventário-copy atualizado | [ ] |
| 14 | **VÍDEOS 1:1**: TODAS as linhas do inventário-videos com `Match? = [x]` + reprodução confirmada | inventário-videos atualizado | [ ] |
| 15 | Zero imagens quebradas (`img.naturalWidth === 0`) em home, PDP, coleção | output do script de validação salvo em `06. Anexos/imagens-quebradas-{data}.json` (deve ser array vazio) | [ ] |
| 16 | Comparação visual aprovada em 8 breakpoints × 5 páginas × N variantes de template | tabela diff em `06. Anexos/diff-f4-{data}.md` zerada para cada variante | [ ] |
| 17 | `templateSuffix` correto em cada produto/coleção/página (Princípio 2) | spot-check: amostra de 10 produtos da Variante B → todos com suffix correto via `product { templateSuffix }` | [ ] |
| 18 | Self-Healing Diff Loop do Passo 24.D zerado por template | `self-healing-tracker-{loja}.md` com todas as linhas `[x] zero diff` ou escaladas | [ ] |

**Verificação de imagens faltando:**
```javascript
// Via Chrome Brain, verificar imagens quebradas na home
const broken = [...document.querySelectorAll('img')].filter(i => !i.complete || i.naturalWidth === 0);
return broken.map(i => ({ src: i.src, alt: i.alt }));
```
