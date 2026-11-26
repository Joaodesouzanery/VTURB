# Engine: criar-tema-clonado

Motor da skill `03. Skills/110. Montar a Loja a Partir do Modelo.md`.

## Estrutura modular (quebra em fases)

A skill 110 é o índice fino e carrega só:
- Os princípios do clone (bloqueantes)
- Regra Mestra Section editável
- Quality Gates G0-G3
- Regras de Push Seguro P1-P8
- Tabela de passos com link pra cada fase

Os **passos de execução** vivem em arquivos separados em `fases/` e são carregados **sob demanda** quando uma execução chega na fase.

## Arquivos

| Arquivo | Cobre Passos | Linhas approx |
|---|---|---|
| `regras-criticas.md` | Regras aprendidas na prática (P1-P30+) | ~140 |
| `fase-1-extracao-referencia.md` | Passos 1.5, 1, 2, 3, 4 (descoberta + análise visual + design system + sections) | ~600 |
| `fase-1b-dados-publicos.md` | Passos 5-10 + Copy Map (produtos, coleções, páginas, menus, blog, políticas) | ~280 |
| `fase-2-construcao-tema.md` | Passos 11-16 (pull tema destino + settings + sections + CSS + assets + push) | ~620 |
| `fase-3-popular-loja.md` | Passos 17-23 (criar produtos, coleções, páginas, menus, blog, políticas, re-push templates) | ~170 |
| `fase-4-validacao.md` | Passo 24 + 24.D (Self-Healing Loop) + 24.E (Checkpoint humano) | ~420 |
| `fase-5-finalizacao.md` | Passos 25 (Checklist final) + 26 (Relatório + arquivamento) + Troubleshooting | ~180 |

## Como o agente carrega

Quando o clone é iniciado (via `/clonar-loja`):

1. **Leitura inicial:** só o índice principal (`02. Criar Tema Clonado.md`)
2. **Por fase:** quando chega no início de cada fase, lê o arquivo correspondente
3. **Princípios e Quality Gates:** mantidos no índice (sempre carregados — são blocking)

## Economia de contexto

| Modo | Linhas carregadas | Vs carregar tudo de uma vez |
|---|---|---|
| Índice + 1 fase relevante | ~430 + ~300 = ~730 | -73% |
| Índice + 3 fases (execução média) | ~430 + ~900 = ~1330 | -51% |
| Índice + TODAS as 7 fases (caso pessimista) | ~430 + ~2310 = ~2740 | ~0% (igual ao monolítico) |

Em execução típica de clone, o agente carrega 2-3 fases → economia real de ~50-73%.

## Anti-pattern bloqueado

- ❌ Mudar conteúdo de uma fase **sem atualizar índice** na skill principal (link quebrado)
- ❌ Criar passo novo **fora de uma fase** (descontrola estrutura)
- ❌ Duplicar regras de Push Seguro (P1-P8) numa fase (devem viver só no índice)
