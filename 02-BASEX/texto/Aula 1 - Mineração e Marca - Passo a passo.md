# Aula 1 - Mineração e Marca - Passo a passo

_Texto extraído de Aula 1 - Mineração e Marca - Passo a passo.pdf (pdftotext)._

AULA 1 · PARTE 1



Mineração
Ao final desta aula: as lojas do seu nicho reunidas na sua Central, prontas para
você escolher com quem aprender.

      Escolher o nicho no repositório

      Separar as primeiras referências

      Pedir ao Claude a mineração de mais concorrentes
         PROMPT PARA O CLAUDE


        /minerar-concorrentes Vou vender [seu nicho] em [países]. Pasta da
        operação: [nome da operação]. Traga no máximo 10 lojas e inclua
        estas referências que eu já separei: [loja1.com], [loja2.com]. No
        fim, monta a Central e publica como artefato, para eu votar Usar ou
        Descartar em cada loja na aba Mercado.

      Troque o que está entre colchetes antes de enviar.


      Entender os concorrentes
         PROMPT PARA O CLAUDE


        Abre a aba Mercado da minha Central e me explica cada loja em duas
        linhas: o que vende, o preço, quantos anúncios tem no ar e se vale
        estudar.



      Marcar cada loja como Usar ou Descartar
AULA 1 · PARTE 2



Benchmarking
Ao final desta aula: o raio-x das suas referências dentro da Central, com o que
elas vendem, como anunciam e o que já testaram.

      Pedir o raio-x das lojas marcadas como Usar
        PROMPT PARA O CLAUDE


       /raio-x-concorrente Faz o raio-x das lojas que eu marquei como Usar
       na Central da [nome da operação] e completa a Central com a análise
       de cada uma.



      Ver como o Claude lê cada criativo

      Achar o que se repete entre as referências: em duas lojas é
      padrão, em uma é hipótese
        PROMPT PARA O CLAUDE


       Na aba Referências da minha Central, me mostra o que se repete entre
       as lojas: o que é padrão, porque aparece em duas ou mais, e o que
       ainda é hipótese, porque aparece em uma só.



      Ler a conta de cada loja: anúncios no ar, desligados e o que ela
      testou e parou
        PROMPT PARA O CLAUDE


       Para cada referência da minha Central, me resume a conta de
       anúncios: quantos estão no ar, quantos foram desligados e o que ela
       testou e parou.



      Filtrar o banco de criativos por formato, funil e comunicação, e
      baixar o criativo
Ver os produtos: os mais vendidos, as coleções e o CSV para
importar

Escolher e minerar produtos
  PROMPT PARA O CLAUDE


 Cria uma seleção de produtos para a minha loja a partir da aba
 Produtos da minha Central: os mais vendidos de cada referência que
 combinam com a minha marca. Me diz também quantos produtos a loja
 precisa para começar.



Comparar a página de produto de cada referência, no
computador e no celular
AULA 1 · PARTE 3



Marca
Ao final desta aula: para quem é a sua marca e a dor que ela resolve, o nome, a
paleta e a apresentação da marca inteira numa página, tudo tirado das referências
da Central.

     Começar a marca com um prompt só: persona, nome e o resto,
     nesta ordem
        PROMPT PARA O CLAUDE (COPIAR E COLAR NA AULA)


       /apresentar-nova-marca Vamos começar a minha marca de [seu nicho,
       ex.: roupa masculina] a partir de tudo o que está na minha Central:
       Debriefing, Referências, Banco e Produtos. Faz nesta ordem e espera
       a minha resposta em cada etapa antes de seguir.
       1. Persona. Lê as referências, as avaliações das lojas e os
       comentários dos anúncios e me faz as perguntas de copy que faltam,
       uma por vez, cada uma com a sua sugestão: para quem eu vendo, idade
       e momento de vida, faixa de preço, como essa pessoa quer ser vista e
       o que ela tem medo de errar ao comprar. Fecha com quem compra, a dor
       principal, o "e daí?" três vezes até a dor final, o desejo e três
       frases reais de quem compra, cada ponto com a referência de onde
       saiu.
       2. Nome. Com a persona aprovada, me dá cinco opções de nome para eu
       escolher. Para cada uma, diz por que fala com a persona e confirma
       que não lembra o nome de nenhuma referência. Se eu já tiver um nome,
       uso o meu.
       3. Identidade. Com o nome que eu escolher, me propõe três paletas,
       cada uma com as duas fontes e o contraste medido.
       4. O resto. Posicionamento contra as referências, o fundador que
       assina a marca, a história da página Sobre, o tom de voz, as
       coleções com preço, a oferta com motivo e último dia, o logo, os
       banners e o primeiro lote de criativos.
       No fim, monta a apresentação da marca inteira numa página e coloca
       na aba A marca da Central.

     É o prompt da aula: ele conduz a marca inteira, parando em cada decisão. Os passos abaixo fazem a
     mesma coisa uma etapa por vez, para quando você quiser refazer só uma parte.
Definir a persona e o público a partir das referências da
Central
   PROMPT PARA O CLAUDE


  Com a minha Central de [seu nicho], me ajuda a definir a persona e o
  público da minha marca. Antes, lê as abas Referências, Banco e
  Produtos, as avaliações das lojas e os comentários dos anúncios.
  Depois me faz as perguntas que faltam, uma por vez, cada uma com a
  sua sugestão. No fim, me entrega quem compra (idade, país e momento
  de vida), a dor principal, o "e daí?" três vezes até a dor final, o
  desejo e três frases reais de quem compra, cada ponto com a
  referência de onde saiu.

O Claude vai perguntar coisas como para quem você quer vender e em que faixa de preço. Responda o
que você já sabe; o resto ele propõe a partir das referências.


Escolher o nome pensando na persona
   PROMPT PARA O CLAUDE


  Com a persona que a gente definiu, me dá cinco opções de nome para a
  marca, para eu escolher. Para cada uma, diz por que ela fala com
  essa persona e confirma que não lembra o nome de nenhuma referência.



Definir a paleta e as fontes da marca, depois do nome
   PROMPT PARA O CLAUDE


  Com o nome [nome escolhido] e a persona que a gente definiu, me
  propõe três paletas para a marca, cada uma com as duas fontes e o
  contraste medido, para eu escolher.
Pedir ao Claude a apresentação da marca, já com a persona, o
nome e a paleta
  PROMPT PARA O CLAUDE


 /apresentar-nova-marca Monta a apresentação da minha marca na minha
 Central de [seu nicho], com a persona que a gente definiu, o nome
 [nome escolhido] e a paleta que eu escolhi. Quero tudo numa página:
 o posicionamento, para quem é e a dor, a história, o tom de voz, a
 paleta e as fontes aplicadas, o logo, as coleções com preço e a
 oferta.



Conferir se a identidade visual, a história e o tom falam com a
persona
  PROMPT PARA O CLAUDE


 Confere a apresentação contra a persona: a paleta, o logo, a
 história e o tom falam com ela? Me lista o que não fala, com o
 motivo, e corrige o que eu aprovar.



Conferir se a oferta tem um motivo para o desconto
  PROMPT PARA O CLAUDE


 Confere a oferta da apresentação: ela tem um motivo real para o
 desconto, como aniversário da marca ou oferta de estação, com o
 percentual e o último dia? Se não tiver, me propõe um.
