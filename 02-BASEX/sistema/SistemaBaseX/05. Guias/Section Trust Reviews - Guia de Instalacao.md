---
tags: [guia, shopify, section, reviews, alunos, trust-reviews]
criado: 2026-07-06
atualizado: 2026-07-06
versao: 1.1
status: ativo
---

# Section Trust Reviews - Guia de Instalação

> Section de reviews estilo Trustpilot para qualquer tema Shopify (Dawn e derivados). Um único arquivo, sem apps, 100% editável pelo editor de temas, com tradução automática da interface em 5 idiomas.

**Arquivo:** trust-reviews.liquid (em `06. Anexos/trust-reviews.liquid`)

---

## O que ela faz

- Bloco de nota geral no topo: rótulo (Excellent), estrelas verdes estilo Trustpilot com preenchimento fracionário, a nota numérica antes do total (ex: 4.8 · Based on 2,347 reviews) e logo Trustpilot (desligável em Show Trustpilot logo)
- Cada card mostra a nota numérica junto das estrelas (ex: 4.0), desligável em Show rating number
- Desktop: carrossel horizontal com setas, bolinhas e arrasto com o mouse
- Mobile: lista empilhada (um card acima do outro) com botão "Show more reviews" traduzido. Se preferir carrossel no mobile, é só trocar em Mobile layout
- Cada review é um bloco no editor: nome, avatar (foto ou inicial colorida automática), estrelas de 1 a 5, título, texto, data relativa, selo de compra verificada e até 3 fotos do cliente
- Fotos do cliente clicáveis: abrem em tela cheia (lightbox). Fecha no X, no Esc ou clicando fora
- Dois layouts de foto em Customer photo layout: **Large photo on top** (padrão, a primeira foto aparece grande no topo do card, estilo UGC, e as demais como miniaturas; é o formato que mais converte em moda) ou **Thumbnails below text** (miniaturas discretas após o texto)
- Seletor de idioma: inglês, espanhol, alemão, italiano e francês. Muda todos os textos fixos da interface (selo verificado, datas, "Based on", rótulos de nota). O texto da review fica exatamente como você escreveu
- Nota e total híbridos: calcula sozinho pela média dos blocos, ou você digita um valor fixo (ex: 4.9 e 2.347)
- Desktop e mobile com controles separados de tamanho de fonte, largura de card e espaçamentos

## Instalação (3 passos)

1. **Admin da loja** > Online Store > Themes > no tema desejado clique em `...` > **Edit code**
2. Na pasta **sections**, clique em **Add a new section**, escolha o tipo **liquid**, dê o nome `trust-reviews` e cole TODO o conteúdo do arquivo `trust-reviews.liquid` por cima do conteúdo gerado. Salve
3. Abra o **editor de temas** (Customize), vá na página onde quer a section (normalmente a página de produto), clique em **Add section** e procure por **Trust Reviews**

Pronto. A section já vem com 3 reviews de exemplo para você editar.

## Configurando

### Idioma
Em **Language** escolha o idioma da loja. Isso traduz automaticamente: o rótulo da nota (Excellent, Excelente, Ausgezeichnet, Eccellente, Excellent), o "Based on X reviews", o selo "Verified Purchase" e as datas ("2 weeks ago", "hace 2 semanas", "vor 2 Wochen", "2 settimane fa", "il y a 2 semaines"), com singular e plural corretos.

O que você digita (título e texto de cada review, heading da section) não é traduzido: escreva no idioma da loja.

### Nota e total do cabeçalho
| Campo | Comportamento |
|-------|---------------|
| Rating override vazio | Calcula a média das estrelas dos blocos |
| Rating override preenchido (ex: 4.9) | Usa o valor digitado (aceita vírgula ou ponto) |
| Total override vazio | Conta os blocos |
| Total override preenchido (ex: 2,347) | Mostra o valor digitado |

O rótulo (Excellent, Great, Average, Poor, Bad) muda sozinho conforme a nota.

### Adicionando reviews
No editor, dentro da section, clique em **Add Review**. Cada bloco tem:

| Campo | Dica |
|-------|------|
| Reviewer name | Nome + inicial do sobrenome soa mais real (Jessica R.) |
| Avatar photo | Opcional. Sem foto, aparece um círculo colorido com a inicial |
| Stars | 1 a 5. Misture alguns 4 no meio dos 5 para dar naturalidade |
| Review title | Curto e específico ("Love the fit and style") |
| Review text | 2 a 4 frases. Detalhes concretos convertem mais que elogios genéricos |
| Date | Número + unidade (dias, semanas, meses). A frase é montada no idioma escolhido |
| Verified purchase badge | Deixe alguns sem o selo para parecer orgânico |
| Customer photos | Até 3 fotos por review, exibidas após o texto e clicáveis (abrem em tela cheia). Fotos reais de cliente aumentam muito a conversão |

Para reordenar, arraste os blocos. Para remover, clique no bloco e em Remove.

### Carrossel e layout mobile
- **Cards per view (desktop):** 3 é o padrão. Use 2 para textos longos
- **Mobile layout:** Stacked list (empilhado, padrão) ou Carousel
- **Reviews before Show more (mobile):** quantos cards aparecem antes do botão no layout empilhado (padrão 3)
- **Card width (mobile):** só vale para o layout Carousel. 85% mostra uma espiada do próximo card
- **Autoplay:** desligado por padrão. Se ligar, escolha a velocidade em segundos

### Cores
Tudo configurável: fundo da section, fundo do card, borda, textos, selo verificado e estrelas. O verde padrão das estrelas é o do Trustpilot (#00b67a). Estrelas vazias em #dcdce6.

### Cantos arredondados
- **Card corner radius:** cantos do card (padrão 14px)
- **Customer photo corner radius:** cantos das fotos do cliente, valendo também para a foto ampliada no lightbox (padrão 10px; 0 = quadrada)

## Checklist antes de publicar

- [ ] Idioma da section = idioma da loja
- [ ] Reviews escritas no idioma da loja
- [ ] Datas variadas (dias, semanas, meses) e coerentes com a idade da loja
- [ ] Notas com mistura natural (maioria 5, alguns 4)
- [ ] Testou no celular (o tema tem preview mobile no editor)

## Notas técnicas

- Compatível com Online Store 2.0 (Dawn, Shrine, Sense, Craft, temas premium derivados)
- Sem dependências: CSS e JS embutidos no próprio arquivo, escopados por section (pode usar mais de uma na mesma página)
- Acessível: aria-labels traduzidos, respeita prefers-reduced-motion no autoplay
- Testada e revisada em 2026-07-06 (validação em desktop 1440px e mobile 390px, tema base Dawn premium)

---

*Fonte canônica do arquivo: `06. Anexos/trust-reviews.liquid`.*
