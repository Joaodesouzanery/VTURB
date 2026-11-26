---
tags: [guia, shopify, apps, gdpr, clarity, rastreio, upsell]
criado: 2026-11-09
atualizado: 2026-11-09
status: ativo
---

# Apps da Loja: o pacote base

> Os apps que a Aula 2 instala e configura, na ordem, com o que conferir em cada um. O Claude instala a maioria sozinho. O que pede escolha de plano ou pagamento, você conclui à mão e depois pede para ele seguir.

## 0. O fornecedor

1. Abra o app do seu fornecedor de dropshipping, faça o cadastro e conecte à loja.
2. Daí em diante, cada pedido avisa o fornecedor e os dados sincronizam sozinhos. Para processar um pedido, siga o tutorial dentro da plataforma.
3. Com mais de um fornecedor (FFOrder, FlowBorder ou outro), o passo é o mesmo em cada um.

**Conferir:** a loja aparece conectada dentro da plataforma do fornecedor.

## 1. Pandectes GDPR: banner de cookies

Obrigatório para vender na União Europeia.

1. Instale o Pandectes e siga o assistente:
   - região específica: **Europa**;
   - a primeira opção marcada;
   - pop-up centralizado;
   - idioma padrão em inglês.
2. Abra o editor de temas pelo próprio assistente, ligue o app e salve.
3. Plano: comece no **Basic**.
4. Visual: em **Banner de cookies**, desmarque o aviso de cookies e deixe marcado **Aceitar somente**. A ideia da aula é um banner simples, com o aceitar em destaque.
5. **Desligue o banner nativo da Shopify:** Configurações › Privacidade do cliente › Banner de cookies. Se os dois ficarem ligados, o cliente vê dois banners.

**Conferir:** pela prévia do Pandectes (de fora da Europa o banner pode não aparecer para você), aparece um banner só.

## 2. Microsoft Clarity: gravações e mapa de calor

Grátis. Mostra o que cada cliente fez no site. Quando a loja tiver tráfego, o Claude lê as gravações e acha bug, ponto onde o cliente trava e página onde ele sai.

1. Instale o Clarity e conecte a sua conta.
2. Vá para a configuração do tema, ligue o app e salve.
3. Volte ao app: ele atualiza sozinho.

**Conferir:** depois das primeiras visitas, o Clarity mostra as sessões gravadas.

## 3. Klaviyo, Parcel Panel e Upsell.com

Peça ao Claude para instalar os três.

| App | Para quê |
|---|---|
| Klaviyo | e-mails de recuperação de venda (carrinho e checkout abandonado) |
| Parcel Panel | página de rastreio no site e e-mails de atualização do pedido; menos suporte e menos chargeback |
| Upsell.com (ex-ReConvert) | oferta depois da compra, na página de agradecimento |

O Claude costuma parar na tela de escolher o plano. É normal: escolha e pague à mão, e depois peça para ele configurar.

**Parcel Panel:**
- Abra pelo menu Aplicativos.
- Peça ao Claude a lista de palavras e transportadoras chinesas para esconder do rastreio.
- A notificação de envio só liga com o plano ativo (em Faturamento).

**Upsell.com:**
- Clique em "Leve-me ao aplicativo", aprove o plano e peça ao Claude para configurar.
- Confira em **Editar fluxos**: o primeiro e o segundo pós-compra, a página de agradecimento e a página de rastreamento têm de estar **ativos**.
- Com o tempo e as vendas, o painel mostra quais ofertas funcionam. Peça ao Claude para analisar.

**Klaviyo:** a configuração tem skill própria, a [[122. Configurar Klaviyo]].

## Onde erra

- **Dois banners de cookies na loja:** o banner nativo da Shopify ficou ligado.
- **Muitos cliques no link e poucas visualizações da página de destino, principalmente na Europa:** muito provavelmente é perda por cookies. Passe o Pandectes para o plano Premium.
- **O Claude parou na tela de plano:** conclua a escolha à mão e peça para ele continuar.
- **Rastreio mostrando transportadora chinesa ao cliente:** falta a lista de palavras escondidas no Parcel Panel.
