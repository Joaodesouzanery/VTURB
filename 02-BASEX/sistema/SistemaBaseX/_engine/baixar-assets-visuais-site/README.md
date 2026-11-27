# baixar-assets-visuais-site

Engine da skill [[49. Baixar Assets Visuais de Site]]. Captura logo, favicon, banners desktop/mobile e capas de coleção de qualquer site e organiza numa pasta local.

## Instalação (primeira vez)

```bash
cd "$VAULT/_engine/baixar-assets-visuais-site"
npm install
npx playwright install chromium
```

## Pre-flight

Sempre rodar antes da primeira execução numa URL nova:

```bash
node preflight.mjs --url https://useamalvi.com.br/
```

Valida Node 20+, playwright instalado, Chromium baixado, URL respondendo e destino gravável.

## Dry-run

Lista o que SERIA baixado sem efetivamente baixar:

```bash
node download.mjs --url https://useamalvi.com.br/ --dry-run
```

Inspecionar o plano antes de gastar tempo de execução real.

## Execução real

```bash
node download.mjs --url https://useamalvi.com.br/
```

Salva em `~/Desktop/useamalvi/` (slug derivado do domínio).

### Opções

| Flag | Default | O que faz |
|---|---|---|
| `--url` | (obrigatório) | URL completa do site |
| `--destino` | `~/Desktop/{slug}/` | Pasta destino. Slug = primeiro segmento do hostname sem `www.` |
| `--dry-run` | off | Não baixa nada, só mostra plano |
| `--max-por-categoria` | 30 | Limite por logo/banners-desktop/banners-mobile |
| `--max-colecoes` | 50 | Limite de coleções a capturar |
| `--timeout` | 30000 | Timeout do `page.goto` em ms |

## Output

```
~/Desktop/{slug}/
├── logo/                     # logos, favicon, apple-touch-icon, SVGs inline do header
├── banners-desktop/          # imagens grandes da home em viewport 1920x1080
├── banners-mobile/           # mesmas slots em viewport 390x844
├── colecoes/                 # imagem por coleção (via /collections.json em Shopify)
└── relatorio.md              # lista URL origem, tamanho, MIME por arquivo
```

Nomenclatura: `{ordem-2-digitos}-{slug-derivado-do-path}.{ext}`. Ex: `01-hero-summer.jpg`.

## Detecção de plataforma

Auto-detecta lendo o HTML da home:

| Plataforma | Sinal | Estratégia de coleções |
|---|---|---|
| Shopify | `cdn.shopify.com`, `window.Shopify` | `/collections.json` (preserva ordem) |
| WooCommerce | `wp-content`, `woocommerce` | Crawl genérico do DOM |
| VTEX | `vtex.com` | Crawl genérico |
| Nuvemshop | `nuvemshop`, `tiendanube` | Crawl genérico |
| Genérico | (default) | Varre links `/collections/`, `/categoria/`, `/c/`, `/shop/` |

## Deduplicação

Hash sha256 do conteúdo de cada arquivo. Se a mesma imagem aparece em 2 URLs diferentes (CDN com query string variável), só salva a primeira.

## Rollback

A operação só cria arquivos. Para reverter:

```bash
rm -rf ~/Desktop/{slug}/
```

Antes de rodar, conferir que `{slug}` é a pasta criada por esta skill (não outra pasta sua).

## Limitações

- Não burla Cloudflare/captcha. Se o site bloqueia bots, falha com 403.
- Não captura assets carregados via fetch dinâmico pós-scroll (só renderiza network-idle inicial).
- `picture > source` é capturado mas `media=` é só lido (não filtra por ele perfeitamente — vem nas duas categorias se ambíguo).
- SVG inline do header é serializado direto, sem otimização.

## Troubleshooting

| Erro | Causa | Solução |
|---|---|---|
| `playwright: Executable doesn't exist` | Chromium não baixado | `npx playwright install chromium` |
| `HEAD falhou: AbortError` | URL muito lenta (>8s) | Normal, segue mesmo assim |
| `0 colecoes` em loja Shopify | `/collections.json` 404 | Loja desabilitou endpoint público. Roda crawl DOM como fallback |
| Banners desktop e mobile iguais | Site sem `<picture>` responsivo | Esperado em sites antigos |
| Timeout em página com hero animado | Network nunca fica idle | `--timeout 60000` |

## Conexões

- Skill: `03. Skills/110. Montar a Loja a Partir do Modelo.md`
- Slash command: `/baixar-assets-visuais-site`
- Knowledge: [[31. Engines e dry-run universais em skills executáveis]]
