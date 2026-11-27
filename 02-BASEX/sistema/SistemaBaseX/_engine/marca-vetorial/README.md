# Marca vetorial

Gera o logo, o monograma e o favicon da loja no seu computador, de graça, em cerca de 25 segundos.
Não usa crédito de IA nenhum.

## Por que não é IA que desenha

Logo de loja é tipografia mais geometria, e isso o navegador faz melhor que modelo de imagem:

| | Navegador (o que este engine usa) | Modelo de imagem |
|---|---|---|
| A letra | exatamente a fonte escolhida | erra letra, inventa serifa, troca acento |
| Repetir | mesmo resultado toda vez | resultado diferente a cada tentativa |
| Fundo | transparente de verdade | quase sempre com fundo pintado |
| Favicon 16px | desenhado no tamanho, legível | borrado, ilegível |
| Custo | zero | crédito |

A IA entra em um lugar só, e de graça: sugerir a **forma** de um símbolo. O comando `prompt` escreve o
texto pronto para colar no ChatGPT ou no Gemini gratuito. O arquivo final continua saindo daqui.

## Os três comandos

### 1. Ver as opções

```bash
node gerar.mjs conceitos --marca "Aurelle"
```

Desenha o nome da loja em seis direções tipográficas diferentes e monta uma página para comparar
lado a lado. Debaixo de cada uma vem a linha de comando exata que reproduz aquela direção.

| Direção | Fonte | Onde costuma servir |
|---|---|---|
| `serifa-alta` | Cormorant Garamond | joia, perfume, moda cara |
| `serifa-editorial` | Playfair Display | revista, decoração, casa |
| `sem-serifa-larga` | Jost | minimalista, tecnologia, relógio |
| `sem-serifa-solida` | Archivo | esporte, ferramenta, direto |
| `geometrica-suave` | Poppins | infantil, bem-estar, pet |
| `grotesca-neutra` | Inter | utilidade, quando nada mais serve |

### 2. Gerar a marca inteira

```bash
node gerar.mjs tudo --marca "Aurelle" \
  --fonte "Cormorant Garamond" --peso 300 --tracking 0.28 --caixa alta \
  --cor "#1B2A41" --fundo "#F5F1E8" --forma circulo
```

Saem 20 arquivos: seis versões do logo escrito, três do monograma, oito tamanhos de favicon, o
`.ico`, dois SVG e um `LEIA-ME.md` dizendo onde usar cada um.

| Opção | O que muda | Padrão |
|---|---|---|
| `--marca` | nome da loja | obrigatório |
| `--fonte` | qualquer fonte do Google Fonts | Cormorant Garamond |
| `--cor` | cor principal, em hex | `#1B2A41` |
| `--fundo` | cor de apoio, em hex | `#F5F1E8` |
| `--forma` | `circulo`, `arredondado` ou `quadrado` | circulo |
| `--peso` | 300 a 700 | 400 |
| `--tracking` | espaço entre letras, em `em` | 0.18 |
| `--caixa` | `alta` ou `normal` | alta |
| `--descritor` | linha pequena embaixo do nome | vazio |
| `--saida` | pasta de destino | `./marca` |
| `--chrome` | caminho do Chrome, se não for achado sozinho | detecta |

### 3. Pedir ideia de símbolo à IA gratuita

```bash
node gerar.mjs prompt --marca "Aurelle" --nicho "joias"
```

Imprime o texto para colar no ChatGPT ou no Gemini. Ele pede uma folha com quatro símbolos
abstratos em grade 2x2, preto sobre branco, sem letra dentro, do tipo que continua legível pequeno.
Você escolhe a forma e desenha o vetor final por cima.

## O que precisa estar instalado

Só o **Google Chrome**. O engine acha sozinho no Mac, no Windows e no Linux. Se estiver em lugar
diferente, aponte com `--chrome "/caminho/do/chrome"`.

Na primeira vez ele baixa a fonte do Google Fonts (uns 50 KB por peso) e guarda em `.cache/`. Da
segunda em diante funciona sem internet.

## Duas decisões que valem saber

**Um navegador só, muitas imagens.** Abrir o Chrome uma vez por imagem custava 14 segundos de
partida cada, e as 20 peças levavam mais de quatro minutos. Agora o navegador abre uma vez e as
fotos saem pelo protocolo de depuração: 25 segundos no total.

**Cada favicon é desenhado no tamanho final.** Reduzir um PNG de 512 para 16 borra a letra bem onde
ela mais precisa ficar legível. Aqui os oito tamanhos são desenhados um a um, e o `.ico` é montado
embutindo os PNGs prontos, sem depender de Pillow nem de `sips`.

**A letra é centralizada pela tinta, não pela caixa.** A fonte reserva espaço para perna de "g" e
"p" que um "A" não usa. Centralizando pela caixa, uma inicial "J" saía 43 pixels fora do centro num
círculo de 760. O engine mede a tinta de verdade e corrige.

## Estrutura

```
marca-vetorial/
├── gerar.mjs     # os três comandos
├── chrome.mjs    # conversa com o navegador pelo protocolo de depuração
├── README.md     # este arquivo
└── .cache/       # fontes baixadas, uma vez por peso
```
