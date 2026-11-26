---
tags: [loja, pagina-de-produto, vestuario, tabela-de-medidas, gate]
criado: 2026-11-05
atualizado: 2026-11-05
status: ativo
---

# Tabela de medidas por tipo de produto

> Loja de roupa e calçado: toda página de produto tem a tabela de medidas do tipo dela e a recomendação de tamanho, sem exceção.

## A regra

- **Uma tabela por tipo de produto:** camisa, camiseta e polo; jaqueta e casaco; suéter e tricô; calça e jeans; short e bermuda; conjunto (top e calça); calçado; sandália. A tabela de calça não serve para camisa.
- **Cada nicho pede algo próprio, e quem mostra o quê são as referências.** Em vestuário e calçado, é a tabela de medidas.
- Importação de catálogo que não traz a tabela é erro.

## De onde sai a tabela

1. A tabela do fornecedor do produto: é a peça dele que o cliente recebe.
2. A tabela das referências que vendem o mesmo tipo de produto, de três ou mais lojas.
3. Comparar tamanho a tamanho, em centímetros, e ficar com a medida que mais se repete entre as fontes e bate com o fornecedor. Se as fontes divergem muito, pedir ao fornecedor a medida da peça.
4. Dizer se a tabela é de corpo ou de peça.
5. Tabela publicada só como imagem: pedir os números ao fornecedor, nunca chutar.

## Na página de produto

- A tabela abre junto do seletor de tamanho.
- A recomendação de tamanho ("encontre o seu tamanho") e o "como medir".
- O aviso de caimento quando a peça veste menor ou maior.

## Como fica automático no Tema BaseX

- A tabela mora em cada produto, no campo de tabela de medidas do produto (metafield `custom.size_chart`, lido pelo snippet `ec-size-chart-text`).
- O guia "encontre o seu tamanho" (snippet `ec-size-guide`) escolhe sozinho pelo tipo do produto: parte de cima, calça e short, conjunto, calçado. Acessório não leva. Por isso o tipo de produto precisa estar certo no catálogo.
- Não precisa de uma página de produto por tipo: o Claude preenche a tabela em massa, tipo por tipo.
- Prompt: "Preenche a tabela de medidas de todos os produtos da minha loja, uma por tipo de produto, com a tabela do fornecedor comparada com a de [referências]. Me mostra a tabela de cada tipo antes de gravar."
- Recomendador por medidas do corpo (provador virtual): a skill `/aplicar-provador-virtual`.

## Conferir

- Abrir no celular um produto de cada tipo: a tabela abre e é a do tipo certo.
- Conjunto mostra a tabela do top e a da calça.
- Nenhum produto de roupa ou calçado sem tabela.
