# Classificar os criativos do concorrente

Você recebe a pasta de um concorrente já coletada por `coletar_pecas.py`. Não se refaz nem se cria nada: só se olha cada peça e se anota o que ela é. É o que transforma 80 anúncios soltos num mapa de formatos, ganchos e ângulos.

## O que você tem

- `lote.json`: uma linha por peça, com `codigo`, `folha`, `tipo`, `dias_no_ar`, `duracao`, `anuncios` (quantos anúncios usam a mesma peça), `texto` (o corpo do anúncio), `titulo` (título do link) e `cta`.
- `folhas/folha_NN.jpg`: 12 peças por folha, com o código embaixo. Vídeo aparece como tira de 3 quadros (começo, meio e fim). Imagem aparece inteira.
- `miniaturas/PNNN.jpg`: a mesma peça maior, para quando a folha não deixar ler.

## Como trabalhar

1. Abra uma folha com Read e olhe **cada peça**, lendo junto o `texto` e o `titulo` dela no `lote.json`.
2. Se um detalhe que muda a classificação não estiver legível, abra a miniatura da peça. Não abra o vídeo. Não chute: o que não dá para ler fica `"ilegível"`.
3. **Depois de CADA folha, regrave `classif.json` inteiro** (uma lista JSON, na ordem do lote) com tudo o que já classificou. Se a sessão cair, perde-se só a última folha.
4. Com muitas folhas, divida: cada ajudante pega folhas diferentes e grava `classif_A.json`, `classif_B.json`; o `organizar.py` junta todos os `classif*.json`.

## Campos (todos obrigatórios, texto em português)

- `codigo`
- `formato`: UM dos 12 formatos. Escolha pelo **modelo** do criativo, não pela edição:
  - `Oferta Direta`: a oferta (desconto, preço, leve X, encerramento) é o centro da peça.
  - `Catálogo`: vitrine de variações, cores ou modelos.
  - `Lifestyle`: produto em uso, cena e estilo de vida.
  - `Problema x Solução`: abre com uma dor e apresenta o produto como saída.
  - `Review`: depoimento ou avaliação de quem usou.
  - `Demonstração`: o produto funcionando, detalhe, antes e depois, comparação.
  - `POV`: parece post nativo, texto de situação ("POV: você...").
  - `Storytelling`: conta uma história (fundador, avó, a loja que vai fechar).
  - `UGC`: pessoa comum falando para a câmera com o produto.
  - `Unboxing`, `Viral`, `VSL`: só quando a peça claramente for isso.
- `formato2`: um segundo formato só se for claramente forte; senão `null`.
- `gancho`: o que prende no primeiro quadro ou no primeiro olhar. UM de `Curiosidade`, `Problema`, `Demonstração`, `Benefício` (oferta conta como Benefício).
- `funil`: UM de `topo` (atrai quem não conhece: estilo, história, curiosidade), `meio` (convence: demonstração, prova, comparação) ou `fundo` (fecha: oferta, preço, encerramento, urgência no centro).
- `oferta`: UM de `Encerramento de loja`, `Desconto %`, `Leve X por Y`, `Preço riscado`, `Frete grátis / garantia`, `Sem oferta`. Se houver mais de uma, a principal.
- `motivo_desconto`: o motivo que a copy dá para o desconto (`fechando a loja`, `aposentadoria`, `aniversário`, `Black Friday`, `fim de estoque`...), ou `sem motivo`. Desconto com motivo declarado converte mais que desconto solto.
- `angulo`: o argumento central em poucas palavras ("presente que dura", "última chance antes de fechar", "não descasca na água").
- `dor`: a dor que a peça toca, nas palavras de quem compra, ou `""` se não toca nenhuma.
- `promessa`: o que a peça promete em uma frase.
- `texto_tela`: a manchete ou o texto principal **na arte** (não o corpo do anúncio), copiado como está, ou `""`.
- `pessoa`: `sem pessoa`, `mão ou pulso`, `corpo sem rosto`, `pessoa com rosto`.
- `idioma`: o idioma do texto (`inglês`, `alemão`...), ou `sem texto`.
- `destaque`: `true` só nas peças fortes o bastante para servir de modelo primeiro. No máximo uma em cada cinco, e de preferência entre as mais antigas no ar.
- `nota`: uma frase sobre por que a peça funciona ou o que ela ensina.

## Regras

- Uma linha por peça, todas as peças, sem pular. No fim, confira que o total bate com o `lote.json`.
- Não invente marca, preço nem texto.
- Dias no ar é o sinal público de que a peça vende: peça viva há 90 dias venceu o leilão; peça de 3 dias é teste. Use isso para escolher os destaques.
- O que se mede por código (preço na primeira linha do corpo, oferta no título do link, variável de template no ar) **não** se classifica aqui: o `organizar.py` calcula sozinho.
- Ao terminar, rode `python3 organizar.py <pasta>`. Ele recusa valor fora das listas acima e diz qual peça corrigir.
