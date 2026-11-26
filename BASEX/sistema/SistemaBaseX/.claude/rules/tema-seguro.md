# Não quebrar o tema da loja

> Vale para toda operação que escreve em tema Shopify: aplicar seção, colocar a marca, montar loja a partir de referência, aplicar carrinho, kit com desconto.

## A regra que não se quebra

**Nunca editar `layout/theme.liquid` nem `layout/password.liquid` de um tema existente**, mesmo que pareça um erro óbvio de quem escreveu.

Esses arquivos são o esqueleto que envelopa a página inteira. Eles carregam truques acoplados a atributos que o JavaScript do tema lê, ordem de carregamento de CSS e JS que importa, e variáveis de cor usadas por dezenas de seções. Otimização objetivamente melhor, do tipo `font-display: swap` ou carregamento tardio de CSS, **também quebra**, porque o tema assume um comportamento específico.

## O que pode e o que não pode

| Operação | Pode | Observação |
|---|---|---|
| Acrescentar seção nova em `sections/` | sim | com liga-desliga começando desligado |
| Acrescentar snippet novo em `snippets/` | sim | não sobrescreva um que já existe |
| Acrescentar arquivo em `assets/` | sim | não referencie a partir do `theme.liquid` |
| Acrescentar template novo | sim | |
| Editar seção existente | com cuidado | só se for necessário, e com valor padrão de reserva |
| Editar snippet existente | com cuidado | pode quebrar toda página que o usa |
| Editar `layout/theme.liquid` | **nunca** | |
| Editar `layout/password.liquid` | **nunca** | |
| Editar `assets/base.css` ou o CSS principal | **nunca** sem confirmação explícita | cascata interdependente |
| Editar o JS principal do tema | **nunca** sem confirmação explícita | quebra a interatividade |
| Editar `config/settings_schema.json` | **nunca** sem confirmação explícita | invalida ajustes já salvos |

## Antes de qualquer envio

Liste os arquivos alterados e pergunte, nesta ordem:

1. Está dentro do que foi pedido?
2. Tem `layout/theme.liquid` na lista? Pare e peça confirmação.
3. Tem `layout/password.liquid`, CSS principal, JS principal ou `settings_schema.json`? Pare.
4. O tema alvo é o publicado, o que está no ar? Pare, exceto se a pessoa pediu isso explicitamente.

Se algum destes disparar, explique: "isso exige mexer em arquivo crítico do tema, e eu estou bloqueado pela regra de segurança; quer mesmo seguir?"

**Sempre envie só os arquivos que você mudou.** Enviar uma pasta parcial sem restringir os arquivos já apagou seções inteiras de um tema em produção.

## Antes de sobrescrever, puxe a versão de agora

O dono da loja também edita pelo editor visual da Shopify, e isso escreve em `config/settings_data.json` e nos `templates/*.json`. O envio sobrescreve o remoto sem misturar e sem avisar.

- Puxe o arquivo fresco imediatamente antes de enviar. Nunca envie a partir de cópia de uma sessão anterior.
- `settings_data.json` e `templates/*.json` só vão depois de comparar com a versão que está na loja.
- Apareceu mudança que não foi sua? Pare, avise, incorpore antes de sobrescrever.
- Nunca resolva conflito descartando a versão remota em silêncio.

## Dois erros que já custaram caro

**Div vazio some.** O CSS do Dawn tem uma regra que esconde elemento vazio. Camada visual sem conteúdo, tipo véu, sobreposição ou degradê, precisa de `display: block` declarado, senão não aparece e não dá erro nenhum.

**Seção recarregada por AJAX usa o id do DOM, nunca o nome do arquivo.** Tema clonado quase sempre carrega o arquivo original convivendo com o substituto que de fato roda. Pedir o nome do arquivo morto devolve HTML válido, status 200, zero erro no console, e injeta o markup de outro tema dentro da casca do atual. Tire o id de `closest('[id^="shopify-section-"]')`.

## Se quebrou

1. Liste todos os arquivos que você mudou.
2. Reverta um por um para o conteúdo anterior.
3. Envie os revertidos.
4. Confirme com a pessoa que voltou ao normal.
5. Diga o que aprendeu, para não repetir.
