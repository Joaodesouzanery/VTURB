# shopify-worldwide-setup (engine v3.0)

Engine da skill `04. Setup Loja Worldwide Shopify`. Configura uma loja Shopify para vender fora do
país de origem: políticas, menus, idioma English, mercados por região e zonas de frete. Fala com a
loja pelo Shopify CLI (`shopify store execute`), usando a autenticação que já está na sua máquina.

## O que ele faz, fase por fase

| `--phase` | O que executa | Mutation usada |
|---|---|---|
| `1b` | Grava as 6 políticas da loja (privacidade, reembolso, envio, termos, contato, aviso legal) com o nome e o e-mail que você passar | `shopPolicyUpdate` |
| `2` | Cria ou atualiza os menus Footer e Main menu, com os links das políticas | `menuCreate` / `menuUpdate` |
| `3` | Habilita e publica o idioma English | `shopLocaleEnable` / `shopLocaleUpdate` |
| `4a` | Cria 6 mercados nomeados: United Kingdom, Switzerland, Poland, Sweden, North America (US, CA) e Rest of Europe. Não cria "Eurozone" (decisão de 07/11/2026: repetia 20 países com mercado próprio) | `marketCreate` |
| `4b` | Cria o mercado Worldwide com 81 países, menos o país informado em `--home-country` | `marketCreate` |
| `4` | Roda `4a` e `4b` na sequência | |
| `5` | Cria as zonas de frete no perfil padrão (uma por país principal, mais United Kingdom e Worldwide), cada uma com uma tarifa grátis e uma expressa. Juntas cobrem os 114 países que a fase 4 abre como mercado | `deliveryProfileUpdate` |
| `all` | Roda todas as fases acima, na ordem | |

Fase de tradução (opcional) fica no submodule `translate/`, com comandos próprios. Veja
`translate/README.md`.

## Pré-requisitos

- Python 3.8 ou superior. O engine usa só a biblioteca padrão, não precisa de `pip install`.
- Node 18 ou superior para o `preflight.mjs`. O submodule `translate/` pede Node 20.
- Shopify CLI: `npm install -g @shopify/cli @shopify/theme`
- Autenticação na sua loja, com os escopos de markets, shipping, locales, content e navigation:

```bash
shopify store auth --store {handle}.myshopify.com --scopes "read_content,write_content,read_files,write_files,read_publications,write_publications,read_online_store_navigation,write_online_store_navigation,read_online_store_pages,write_online_store_pages,read_locales,write_locales,read_markets,write_markets,read_shipping,write_shipping,read_translations,write_translations"
```

Rode o pre-flight antes de qualquer fase. Ele checa Python, Shopify CLI, os arquivos do engine e se
a autenticação da loja existe na máquina:

```bash
node preflight.mjs --store {handle}.myshopify.com
```

Exit 0 significa que pode seguir. Exit 1 lista o que falta.

## Como rodar

`--store`, `--brand-name` e `--support-email` são obrigatórios. Sem os três, o script para na hora.

```bash
# Todas as fases
python3 worldwide_setup.py \
  --store {handle}.myshopify.com \
  --brand-name "Minha Marca" \
  --support-email suporte@minhamarca.com

# Uma fase só
python3 worldwide_setup.py --store {handle}.myshopify.com \
  --brand-name "Minha Marca" --support-email suporte@minhamarca.com --phase 5
```

Argumentos opcionais: `--brand-domain`, `--legal-entity`, `--address` (entram no texto das políticas
e do aviso legal), `--products` e `--home-country` (padrão `BR`, país que fica de fora do mercado
Worldwide).

Nome de fase que não esteja na tabela acima é recusado com erro. No fim da execução o script grava
`log.json` na própria pasta, com o resultado de cada fase.

`--dry-run` imprime o plano completo (mercados, zonas de frete, países por zona e tarifas de cada
zona) e sai sem tocar na loja. Ele também confere se todo país que vira mercado tem tarifa, e avisa
os que ficariam de fora. Rode isso antes de rodar de verdade.

## Limites conhecidos (leia antes de rodar em loja com venda ativa)

1. **Não existe backup nem rollback.** O único arquivo gravado é o `log.json`. Reverter é manual, pelo
admin da Shopify, em Settings → Markets e Settings → Shipping.
2. **A fase 5 reescreve a zona International.** Ela vira `Rest of World`, com os 81 países do
catch-all, e as tarifas antigas dela são deletadas. Operação sem volta, mas agora o alcance cresce
em vez de encolher: até a versão anterior essa zona era estreitada para 17 micro-estados, e a loja
terminava o setup abrindo 114 mercados e entregando em 12 países.
3. **As fases de mercado não conferem o que já existe.** `4a` e `4b` chamam `marketCreate` direto,
sem checagem prévia. Numa loja que já tem esses mercados, o que a Shopify responder vai para o
`log.json`. A fase 5, essa sim, pula zona que já existe pelo nome, então pode rodar de novo sem
duplicar.
4. **`policy_templates.json` não é lido pelo código.** As políticas aplicadas na fase 1b são as que
estão escritas dentro de `worldwide_setup.py`, na função `policies_dict()`. O JSON de templates fica
aqui como base para quem quiser reescrever esse texto por conta própria.
5. **Os prazos de entrega estão chumbados** no texto das tarifas e da política de envio (2-7 dias, 2-5
dias, 3-8 dias). Se o seu prazo real é outro, edite antes de rodar.

## Scripts à parte (rodar depois das fases)

Usam a autenticação do Shopify CLI que já está na máquina (`lib.mjs`, nada de token em arquivo). Os dois primeiros rodam em dry-run e só gravam com `--aplicar`.

| Script | Para quê |
|---|---|
| `mercados-cobertura.mjs <loja> [--aplicar]` | Garante que nenhum país fique sem mercado: cria o país da loja e um Worldwide com todo país sem cobertura. Sem isso, visitante de país descoberto vê a loja inteira como esgotada |
| `frete-por-mercado.mjs <loja> [--aplicar]` | Liga o frete dentro de cada mercado (modelo novo da Shopify, que ignora as zonas do perfil). Mercado sem opção de frete deixa todo produto físico como esgotado, com o Admin todo verde |
| `instalar-app.mjs <loja> <handle-do-app>` | Instala app da App Store pelo navegador aberto com depuração remota (`CDP_PORT`, padrão 9222). Cobrança e plano você aprova sozinho |

## Estrutura

```
shopify-worldwide-setup/
├── worldwide_setup.py       # Engine principal
├── preflight.mjs            # Checagem de ambiente
├── policy_templates.json    # Textos de política com placeholders (não usado pelo engine)
├── README.md                # Este arquivo
└── translate/               # Submodule de tradução (opcional)
    ├── preflight.mjs
    ├── scan.mjs
    ├── apply.mjs
    ├── glossary/generic.json
    ├── package.json
    └── README.md
```

## Skills que usam este engine

- `04. Setup Loja Worldwide Shopify`
- `05. Traduzir Produtos Shopify` (usa o submodule `translate/`)
