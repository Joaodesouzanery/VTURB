---
tags: [guia, shopify, tema, nicho, alunos]
criado: 2026-11-08
atualizado: 2026-11-09
status: ativo
---

# Temas Prontos por Nicho

> Cinco temas Dawn já montados, um por nicho, para a loja nascer quase pronta (os zips estão em `06. Anexos/Temas Prontos`). Você importa o zip, troca texto, cor e fotos pelo editor e confere os gates do seu nicho antes de anunciar.

## Os cinco zips

Todos saem do mesmo código (o Tema BaseX Editável, na base Dawn). O que muda de um para o outro é cor, fonte, espaçamento, ordem das seções, banners e o que vem ligado. Fundo sempre branco, com uma cor de destaque.

| Zip | Para quem | O que o diferencia |
|---|---|---|
| Tema Pronto · Vestuário Masculino | roupa masculina | guia de medidas e bloco de caimento, "Complete the look", cor em miniatura com a foto da variante |
| Tema Pronto · Vestuário Feminino | roupa feminina | guia de medidas, bloco Fit ("Fits true to size. Between sizes, size up."), seção de ocasião, rostos de mulher nas avaliações |
| Tema Pronto · Acessórios Masculinos | relógio, pulseira, boné, chapéu | paleta, fonte e seções próprias do nicho |
| Tema Pronto · Acessórios Femininos | bolsa, relógio feminino, joia | rostos de mulher nas avaliações; a seção "o que cabe na bolsa" vem desligada (quem vende só bolsa liga no editor) |
| Tema Pronto · Coringa | qualquer nicho | sem nada de nicho: é o ponto de partida quando o seu não está nos quatro acima |

O mesmo nome aparece no editor da Shopify quando você sobe o tema. O Tema BaseX Editável v2 (em `06. Anexos`) **não** é o coringa: ele traz banner e modelos de produto só de vestuário.

## O que vem igual nos cinco

- Oferta de aniversário da marca como padrão, **sem data final escrita**: o cronômetro conta até a meia-noite de quem visita e reinicia sozinho. Os descontos automáticos que você criar no admin também ficam sem data de término.
- Página de produto com **uma** informação de frete e **uma** de devolução, com o mesmo prazo (despacho em 48 horas e entrega em 5 a 7 dias úteis, numa linha só). Seu prazo real é outro? Troque o texto antes de anunciar.
- Cor sempre em miniatura com a foto da variante; tamanho em lista. Sem pacote de quantidade na ficha (o desconto progressivo fica na coleção e no carrinho).
- Estrelas do topo do produto clicáveis, levando às avaliações.
- Prova social de exemplo (número de clientes, nota, primeiros nomes comuns): é texto de molde, não dado seu. Troque pelo real ou desligue antes de anunciar.
- Nenhum colchete nem mensagem de editor na tela, e nenhuma section que dependa de app.
- Vídeo sem arquivo aparece como caixa clara, não como player preto; seção de clientes e de vídeo vêm desligadas até você ter mídia real.

## Gates antes de subir a loja ou anunciar

Só os que já estão decididos. A lista de erros possíveis por nicho ainda está sendo levantada; esta nota cresce conforme isso fechar.

| Nicho | Gate |
|---|---|
| Vestuário (masculino e feminino) | **Não sobe nem anuncia sem tabela de medidas em todos os produtos.** O guia aparece mesmo sem opção de tamanho, mas os números de exemplo da tabela são do molde: troque pelos reais de cada modelo, ou desligue o bloco. Medida errada vira troca e devolução |
| Feminino (vestuário e acessórios) | Rostos de mulher nas avaliações: troque as avaliações de exemplo pelas reais ou desligue a seção |
| Todos | Nenhuma section ligada com imagem ou vídeo vazio (`_engine/qa-loja/gate-midia-vazia.mjs`) |
| Todos | Nenhuma imagem do tema apontando para arquivo que não existe na sua loja (`_engine/qa-loja/gate-imagens-tema.mjs`) |
| Todos | Material do produto coerente com a coleção (`_engine/qa-loja/gate-material.mjs`) |
| Todos | Nenhum texto de exemplo, colchete ou frase de editor visível, no celular e no computador (`_engine/qa-loja/qa-sweep.mjs`, que roda os três acima com `--loja=`) |
| Todos | Promessas do tema (prazo, devolução, suporte, oferta) conferidas contra o que você cumpre: Passo 10 de [[116. Colocar a Marca na Loja]] |

## Depois de importar

1. Suba o zip em Online Store, Themes, Add theme, Upload zip. Ele entra como rascunho; publique só depois do Passo 10 da 116.
2. Cadastre pelo menos um produto real: as sections de produto complementar se escondem sozinhas até você escolher os itens.
3. Rode a skill [[116. Colocar a Marca na Loja]] para logo, favicon, paleta e fonte.
4. Rode os gates da tabela acima. Vermelho = não anuncia.
