# Motor `concorrente` · mineração, raio-x, Central da operação e nova marca

Motor das skills 136 (Minerar Concorrentes), 137 (Raio-X do Concorrente) e 138 (Apresentação da Nova Marca), as três primeiras etapas do fluxo **Mineração → Raio-X → Apresentação da nova marca → Produção**. Lê a biblioteca de anúncios da Meta sem login, com um navegador próprio em segundo plano, e o catálogo público das lojas Shopify.

## Primeira vez na máquina

```bash
python3 _engine/concorrente/preflight.py --instalar   # instala o Playwright e o navegador de coleta, uma vez
python3 _engine/concorrente/preflight.py              # tem que sair "Pronto para rodar."
```

## Os scripts, na ordem do fluxo

| Script | Etapa | O que faz |
|---|---|---|
| `minerar.py` | 136 | o nicho que o aluno escolheu: lojas do Repositório de Nichos (`_engine/acervo-nichos`) mais as novas anunciando na biblioteca; lê o catálogo, conta os anúncios, marca os filtros e a origem |
| `loja.py` | 137 | catálogo público de uma loja: produtos, preço, riscado, coleções, mais vendidos, contexto, idiomas, apps, seções da home e os sinais de venda da página do produto principal |
| `coletar_pecas.py` | 137 | censo da página com os desligados (idade da conta, vida por tipo, títulos e copies que morreram), download das peças ativas, miniaturas e folhas de 12; coleta repetida mantém o código de cada peça |
| `catalogo.py` | 137 | o catálogo inteiro de cada referência: produtos, coleções com os produtos de cada uma, miniaturas em folhas de 10 x 10 e as linhas do CSV no formato de importação da Shopify (aba Produtos) |
| `previa.mjs` | 136 e 137 | a prévia do site: home no computador e no celular e a página do produto principal (`--mercado`: só a home no celular das lojas do Mercado) |
| `classificar.md` | 137 | o guia que o Claude segue para classificar cada peça (formato, gancho, funil, oferta, copy) |
| `conferir.py` | 137 | conferência do fim do raio-x: lista as referências sem página de produto (limite de leitura, loja não lida, prévia que faltou); `--esperar H` espera a loja liberar, relê e tira a prévia; sai com código 1 se sobrar |
| `organizar.py` | 137 | valida a classificação, separa por formato, escreve `catalogo.html` e `resumo.md` |
| `central.py` | 137 e 138 | a Central da operação: Início, Mercado, Referências, Banco, Produtos, Site, A marca, Criativos, Tráfego e Tasks; e `Apresentação da marca.html` avulsa |
| `marca-exemplo.json` | 138 | o molde das decisões da marca |
| `adlib-pw-paginar.mjs` | todas | o coletor da biblioteca pelo cursor do GraphQL; cópia do `recriar-video-global` da casa |

## Medidas do teste (03/11/2026, relógio, US e GB)

- Mineração com 3 palavras × 2 países: 4 min 50 s, 147 páginas, 63 lojas Shopify, 7 no nicho.
- Raio-X de uma loja de relógios (ensaio): 109 anúncios, 107 arquivos, 80 baixados, 58 peças distintas (29 vídeos), 2 a 4 min de coleta e 5 folhas para classificar.
- A loja roda um corpo de anúncio só para as 58 peças; 48% demonstração na mão, 26% oferta direta, motivo do desconto em 100%.

## Armadilhas já pagas

- **A página da biblioteca às vezes não tem corpo aos 12 s** e o coletor caía com `Cannot read properties of null (reading 'innerText')` (busca "men's watch" nos EUA, 03/11/2026). O coletor espera o `body` e lê com guarda; a mineração tenta a busca de novo. Corrigido também no original do `recriar-video-global`.
- **Página de abas que só lê o `#aba` ao abrir** não troca de aba quando o endereço muda na mesma página: um teste por endereço fotografou o Início dez vezes. A Central escuta `hashchange`; teste de aba se faz trocando o `location.hash` ou clicando.
- **Recoletar muda a ordem das peças:** com o código por posição, a classificação feita cairia na peça errada. O código agora segue o md5 do arquivo.
- **Leitura de catálogo que falha por instantes não pode virar "não é Shopify".** Com 8 leituras em paralelo, a melhor loja do teste sumiu da tabela na segunda rodada. O `loja.py` tenta de novo em 429, 5xx e timeout, e a mineração lista as que não responderam em vez de calar.
- **A página às vezes não escreve o "~N resultados" a tempo.** A contagem tenta duas vezes antes de deixar "—".
- **"Closing sale" sozinho traz curso, concessionária e leilão.** O filtro de Shopify e o de nicho limpam; o `--nicho` é o ajuste.
- **O link da mídia vence em horas.** Coleta e download na mesma passada; para baixar de novo, apagar o `censo.json`.
- **Chrome em linha de comando tem largura mínima perto de 500 px.** Print de celular por `--window-size=390` corta a página e parece defeito; medir com viewport emulado (Playwright) antes de mexer no CSS.
- **A Central vive em dois endereços e os dois são republicados juntos** (05/11/2026). O `publicar.py` do Cloudflare não atualiza o artefato do claude.ai: numa operação da casa, os banners com texto foram ao Cloudflare e o artefato ficou na versão da véspera, sem texto, e o Lucas viu por lá. Depois de todo `central.py`, além do Cloudflare, rodar `publish_files` no slug de `central_artefato.json` com `index.html` e o que mudou em `central_arquivos/` (modo patch, base_version do `get_artifact`) e gravar a versão nova na ficha.
- **A publicação do artefato recusa arquivo com mais de um link** ("the file has more than one hard link", 03/11/2026). A pasta `criativos/` do raio-x é feita de atalhos fixos para `_brutos/`; o `central.py` copia a mídia para `central_midia/` e o `central_publicar.json` aponta para a cópia.
- **Aviso de cookie da Shopify vive em shadow DOM** e o `querySelectorAll` não enxerga: a prévia saía com a caixa por cima da home (loja de relógios do ensaio). O `previa.mjs` clica pelo `getByRole` do Playwright, que atravessa.
- **Popup de cupom nasce depois da rolagem**: a limpeza antes do print não pegava. Ela roda ao carregar, depois de rolar e logo antes do print.
- **Loja que barra visitante automático redireciona** (byepoch.com foi para o Google): a prévia confere o endereço final e descarta a que não é da loja.
- **`python3 -I` esconde o Pillow instalado no usuário** (`pip3 install --user`): rodar os scripts do motor sem `-I`, como o aluno roda.
- **Mercado com 60 lojas ninguém lê** (Lucas, 03/11/2026): o `minerar.py` leva no máximo 10 para a aba Mercado (`--max`) e guarda o resto em `reserva`.
