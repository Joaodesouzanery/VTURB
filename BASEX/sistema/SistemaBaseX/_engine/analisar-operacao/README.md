# Engine - Analisar Operação

Engine da skill `03. Skills/75. Analisar Operacao.md`. Node 20+, ESM.

## Instalação

```bash
cd "_engine/analisar-operacao"
npm install      # instala xlsx (SheetJS)
```

## Pre-flight (sempre antes de executar)

```bash
node preflight.mjs
```

Valida Node 20+, lib xlsx, pastas do SistemaBaseX, breakpoints/header-map. Reporta se o Shopify CLI está instalado (opcional). Exit 0 = pronto.

## Scripts

| Script | O que faz | Destrutivo? |
|---|---|---|
| `parse-xlsx.mjs <file.xlsx> [--out o.json]` | Normaliza export Meta Ads → JSON canônico (header-map flexível) | Não (read-only) |
| `score-engine.mjs list` | Lista ações ranqueadas por pontos | Não |
| `score-engine.mjs record --action "..." --roi-before X --roi-after Y [--context "..."] [--dry-run]` | Registra resultado de uma ação no placar | Sim → tem `--dry-run` |
| `score-engine.mjs render [--dry-run]` | Regenera a tabela legível no catálogo .md | Sim → tem `--dry-run` |
| `history-rotate.mjs --loja "Nome" [--dir "Minhas Lojas"] --metrics m.json [--dry-run]` | Grava métricas no histórico da loja e rotaciona (28 dias) | Sim → tem `--dry-run` + `.bak` |

## Pontuação

- ROI sobe após a ação → `+pontos` (proporcional ao delta, cap ±5)
- ROI cai → `-pontos`
- Ações com mais pontos sobem na prioridade de recomendação.
- Fonte de verdade: `data/placar.json`. Espelho legível: catálogo .md no Conhecimento.

## Break points e header-map

- `breakpoints.json`: limiares por dimensão (criativo, funil, preço/oferta, guarda estatística). Editável.
- `header-map.json`: sinônimos PT/EN de cabeçalhos do Meta Ads Manager → KPI canônico. Adicione sinônimos quando aparecer coluna "não mapeada".

## Rollback

| Operação | Como reverter |
|---|---|
| Histórico da loja gravado errado | `node history-rotate.mjs --loja "Nome" [--dir "Minhas Lojas"] --rollback` (restaura `historico-4-semanas.md.bak`) |
| Registro errado no placar | Editar `data/placar.json` (remover entry em `historico` e ajustar `pontos/wins/losses`), depois `node score-engine.mjs render` |
| Catálogo .md corrompido | `node score-engine.mjs render` regenera a seção entre `<!-- PLACAR:START/END -->` |

> Toda gravação de histórico cria `.bak` antes de sobrescrever. `record` é incremental; use `--dry-run` pra conferir o delta antes.
