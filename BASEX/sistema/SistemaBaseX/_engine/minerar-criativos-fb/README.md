# minerar-criativos-fb

Lê a Biblioteca de Anúncios da Meta e devolve os criativos que o concorrente está rodando, com a imagem e o texto de cada um.

## Dois caminhos, e o padrão é o de graça

| | Pelo navegador | Pelo Apify |
|---|---|---|
| Custo | zero | serviço pago, precisa de token |
| Conta | nenhuma | conta no Apify |
| Instalação | só o Chrome, que você já tem | `npm install` nesta pasta |
| Volume | dezenas por rodada, de propósito | centenas |

**O caminho pelo navegador é o padrão.** Ele abre a mesma biblioteca pública que você abriria no Chrome, lê o total de anúncios no ar, rola a página e baixa as peças.

```bash
node preflight.mjs                                          # confere o que tem na máquina
node coletar-navegador.mjs --pagina 15087023444 --pais DE   # coleta
node coletar-navegador.mjs --pagina 15087023444 --so-contar # só quantos estão no ar
```

O id da página está no endereço da Biblioteca de Anúncios, depois de `view_all_page_id=`.

Sai uma pasta com as imagens e um `anuncios.json` com o texto, a chamada e as dimensões de cada peça.

Três decisões que valem saber:

- **O total vem do "~N resultados" que a página escreve**, não da contagem dos cartões na tela. Contar cartão subconta muito: uma página com 300 anúncios mostra 3 de cara.
- **A mesma arte aparece em vários endereços.** O coletor compara o conteúdo do arquivo, não a URL, então 12 coletados podem virar 7 peças distintas. O resumo diz quantas eram repetidas.
- **Ele vai devagar e tem teto por rodada.** Ler a biblioteca pública sem pressa é o que uma pessoa faz estudando. Varrer centenas de páginas em minutos é o que faz a Meta bloquear.

## O caminho pelo Apify (opcional)

Só se você já tem conta. Ele dá mais volume e roda sem abrir navegador.

## Pipeline

```
padrao (de graca):  preflight → coletar-navegador → voce escreve o briefing
Apify (opcional):   preflight-apify → scrape → filter → score → thumbnails
```

## Setup do caminho pelo Apify

```bash
cd "_engine/minerar-criativos-fb"
npm install
```

Adicionar ao `_engine/.env`:
```
APIFY_API_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Token em https://apify.com → Settings → Integrations → API tokens.
Actor usado: `curious_coder/facebook-ads-library-scraper` (fallback: `apify/facebook-ads-library-scraper`).

Plano free do Apify dá $5/mês, suficiente pra ~5 minerações completas.

## Uso isolado

```bash
# 0. Validar ambiente
node preflight.mjs

# 1. Scrape
node scrape.mjs --nicho "relogio masculino" --paises "US,GB,DE,FR" --termos "watch,montre,uhr,reloj"

# 2. Filtrar
node filter.mjs --input outputs/raw-relogio-masculino-XXX.json --tamanho medium --tempo-min 30 --variacoes-min 3 --formato all

# 3. Score
node score.mjs --input outputs/filtered-relogio-masculino-XXX.json --limite 30

# 4. Thumbnails
node thumbnails.mjs --input outputs/scored-relogio-masculino-XXX.json
```

## Argumentos

### scrape.mjs
- `--nicho` (string) — usado pro slug do arquivo
- `--paises` (csv ISO) — default: US,GB,DE,FR,ES,IT,PT,NL
- `--termos` (csv) — default: o próprio nicho

### filter.mjs
- `--input` (path) — obrigatório
- `--tamanho` — small | medium | large | all (default medium)
- `--tempo-min` (dias, default 30)
- `--variacoes-min` (default 3)
- `--formato` — video | imagem | all (default all)

### score.mjs
- `--input` (path) — obrigatório
- `--limite` (default 30)

### thumbnails.mjs
- `--input` (path do scored.json)

## Outputs

| Arquivo | Conteúdo |
|---|---|
| `outputs/raw-{slug}-{ts}.json` | Tudo que o Apify retornou |
| `outputs/filtered-{slug}-{ts}.json` | Após aplicar filtros de qualidade |
| `outputs/scored-{slug}-{ts}.json` | Top N pontuados em lanes |
| `outputs/thumbs-{slug}/` | JPGs das thumbnails |

O JSON final (`scored-*.json`) é o que você lê para escrever o briefing de cada criativo.

## Blacklists

`blacklists/global.json` aplica em qualquer nicho.
`blacklists/{nicho}.json` aplica adicionalmente quando o `meta.nicho` do scrape bate.

Adicionar nova blacklist: criar arquivo JSON com `{ "marcas": ["Nome 1", "Nome 2"] }`.

## Custo Apify

| Volume | Custo estimado |
|---|---|
| 1 país × 1 termo × 500 ads | ~$0.05 |
| 8 países × 5 termos × 500 ads | ~$2.00 |

Plano free dá $5/mês.
