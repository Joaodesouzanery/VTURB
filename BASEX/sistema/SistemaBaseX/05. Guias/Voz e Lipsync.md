---
tags: [guia, criativo, voz, lipsync, legenda]
criado: 2026-11-10
atualizado: 2026-11-11
status: ativo
---

# Voz e Lipsync

> O que a BaseX aprendeu trocando a voz, sincronizando a boca e trocando a legenda de criativos de vídeo. Leia antes do primeiro lote. A squad que faz o trabalho é a [[141. Voz e Lipsync]].

## Voz

- **Reescrever é o padrão.** Reescrevendo a copy, quem decide marca, oferta, preço e CTA é você, e custa cerca de um terço da dublagem.
- **A copy precisa caber no vídeo.** Cerca de 15 caracteres por segundo. O motor ajusta o ritmo até 15% sem ninguém perceber; acima disso a fala fica com cara de robô, e por isso ele recusa e pede outra copy.
- **Cada voz tem o seu ritmo, e a tentativa recusada também gasta crédito.** No teste da casa, a mesma voz leu 17,6 caracteres por segundo numa geração e 15,7 na seguinte. Com uma voz que você ainda não usou, escreva a copy, gere, e reescreva no tamanho que o motor pedir: a segunda tentativa costuma passar.
- **Clone bom nasce de amostra limpa.** De 1 a 3 minutos de fala, sem música e sem eco. Microfone de lapela abafa os agudos, e o clone sai grave e achatado; o microfone do celular perto da boca, num lugar quieto, funciona melhor.
- **O clone é criado uma vez.** O mesmo voice_id serve para todos os vídeos com essa voz.
- **A música de fundo entra na edição,** por baixo da voz nova. O motor entrega a voz sozinha justamente para isso, já no volume de anúncio (-16 LUFS). A ElevenLabs entrega mais baixo, perto de -23.
- **A legenda da voz nova sai junto.** A ElevenLabs devolve o tempo de cada letra, e o motor grava o `.srt` em blocos curtos que fecham na pontuação. Quando o ritmo é ajustado, o tempo da legenda é ajustado junto.

## Dublagem

- **Pode dublar mesmo com o nome de outra marca na fala.** A dublagem traduz fiel, então o nome volta na fala nova. O `--trocar "MarcaAntiga=SuaMarca"` edita o texto só dos trechos que falam a marca e dubla de novo só esses trechos, com a mesma voz clonada da dublagem.
- **Trocar depois de ouvir não paga outra dublagem.** O motor guarda qual dublagem é daquele vídeo e retoma a mesma. A ElevenLabs não cobra refazer trecho editado até somar a duração do vídeo; o motor mostra os segundos cobrados.
- **A transcrição pode escrever a marca errado.** Leia a fala que o motor mostra no fim. Passar o nome no `--trocar` já na primeira rodada ajuda a transcrição a acertar a grafia. Se veio de outro jeito, repita o `--trocar` com essa grafia.
- **A dublagem às vezes enfeita.** Num teste da casa, um vídeo em italiano voltou em inglês com "lovely", "perfect" e "absolutely" que a pessoa não disse. Em anúncio, isso é promessa na boca de alguém. O `--trocar` aceita qualquer trecho de texto, e tira o enfeite do mesmo jeito: `--trocar "absolutely gorgeous=gorgeous"`.

## Lipsync

- **Só onde a boca fala.** O sync.so cobra por quadro enviado. Num vídeo de 41 s em que o rosto aparece falando por 14 s, mandar o vídeo inteiro custa cerca de R$ 13,60 no lipsync-2; mandar só os 14 s, cerca de R$ 4,60.
- **Rosto calado com voz por cima fica de fora.** Nesses trechos o modelo inventa a boca mexendo, e é isso que faz o vídeo parecer artificial.
- **Resolução importa.** Rosto pequeno volta com a boca borrada. Abaixo de 720p, baixe o vídeo em HD antes de gastar.
- **Qual modelo.** O sync-3 devolve dentes e pele nítidos e custa 2,7 vezes mais que o lipsync-2, que devolve a boca lisa. Para peça que vai ao ar, sync-3.
- **Um trabalho por vez.** O plano aceita um só. O motor espera um trecho terminar para mandar o próximo.
- **A marca d'água do plano de US$ 5 sai na remontagem.** Ele grava "sync.so" no canto superior direito de cada trecho. O trecho que volta só difere do que foi em dois lugares, a boca e a marca, então a diferença no canto dá a caixa exata da marca. O motor apaga essa caixa puxando a cor da vizinhança, só dentro do trecho. Em parede ou fundo liso some sem rastro; em fundo com textura pode ficar uma mancha leve, e por isso o quadro de conferência mostra o canto.
- **Remontagem numa passada só.** O trecho volta recodificado. Juntar pedaços com cópia direta (`-c copy`) gera um arquivo de tamanho normal que quebra no passo seguinte; o motor recodifica tudo uma vez, de propósito.

## Legenda

- **A legenda antiga é imagem, não som.** Ela não aparece na transcrição. Quem acha a legenda são os quadros: a altura dela na tela e os segundos em que aparece.
- **O motor apaga a letra.** Um borrão comum deixa a mancha clara da letra grossa à mostra ("80% OFF" borrado continua legível de longe). O motor refaz a faixa puxando a cor das bordas dela, e a letra some.
- **Faixa justa.** A faixa leva a letra inteira com pouca folga. Faixa larga demais vira um retângulo liso que chama atenção.
- **Só nos segundos da legenda antiga.** Fora do `--quando` o vídeo fica intacto, então a cena não perde nitidez onde não precisa.
- **A legenda nova cobre a faixa.** Ela entra centrada na faixa apagada, sutil: cerca de 4,5% da altura do vídeo, branca, contorno fino, sem caixa. Legenda grossa vira o assunto do vídeo.
- **Área segura.** Os 14% de cima e os 20% de baixo ficam embaixo da interface do Reels e do Stories. O motor avisa quando a faixa cai ali.
- **Confira no quadro.** O ffmpeg termina sem erro mesmo com a legenda fora da tela; só o quadro de conferência prova que ela apareceu.
- **ffmpeg sem libass não escreve legenda.** O preflight avisa. No Mac, `brew install ffmpeg-full`; no Windows, `winget install Gyan.FFmpeg`. Sem isso, o motor apaga a faixa e a legenda nova entra no CapCut, importando o `.srt` ou o `.vtt`.

## Custos de referência

Dólar a R$ 5,50. Confira os preços do seu plano: eles mudam.

| Item | Custo |
|---|---|
| ElevenLabs Starter | US$ 5 por mês, cerca de R$ 28 |
| sync.so com marca d'água (o motor apaga) | US$ 5 por mês, cerca de R$ 28 |
| sync.so sem marca d'água | US$ 19 por mês, cerca de R$ 105 |
| Locução nova de um anúncio de 30 s | cerca de R$ 0,35 |
| Dublagem de um anúncio de 30 s | cerca de R$ 1 |
| Lipsync no sync-3 | cerca de R$ 0,87 por segundo de rosto falando |
| Lipsync no lipsync-2 | cerca de R$ 0,33 por segundo de rosto falando |
| Apagar a legenda antiga e escrever a nova | grátis, roda no seu computador |
