---
description: Precifica um produto para o mercado europeu no padrão BaseX (30% ads + 10% taxas + 30-35% custo + 25-30% margem), com tabela de simulação de margens, leitura de gap de preço, CPA-alvo, estratégia de AOV e 3 cenários (agressivo, recomendado, premium). Nunca entrega preço único.
argument-hint: <custo-em-dolares> <nicho> [preço-que-você-pensou]
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Execute a skill "Precificação Europa". Leia a fonte completa antes de calcular:
`03. Skills/57. Precificação Europa.md` no SistemaBaseX.

Conhecimento que a skill usa:
- `02. Conhecimento/Oferta/01. Gap de Preço.md`
- `02. Conhecimento/Oferta/02. Margem Europa 25-30.md`

Passos: (1) validar as entradas. O custo veio em dólares? O nicho está claro? Se faltar, pergunte antes de calcular, nunca invente. **Nunca pergunte sobre frete**: o custo do fornecedor já vem com o frete dentro, e perguntar faz o aluno somar duas vezes. (1b) converter US$ para euro com a cotação do dia e mostrar a conversão na primeira linha da resposta; se não conseguir a cotação, pedir ao aluno, nunca chutar. (2) aplicar a equação BaseX Europa. (3) montar a tabela de simulação de margens em vários tickets. (4) ler o gap de preço do segmento. (5) calcular o CPA-alvo e o investimento mínimo de teste. (6) recomendar a estratégia de AOV do nicho (orderbump, cross-sell, upsell pós-compra, bundle). (7) sugerir o preço riscado, validado contra o preço que o mercado espera. (8) montar os 3 cenários. (9) salvar o relatório em `06. Saídas/Precificação/{produto}-{data}.md`. (10) responder no chat de forma condensada.

NON-NEGOTIABLE: a margem europeia é 25 a 30 por cento, e não os 20 por cento da referência brasileira. Sempre 3 cenários, nunca um preço só. O AOV faz parte da precificação, não é extra opcional. O preço riscado nunca passa do que o segmento cobra de verdade. Nunca inventar custo, nicho nem cotação de câmbio. Não aceitar margem abaixo de 20 por cento mesmo se o aluno insistir: dizer que a conta não fecha e mostrar por quê.

Skill de raciocínio, sem engine. Nada é escrito na loja. Português, sem travessão na prosa.
