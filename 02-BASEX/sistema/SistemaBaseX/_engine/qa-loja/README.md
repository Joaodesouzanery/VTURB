# qa-loja

Conferências de entrega de uma loja Shopify. Usam a autenticação do Shopify CLI que já está na máquina (`lib.mjs`); nenhum token vai para arquivo.

| Arquivo | O que confere | Como rodar |
|---|---|---|
| `qa-sweep.mjs` | Gate A: mede a loja no celular (390) e no computador (1280): galeria, imagem pesada, gaveta do carrinho, cabeçalho coberto, prazos diferentes na mesma página, encaixe do texto em cada idioma. Vermelho = não entregar | `node qa-sweep.mjs --help`; no modo `--run` precisa de `npm i -D playwright` nesta pasta. Com `--loja=<x>.myshopify.com` roda também os três gates abaixo |
| `gate-imagens-tema.mjs` | Referência de imagem morta no tema (`shopify://shop_images/...`, URL de CDN de outra loja, asset citado e ausente) | `node gate-imagens-tema.mjs <x>.myshopify.com` |
| `gate-midia-vazia.mjs` | Section ligada com a mídia vazia, que o tema desenha como placeholder ou cartão preto | `node gate-midia-vazia.mjs <x>.myshopify.com` (antes do push: `--dir=<pasta do tema>`) |
| `gate-material.mjs` | Material do produto em conflito com a coleção (poliéster dentro de "linho" ou "couro") | `node gate-material.mjs <x>.myshopify.com` |

Rode antes de entregar uma loja nova ou um tema novo, e depois de trocar o tema.
