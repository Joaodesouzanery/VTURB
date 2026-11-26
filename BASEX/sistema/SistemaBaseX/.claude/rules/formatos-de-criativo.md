# Formatos de criativo e imagem da loja

> Vale para toda peça de imagem que sai daqui: criativo de anúncio, banner da loja, capa de coleção, logo, favicon.

## Criativo de anúncio: dois formatos, e só esses dois

| Formato | Tamanho | Onde roda |
|---|---|---|
| Quadrado | 1080x1080 | feed, catálogo, carrossel |
| Story | 1080x1920, vertical | story, reels, tela cheia |

Se o pedido disser "1920x1080" para story, é inversão de números. Story é **vertical**. Faça vertical e avise em uma linha.

## Adaptar é redesenhar, nunca emoldurar

Levar um criativo para o outro formato significa **redesenhar nativo**: estender a cena, reequilibrar a composição e reposicionar os blocos de texto, de modo que a peça pareça ter nascido naquela proporção.

| Proibido | Correto |
|---|---|
| Borda, barra lateral, letterbox | Cena estendida até preencher o quadro |
| Esticar ou distorcer a imagem | Reenquadrar sem deformar o produto |
| Cortar headline ou preço pela metade | Reposicionar o texto para caber inteiro |

No prompt do modelo, exija explicitamente: `NO borders, NO bars, no letterbox, no stretching`, mais a proporção nativa (`1:1` ou `9:16`).

**Exceção que economiza tempo e crédito:** peça que **já nasce** na proporção alvo (1:1 dentro de 0,9 a 1,1, ou 9:16 dentro de 0,5 a 0,62) não passa pelo modelo. Redimensione local com corte simétrico mínimo. Preserva a arte já aprovada e evita a IA reescrever texto que estava certo.

## Imagem sem marca de terceiro

**Nenhuma peça sai com marca que não seja a da loja de quem pediu.** Nem a marca da loja de referência que serviu de inspiração, nem wordmark, escudo, selo, assinatura ou gravação no produto.

Isso vale para tudo que aparece na arte: topo, rodapé, mostrador de relógio, etiqueta de roupa, sola de sapato, embalagem, sacola. Marca pequena passa despercebida no olho, então **confira lendo a peça com o leitor de imagem**, não olhando a miniatura.

Foto de produto vinda do fornecedor não é problema: o problema é marca de terceiro dentro da imagem.

## Tamanhos da loja

| Peça | Tamanho | Formato |
|---|---|---|
| Banner desktop | 3000x1000 | JPG, qualidade 90 ou mais |
| Banner mobile | 1080x1600 | JPG, qualidade 90 ou mais |
| Capa de coleção | 736x1105 | JPG |
| Favicon | 1080x1080 | PNG |
| Logo, três versões: preta, branca e na cor da marca | base 1884x330, ajustar proporcional | PNG com fundo transparente |

Banner mobile **não é** o desktop cortado. É peça própria, redesenhada para o vertical.
Logo nunca sai com fundo colorido e nunca é distorcido para caber.

## Antes de dar por pronto

1. **Preço certo**, e o riscado de comparação com o valor original. Nunca o mesmo número riscado e cheio.
2. **Composição do produto** igual à referência: quantidade de itens, cores, orientação, espaçamento.
3. **Zero marca de terceiro**, conferida por leitura da imagem e não a olho.
4. **Nada cortado** pela borda do novo formato.
5. Os **dois formatos** existem.

## Uma regra por assunto no prompt

Duas instruções sobre o mesmo tema no mesmo prompt fazem o modelo obedecer só a primeira. Ao corrigir um prompt, **substitua** a regra antiga, nunca acrescente a nova ao lado dela.

## Proibido

- Entregar criativo em um formato só
- Preencher formato com borda, barra ou fundo desfocado e chamar de adaptação
- Esticar a imagem para caber na proporção
- Chamar o modelo para peça que já está na proporção certa
- Conferir preço ou marca por miniatura
- Empilhar duas regras de preço no mesmo prompt
