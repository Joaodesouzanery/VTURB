# Importar catálogo de uma loja de referência

> Vale para toda operação que copia produtos de uma loja de referência para a sua: clonar loja, importar coleção, espelhar catálogo.

## A regra que não se quebra

**Tudo que a loja de referência publica é para ser LIDO, nunca adivinhado.**

Loja Shopify serve, sem login e sem senha, quatro endereços que entregam a verdade inteira:

| Endereço | O que devolve |
|---|---|
| `/products.json?limit=250&page=N` | catálogo com opções, variantes e a ligação foto por cor |
| `/collections.json?limit=250` | a lista de coleções |
| `/collections/NOME/products.json?limit=250&page=N` | **quem está dentro** de cada coleção |
| `/products/NOME.json` | um produto específico, inclusive os que não aparecem no catálogo |

Quem supõe em vez de ler acaba refazendo tudo. Abaixo, os quatro erros que custaram uma importação inteira de 467 produtos.

## 1. A estrutura de tamanho e cor é lida, nunca suposta

O produto pode ter uma opção, duas, ou nomes que não são nem cor nem tamanho. Num catálogo real de 467 peças:

| Estrutura | Quantos produtos |
|---|---|
| só Tamanho | 248 |
| Cor e Tamanho | 124 |
| Peça de cima e Peça de baixo (conjunto) | 57 |
| Camisa e Calça (conjunto) | 36 |

O erro: o importador cravou que a primeira opção era o tamanho. Num produto de doze cores e seis tamanhos, criou uma opção chamada "Tamanho" cujos valores eram *Azul claro, Bege, Mostarda*, e nenhum tamanho. Doze variantes onde eram setenta e duas.

**Por que passou despercebido:** os primeiros produtos importados eram calçados, que naquela loja tinham só tamanho. A suposição funcionou naquele lote e seguiu para os outros 430 sem ninguém conferir.

**Confira assim:** some as variantes de todos os produtos da referência e compare com o total na sua loja. Os dois números têm que bater. No erro real: 7.720 esperadas, 2.666 criadas.

## 2. Quem está dentro da coleção vem da referência

Pedido do tipo "organize as coleções pelo nome que o cliente usaria para procurar" autoriza trocar o **título** da coleção. Não autoriza decidir **quem entra nela** quando a referência já publica isso.

Erro real: a referência tinha UMA coleção com sandálias e chinelos juntos, 10 produtos. A classificação por palavra no título criou DUAS coleções, uma com 4 e outra com 6. Mesmo total, organização diferente.

## 3. A lista corta em 250 sem avisar

`products.json` devolve no máximo 250 por página e **não diz que truncou**. Cinco coleções vieram com exatamente 250 e pareciam completas. Buscando página por página até vir menos de 250: tinham 474, 457, 415, 310 e 310.

## 4. Produto pode existir só dentro de coleção

Oito produtos apareciam nas coleções da referência e não vinham no catálogo geral. Só foram descobertos comparando a lista de cada coleção contra o que já tinha sido importado.

## Foto por cor

O catálogo da referência diz qual foto pertence a qual cor. Use isso: ligar todas as variantes à primeira foto do produto só serve para produto de cor única.

Três armadilhas, todas já pagas:

- **Reescrever o produto apaga a ligação foto por variante.** Primeiro reescreve, depois religa. Nunca o contrário.
- **Cortar a lista de fotos perde a foto da cor.** Limitar a 24 fotos derrubou a foto de 8 das 12 cores de um produto que tinha 36 na referência. Suba todas.
- **O nome do arquivo muda ao ser re-hospedado.** A Shopify troca o código no fim do nome. Casar pelo começo do nome, não pelo endereço inteiro.

## Antes de dizer que terminou

| Confira | Como |
|---|---|
| Variantes | total da referência igual ao total da sua loja |
| Coleções | uma a uma, a contagem tem que bater |
| Produtos | todo produto citado em alguma coleção existe na sua loja |
| Foto por cor | numa página de produto, conte fotos diferentes entre as cores: num produto de 12 cores tem que dar 12, não 4 |
| Marca de origem | nenhuma menção ao nome da loja copiada em título, endereço da página ou descrição |

## O que nunca fazer

- Supor que a primeira opção é o tamanho
- Conferir a estrutura num lote de uma categoria só e valer para o catálogo inteiro
- Escolher por conta própria quem entra na coleção quando a referência já diz
- Aceitar 250 como total sem buscar as páginas seguintes
- Dar a importação por pronta sem os cinco números acima conferidos
