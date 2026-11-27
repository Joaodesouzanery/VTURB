---
description: Testa a compra de verdade na loja, país por país, até a tela de pagamento — moeda local, frete cotado, frete sem prazo no nome, taxas e checkout. Entrega matriz PASS/FAIL com screenshot de cada país como evidência.
argument-hint: <loja.myshopify.com> [paises-ISO2] [senha-storefront]
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Execute a skill "QA Funcional de Compra". Fonte: `03. Skills/71. QA Funcional de Compra.md`.

Pré-voo obrigatório, a partir da raiz do SistemaBaseX:

```bash
cd "_engine/qa-funcional-compra" && node preflight.mjs --loja {loja} --paises {lista}
```

Se reclamar da porta 9222, subir o Chrome antes:
`/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 &`

Perguntar em quais países a loja vende. Se o dono não souber, ler os markets reais da loja. Só usar a lista sugerida (IT,DE,ES,FR,GB,PT,NL,BE,AT,CH) se as duas coisas falharem.

NON-NEGOTIABLE: screenshot é a evidência, e sem screenshot o check não conta como PASS. Frete com prazo escrito no nome ou na descrição é FAIL, porque em dropshipping o prazo não é controlado por você e prazo no checkout vira disputa e chargeback. FAIL em frete cotado é crítico: a loja não vende naquele país. Nada é escrito na loja, esta skill só lê e testa.
