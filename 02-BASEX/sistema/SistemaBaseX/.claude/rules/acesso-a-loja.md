# Acesso à loja Shopify

> Vale para toda operação que lê ou escreve na loja.

## Teste antes de pedir autorização

O acesso fica guardado na máquina e dura cerca de 90 dias, renovando sozinho. Pedir autorização de novo sem necessidade faz a pessoa parar o que está fazendo, abrir o navegador e clicar em telas que ela já clicou.

A ordem é sempre esta:

1. **Tente uma consulta simples primeiro.**
   ```bash
   shopify store execute --store sualoja.myshopify.com --query 'query { shop { name } }'
   ```
2. Respondeu? Siga o trabalho. Não peça nada.
3. Disse **acesso negado**? O acesso existe mas falta permissão. Autorize de novo com o conjunto completo abaixo.
4. Disse **sem autorização guardada**? É a primeira vez. Autorize.
5. Disse **expirado**? A ferramenta tenta renovar sozinha. Só autorize de novo se a renovação falhar.

## Peça o conjunto completo de uma vez

Autorizar com permissão mínima parece cuidadoso e sai caro: a operação começa, avança metade e trava numa permissão que faltava, e a pessoa tem que autorizar de novo do zero.

```
read_themes,write_themes,read_products,write_products,read_content,write_content,
read_files,write_files,read_publications,write_publications,
read_online_store_navigation,write_online_store_navigation,
read_online_store_pages,write_online_store_pages,
read_locales,write_locales,read_markets,write_markets,
read_shipping,write_shipping,read_translations,write_translations,
read_discounts,write_discounts,read_price_rules,write_price_rules,
read_legal_policies,write_legal_policies,read_metaobjects,write_metaobjects,
read_inventory,write_inventory
```

Cada bloco cobre uma parte do trabalho: tema, produto, conteúdo e blog, arquivo e imagem, canais de venda, menu, página, idioma, mercado, frete, tradução, desconto, política, metaobjeto e estoque.

## Onde o acesso mora

Na máquina de quem é dono da loja, guardado pela própria ferramenta da Shopify. **Não copie o acesso para outro lugar**, não escreva ele dentro de arquivo do vault, não cole em conversa, não mande por mensagem. Se precisar em outra máquina, autorize de novo naquela máquina.

## Proibido

- Pedir autorização sem antes testar se já existe
- Pedir permissão fatiada, uma operação por vez
- Guardar chave, senha ou acesso em qualquer arquivo do vault
- Repetir a autorização quando a renovação automática resolveria
