# Configurar a loja para vender fora do país

> Vale para todo ajuste de mercados, frete, moeda, idioma e políticas de uma loja que vende para fora.

## A regra que não se quebra

**Criado não é ativo. Sempre confira o estado depois, nunca o retorno da operação.**

A Shopify aceita a criação de um mercado marcado como ativo, não devolve erro nenhum, e grava o mercado como **rascunho**. Mercado em rascunho existe, aparece na contagem de países cobertos, e **não entrega frete nem checkout**.

Caso real: o relatório dizia "8 mercados criados, 236 de 236 países cobertos". Os oito estavam em rascunho. Itália, Reino Unido e mais 203 países não recebiam nenhuma opção de frete. Só uma conferência separada pegou.

## Por que o mercado vira rascunho sozinho

Quando o mercado novo cobre um país que **já está em outro mercado**, a Shopify rascunha o novo em silêncio.

No caso real havia um mercado antigo chamado "Europa" com Alemanha, Espanha, França e Reino Unido dentro. Ele sozinho fazia os oito mercados novos nascerem em rascunho.

**A ordem certa:** primeiro liste os mercados que já existem e remova os antigos que sobrepõem. Depois crie os novos. Depois confira o estado de cada um.

## Zona de frete não aceita país repetido

Se um país já está numa zona de frete, criar outra zona com ele derruba a operação inteira, inclusive as zonas que não tinham conflito. Apague as zonas antigas antes de criar as novas.

## Mercado principal

Loja criada no Brasil nasce com o Brasil como mercado principal. Não existe botão para trocar, nem na tela nem por comando.

**O que funciona:** apagar o mercado antigo. O principal migra sozinho para o que sobrou. Só faça isso se a loja não tiver pedido naquele país.

## Nome da loja

Loja nova nasce com nome de fábrica, do tipo "Minha loja" ou "My Store 10". Esse nome aparece na aba do navegador, nos e-mails de confirmação e no rodapé. **Troque sempre pelo nome da marca.**

O campo está escondido: **Configurações, Geral, cartão "Informações de contato da loja", clicar na linha do nome**. Não está na primeira tela de Configurações Gerais, onde a maioria procura.

## Conferências antes de dizer que terminou

| Confira | Como |
|---|---|
| Mercados | todos ativos, nenhum em rascunho |
| Países | nenhum país sem mercado |
| Frete chega | simule um carrinho e peça as opções de frete por país |
| Prazo | nenhuma opção de frete informa prazo, nem no nome, nem na descrição, nem no campo de tempo de trânsito |
| Moeda | abra a loja como se fosse de cada país e confira a moeda |
| Nome | o nome da marca aparece na aba do navegador |

## Políticas: o que está escrito é promessa

Todo texto de política é declaração que alguém pode conferir. Numa auditoria real, estas quebraram:

- "Enviamos para quase todos os países" com um punhado de países no checkout
- "Todos os preços na sua moeda local" com moeda única na loja
- Aviso legal prometendo o endereço registrado e não entregando nenhum
- Lei de um estado americano específico numa loja que não vende para os Estados Unidos
- E-mail de contato da loja diferente do e-mail publicado nas políticas

**Vendendo para a União Europeia, é obrigatório** ter o direito de arrependimento de **14 dias** escrito por extenso: o prazo, o que acontece depois, quem paga o retorno, e o **formulário de retratação** reproduzido inteiro na política. Isso não é detalhe de texto, é exigência da lei do consumidor de lá.

## O que nunca fazer

- Dar mercado ou zona de frete por pronto sem reler o estado
- Criar os mercados novos sem limpar os antigos antes
- Achar que "236 de 236 países cobertos" prova que o frete chega
- Deixar a loja com nome de fábrica
- Escrever na política algo que a configuração da loja desmente
- Vender para a União Europeia sem o direito de 14 dias e sem o formulário
