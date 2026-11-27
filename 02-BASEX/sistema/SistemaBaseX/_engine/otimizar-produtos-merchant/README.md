# Otimizar Produtos para Merchant Center — Engine

Engine da skill [[47. Otimizar Produtos para Merchant Center]].

Preenche em massa os campos que o Google Merchant Center exige (categoria, cor, tamanho,
faixa etária, gênero, condição, custom labels) e libera a venda de produto sem estoque.

## Fluxo

```
preflight.mjs   -> valida auth, scopes, taxonomia, pastas
snapshot.mjs    -> estado pré-execução (é a base do rollback)
decide-fields   -> analisa produto a produto e grava um plano (não toca na loja)
apply-fields    -> aplica o plano (productUpdate + productVariantsBulkUpdate)
publish-channel -> publica no canal Google & YouTube
audit.mjs       -> diff antes vs depois
rollback.mjs    -> reverte usando o snapshot
```

## Scripts

| Comando | Função |
|---|---|
| `node preflight.mjs --store {loja}` | Valida ambiente |
| `node snapshot.mjs --store {loja}` | Snapshot completo do catálogo |
| `node decide-fields.mjs --snapshot {plano} --lang es-ES` | Monta o plano (read-only) |
| `node apply-fields.mjs --plan {plano} --store {loja}` | Simula (padrão dry-run) |
| `node apply-fields.mjs --plan {plano} --store {loja} --dry-run=false` | Aplica na loja |
| `node publish-channel.mjs --store {loja} --snapshot {snap} --dry-run=false` | Publica no Google & YouTube |
| `node audit.mjs --snapshot {snap} --store {loja}` | Re-fetch + diff |
| `node rollback.mjs --snapshot {snap} --store {loja} --dry-run=false` | Reverte |

`{loja}` é o handle da sua loja, no formato `minhaloja.myshopify.com`.

## Dry-run é o padrão

Os quatro scripts que escrevem na loja (`decide-fields`, `apply-fields`, `publish-channel`,
`rollback`) começam em dry-run. Eles só gravam de verdade com `--dry-run=false` escrito na linha
de comando. Rodar sem a flag imprime `[DRY]` em cada item e não manda mutation nenhuma.

## GTIN e MPN: esta engine não preenche

Nenhum script tenta descobrir, gerar ou gravar GTIN (código de barras) ou MPN. Produto de
fornecedor genérico não tem esses códigos, e inventar um faz o Merchant reprovar o item.

Por isso o campo `custom_product` sai como `true`, que no feed do Google significa
`identifier_exists = no`: você está declarando que o produto não tem identificador único. É a
declaração honesta e é o que faz o Merchant aceitar o item sem GTIN.

Se os seus produtos realmente têm GTIN ou MPN cadastrado, rode com `--custom-product=false`.

## Idiomas

Os arquivos em `taxonomy/` são o TXT oficial do Google, usado direto, sem conversão.

| Arquivo | Cobre |
|---|---|
| `en-US.txt` | Estados Unidos, Canadá, Reino Unido, Irlanda |
| `es-ES.txt` | Espanha |

Para outro idioma, baixe o arquivo oficial dentro de `taxonomy/` e passe `--lang`:

```bash
curl -o taxonomy/fr-FR.txt https://www.google.com/basepages/producttype/taxonomy-with-ids.fr-FR.txt
```

A taxonomia embarcada é a versão `2021-09-21`. Os IDs continuam válidos; se quiser a mais
recente, baixe por cima com o comando acima.

O `decide-fields.mjs` tem dicionário de cores, sinônimos e atalhos de categoria para `es-ES`,
`en-US` e `pt-BR`. Em outro idioma ele ainda casa a categoria por sobreposição de palavras, mas
não detecta cor nem preenche tamanho padrão.

## Rollback

Sempre a partir do snapshot tirado antes da execução:

```bash
node rollback.mjs --snapshot snapshots/minhaloja-2026-01-15T10-00.json --store minhaloja.myshopify.com
# conferiu a lista? então aplica:
node rollback.mjs --snapshot snapshots/minhaloja-2026-01-15T10-00.json --store minhaloja.myshopify.com --dry-run=false
```

O rollback reescreve os metafields com o valor que estava no snapshot. Metafield que não existia
antes e foi criado pela engine continua na loja com o valor novo: o rollback não apaga metafield,
só devolve o valor antigo de quem já tinha um. Para zerar um campo criado do zero, apague pelo
admin da Shopify.

## Segurança

- Toda operação que escreve exige `--dry-run=false` explícito
- Snapshot obrigatório antes do apply
- A engine não toca em arquivo de tema: só produto, variante, estoque e canal de venda
- Campo já preenchido não é sobrescrito, a engine só completa o que está vazio

## Requisitos

- Node 20 ou mais novo
- Shopify CLI (`npm i -g @shopify/cli`)
- Loja autenticada com os scopes que o `preflight.mjs` mostra na tela
- App gratuito Google & YouTube instalado na loja (só para o `publish-channel.mjs`)

Zero dependência npm: `npm install` não baixa nada.

## Troubleshooting

Ver a seção "Troubleshooting" da skill em `03. Skills/47. Otimizar Produtos para Merchant Center.md`.
