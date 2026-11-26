---
tags: [guia, shopify, dominio, email, godaddy, zoho]
criado: 2026-11-09
atualizado: 2026-11-09
status: ativo
---

# Domínio e E-mail Profissional

> Comprar o domínio da marca, ligar na loja Shopify e criar o e-mail de suporte (`support@suamarca.com`) na Zoho, do jeito que a Aula 2 mostra. Cada passo termina com o que conferir.

## 1. Comprar o domínio

1. Entre na GoDaddy (ou em outro registrador de domínio) e crie a sua conta.
2. Pesquise o nome da marca. Para loja global, prefira **.com**; o .com.br não serve para vender fora.
3. Preço: um .com custa por volta de R$ 60 a R$ 80 por ano (confira na tela, muda com promoção). Se o nome aparecer com preço de mil ou dez mil reais, é domínio premium: escolha uma variação do nome.
4. Adicione ao carrinho e conclua a compra.

**Conferir:** em Minha conta › Meus produtos, o domínio aparece na lista.

## 2. Ligar o domínio na loja

1. Na Shopify: **Configurações › Domínios › Conectar domínio existente**.
2. Digite o domínio que você comprou. A Shopify reconhece a GoDaddy e oferece a conexão automática.
3. Entre com a conta da GoDaddy em que você comprou o domínio. Pronto, ele conecta sozinho.
4. Leva de 20 a 40 minutos para começar a funcionar.

**Conferir:**
- `suamarca.com` abre a sua loja numa aba anônima.
- Em Configurações › Domínios, o seu domínio aparece como **principal**. Se não aparecer, troque o principal para ele.

## 3. Criar o e-mail na Zoho

1. Entre em zoho.com, abra o Zoho Mail e clique em criar conta. Na tela de preços, não preencha nem pague nada: clique em **Iniciar sessão › Inscrever-se agora › Business e-mail**.
2. Preencha o nome da marca, o e-mail da operação (o mesmo da conta da Shopify) e o seu número de celular. Digite o código que chega por SMS.
3. Escolha a opção de criar uma conta de e-mail **baseada no seu domínio** e continue.
4. **Tela de planos:** ela parece não deixar seguir sem plano pago. O caminho que a aula mostra é este:
   - escolha o plano, clique em adicionar domínio existente e digite o seu domínio;
   - quando aparecer "continuar para pagamento", vá até a página de pagamento e saia;
   - entre de novo na Zoho. A criação segue sem cobrança.
   - Se preferir pagar, o plano é barato. Em 08/11/2026 eram cerca de R$ 5 a R$ 6 por mês, mas confira na tela.
5. **Verificar o domínio:** clique em fazer login no seu DNS, entre na GoDaddy e conecte. A Zoho grava sozinha os registros de verificação e de e-mail.
6. Crie o usuário de suporte: `support@suamarca.com` para loja em inglês, ou `suporte@` se a loja for em português.
7. Grupos: pode pular. Migrar e-mail antigo: não tem, então é só continuar. Abra o **Console do admin**.

**Conferir:**
- Mande um e-mail de outra conta para o endereço de suporte e veja ele chegar na Zoho.
- Responda de lá e confira que a resposta sai com o endereço da marca.
- No console da Zoho, os registros do domínio (verificação, MX, SPF e DKIM) aparecem todos confirmados.

## 4. Usar o e-mail na loja

1. Shopify › **Configurações › Notificações**: ponha o e-mail de suporte como remetente.
2. Se a Shopify avisar que vai enviar por `store+número@shopifyemail.com`, falta autenticar o domínio. Siga o passo de autenticação que a própria tela mostra.
3. Use o mesmo endereço em **Configurações › Geral** (contato da loja), nas políticas e no rodapé do tema.

**Conferir:** faça uma compra de teste e veja o e-mail de confirmação chegar com o nome e o endereço da marca.

## Onde erra

- **A conexão automática pede outra conta:** ela só funciona com a conta da GoDaddy em que o domínio foi comprado.
- **O domínio ainda não abre a loja:** espere de 20 a 40 minutos. Em casos raros, passa de algumas horas.
- **A Zoho parece travada na tela de planos:** é a tela empurrando o plano pago. Use o caminho do passo 3.4.
- **O e-mail não chega:** confira no console da Zoho se os registros de MX estão todos confirmados.
- **E-mails da loja saem por shopifyemail.com:** falta a autenticação do domínio do passo 4.2.
