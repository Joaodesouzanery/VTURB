# Theme Sections

Três sections avulsas para tema Shopify Online Store 2.0. São arquivos `.liquid` estáticos: não há
script, não precisam de Node, Python, chave de API nem conta paga além da própria Shopify.

Nenhuma delas edita `theme.liquid`, `base.css` ou `main.js`. Todo o CSS é escopado por prefixo de
classe dentro do próprio arquivo.

## Como instalar

1. Admin da Shopify → Online Store → Themes → `...` → Edit code.
2. Em `Sections`, clique em **Add a new section**, dê o mesmo nome do arquivo (sem `.liquid`) e cole
   o conteúdo inteiro por cima do que o editor criar.
3. Volte ao Customizer → **Add section** → a section aparece na lista pelo nome do preset.

Por linha de comando, com o tema baixado: jogue o `.liquid` em `sections/` e rode
`shopify theme push --only sections/<arquivo>.liquid`.

## O que cada uma faz

| Arquivo | Section no customizer | Para que serve |
|---|---|---|
| `category-circles.liquid` | Category Circles | Grade de categorias em círculo, com controle de tamanho |
| `collections-slider.liquid` | Collections Slider | Slider horizontal com as coleções da loja |
| `utility-header-bar.liquid` | Utility Header Bar | Barra de links acima do announcement bar |

### Category Circles

Grade de até 12 blocos, um por coleção, cada uma num círculo. Aceita imagem e título customizados
por bloco, que sobrescrevem a imagem e o título da coleção. Sem imagem escolhida, cai para a imagem
da coleção, depois para a foto do primeiro produto e por último para o placeholder do tema.

Controles: tamanho do círculo (desktop e mobile em separado), espaçamento, alinhamento centro ou
esquerda, cor de fundo, cor de texto e padding.

Serve para temas cujo `collection-list` nativo só liga o slider quando o número de blocos passa de
`columns_desktop`, o que deixa a lista quebrada com poucas coleções.

### Collections Slider

Puxa as coleções da loja sozinho, sem precisar cadastrar bloco por bloco. Pula os handles
`frontpage` e `all`, que são padrão da Shopify e não são categoria de verdade.

Controles: ordenação (A-Z, Z-A ou por número de produtos), quantos cards aparecem no desktop e no
mobile, raio do canto, overlay sobre a imagem com opacidade regulável e as cores.

**Limite de 50 coleções.** O `for` do Liquid corta em 50 itens quando não recebe `limit:`. Loja com
mais de 50 coleções vai renderizar só as 50 primeiras da ordenação escolhida. Se precisar de todas,
troque o `for` da linha 50 por `{%- for coll in col_list limit: 250 -%}` e teste o tempo de
carregamento da página depois.

As setas `‹ ›` só aparecem a partir de 750px de largura. No mobile a navegação é o arraste do dedo.

### Utility Header Bar

Barra de links (Lojas Físicas, Blog, o que for) acima do announcement bar. Puxa de um menu criado em
Admin → Navigation, escolhido no campo `Menu de utilidade`.

Só pode ser adicionada dentro do grupo `header` do tema, porque o schema declara
`enabled_on: { groups: ["header"] }`. Fica escondida abaixo de 750px, para não roubar altura da tela
no celular.
