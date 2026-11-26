# Engine: shopify-worldwide-setup/translate

Sub-engine da fase de tradução da skill `04. Setup Loja Worldwide Shopify`.

Scan e aplicação de traduções via `translationsRegister` para qualquer loja Shopify, com um glossário
que fixa os termos que a tradução automática costuma errar.

## Arquivos

| Arquivo | Função |
|---|---|
| `preflight.mjs` | Valida shopify CLI, locale alvo habilitado, glossário presente |
| `scan.mjs` | Pagina `translatableResources` GraphQL e identifica gaps (modo `completar`) ou divergências (modo `auditar`) |
| `apply.mjs` | Aplica overrides aprovados via `translationsRegister` em lotes de 100 |
| `glossary/generic.json` | Glossário base com termos comuns de e-commerce (EN→FR/DE/ES) |
| `package.json` | Node 20+ |

## Uso

```bash
# Pre-flight
node preflight.mjs --store {handle} --locale fr

# Scan (modo completar — campos sem tradução)
node scan.mjs --store {handle} --locale fr --modo completar > overrides-fr.json

# Scan (modo auditar — tradução existente que diverge do glossário)
node scan.mjs --store {handle} --locale fr --modo auditar --glossario glossary/generic.json > overrides-fr-auditar.json

# Apply (depois de revisar o arquivo de overrides na mão)
node apply.mjs --store {handle} --locale fr --overrides overrides-fr.json [--dry-run]
```

O `scan.mjs` só propõe. Nada vai para a loja enquanto você não rodar o `apply.mjs`, e o arquivo de
overrides é texto legível, feito para ser revisado antes.

## Dry-run

`apply.mjs --dry-run` mostra os 10 primeiros overrides que SERIAM aplicados, sem executar mutations.

## Glossário

`glossary/generic.json` cobre termos comuns em FR, DE e ES:
- Watch → Montre/Uhr/Reloj (não "Regarde"/"Sieht"/"Observa")
- Color → Couleur/Farbe/Color
- Add to cart → Ajouter au panier/In den Warenkorb/Añadir al carrito
- Free shipping, Size, Material, Filter, Sort by, Clear all, Apply, Out of stock

Para um nicho específico, copie o `generic.json`, edite os termos e passe o caminho do seu arquivo:

```bash
node scan.mjs --store {handle} --locale fr --glossario glossary/meu-nicho.json
```

O formato é `en_to_fr`, `en_to_de`, `en_to_es` (pares termo em inglês → termo traduzido) mais
`skip_keys_universal` (lista de prefixos e strings que nunca são traduzidos). O arquivo é carregado
inteiro, não há herança entre glossários: o seu precisa conter tudo que você quer aplicar.

## Filtros automáticos (skip)

- **URL fields** (começam com `/`, `shopify://`, `http`, `mailto:`, ou a chave termina em `_url`, `handle`, `url`) — NUNCA recebem texto traduzido
- **Shopify nativas** (`shopify.checkout.*`, `customer_account.*`) — strings da plataforma
- **Placeholders Liquid** (`[[savings]]`, `[[count]]`, `{{ shop.name }}`) — manter original
- **Tags identificadoras** (`best-seller`, `low-stock`, `new-arrival`) — manter original
- **Siglas técnicas** (`SKU`, `CDN`, `URL`, `HR`, `MIN`, `SEC`, `DAYS`) — manter original

Tudo nessa lista, menos os URL fields, vem do próprio glossário, no campo `skip_keys_universal`,
então dá para acrescentar os seus. O filtro de URL está escrito em código, e roda de novo dentro do
`apply.mjs` como segunda barreira.
