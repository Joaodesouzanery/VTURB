# Acervo de Nichos

Leitor do Repositório de Nichos da BaseX. Ele dá ao Claude do seu computador acesso aos mesmos
dados que estão em `https://basex-di3.pages.dev/nichos/`, só que pela linha de comando, para o
Claude poder cruzar com o que você está montando.

O repositório é atualizado com frequência. O leitor guarda uma cópia local por 24 horas e depois
busca de novo sozinho.

## Como usar

```bash
node ler-acervo.mjs nichos                      # os nichos do acervo, com a data do levantamento
node ler-acervo.mjs nicho joias_acessorios      # resumo de um nicho
node ler-acervo.mjs lojas joias_acessorios --top 15 --trilho escalando
node ler-acervo.mjs dossies joias_acessorios    # dossiês escritos daquele nicho
node ler-acervo.mjs dossie <dominio>            # o dossiê inteiro de uma loja
node ler-acervo.mjs veredito                    # o veredito da BaseX, quando o acervo publica
node ler-acervo.mjs prompts                     # os prompts de montagem de loja
node ler-acervo.mjs buscar pulseira             # procura em nichos, lojas e dossiês
```

Duas opções valem para qualquer comando:

| Opção | O que faz |
|---|---|
| `--json` | devolve JSON em vez de tabela, para o Claude processar |
| `--atualizar` | baixa de novo agora, ignorando a cópia local de 24h |

## O que tem lá dentro

| Conjunto | Conteúdo |
|---|---|
| Nichos | 15 nichos e 2.532 lojas no levantamento de 10/11/2026, cada loja com anúncios ativos, dias no ar, apps detectados e prints da home e da página de produto |
| Vereditos | vazio em 10/11/2026: o acervo não publica veredito, e a decisão do dono da loja fica em `Minhas Lojas/Meus nichos.md` |
| Roadmap | vazio em 10/11/2026 |
| Dossiês | 692 análises escritas, loja por loja: o que ela vende, como monta a oferta, qual é o ângulo |
| Prompts | os prompts de montagem, do plano completo até o primeiro anúncio |

Os números mudam a cada levantamento; o cabeçalho do `nichos` mostra os de hoje.

## Duas normalizações que o leitor faz

O acervo grava o trilho com dois nomes, o código antigo (`WILDCARD`, `BREAKOUT`, `ESCALANDO`,
`EVERGREEN`) e o rótulo novo (`Descoberta rara`, `Explodindo agora`, `Escalando`,
`Perene funciona sempre`). O leitor converte tudo para o rótulo novo ao carregar, então o
`--trilho` aceita qualquer um dos dois e a saída mostra um nome só. Trilho que não existe dá erro.

Dossiê gravado com o slug de um nicho que deixou de existir volta para o nicho atual em que a loja
dele aparece (campo `nichos_atuais` no `--json`). O slug antigo continua funcionando no `dossies`.

## O dossiê é material de estudo, não é texto que sai da sua mão

O dossiê nomeia a loja analisada e descreve como o levantamento foi feito. Isso serve para você
entender a operação e decidir o que copiar. Não serve para ir dentro de um documento que circula
fora da sua operação: ali ele entrega de qual loja a ideia saiu.

O comando `dossie` termina com esse aviso na tela. Com `--json` o aviso não vem: o texto sai cru,
com o nome da loja dentro.

## Como funciona por dentro

A página não tem endpoint de dados: pedir `/nichos/dados-nichos.json` devolve o HTML da própria
aplicação. Os dados vivem embutidos no HTML, em quatro constantes JavaScript (`DB`, `ED`, `DBR` e
`PROMPTS`). O leitor baixa a página inteira, recorta essas quatro constantes respeitando aspas e
aninhamento, e converte para objeto.

Isso significa que uma reforma grande na página pode quebrar o leitor. Se acontecer, o erro é
explícito (`[erro] falha lendo DB do acervo: constante DB nao encontrada no HTML do acervo`) e o conserto é ajustar o nome da
constante em `ler-acervo.mjs`.

## Se a internet cair

Com cópia local disponível, ele avisa e usa a cópia, dizendo de quantos dias ela é. Sem cópia
local, ele para com erro em vez de responder com dados vazios.

## Estrutura

```
acervo-nichos/
├── ler-acervo.mjs   # o leitor
├── README.md        # este arquivo
└── .cache/          # cópia local da página, renovada a cada 24h
```
