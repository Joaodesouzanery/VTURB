# Engine: refatorar-section

Motor da skill `03. Skills/19. Deixar a Secao Editavel no Computador e no Celular.md`.

## Regra do squad (vale pra toda section)

**Toda section entregue tem versão desktop e versão mobile.** No schema isso aparece como dois
grupos separados: um `{ "type": "header", "content": "Desktop" }` com os settings `desktop_*`
logo abaixo, e um `{ "type": "header", "content": "Mobile" }` com os settings `mobile_*`.
Section com um único bloco de settings servindo os dois tamanhos não passa no `checar-mobile.mjs`.

O migrator preserva essa separação e nomeia as chaves dos headers a partir do texto deles:
`settings.header_desktop.content` e `settings.header_mobile.content`.

## Requisitos

Só Node 20 ou mais novo. **Zero dependência externa** (os únicos imports são `node:fs` e
`node:path`), nenhum acesso à rede e nenhum login a configurar. Não existe `npm install` a fazer — o
`package-lock.json` está aqui só pra provar isso.

## Arquivos

| Arquivo | Função |
|---|---|
| `checar-mobile.mjs` | Gate da regra acima: lê o schema, cobra o par desktop/mobile de cada ajuste e os dois headers de grupo. Sai 1 quando reprova, com a lista do que falta |
| `gen-locale.mjs` | Lê `sections/{slug}.liquid`, extrai todas as `t:sections.{slug}.*` keys do schema e popula `locales/en.default.schema.json` (merge, preserva customizações manuais) |
| `migrator-v1-to-v2.mjs` | Migra sections v1 (label hardcoded em string) pra v2 (label `t:` keys + locale populado) |
| `package.json` | Metadados e atalhos `npm run gen-locale` / `npm run migrate-v1-to-v2`. Declara Node >= 20 e nenhuma dependência |
| `package-lock.json` | Lock vazio (nenhum pacote), confirma que não há instalação a fazer |

## Uso

```bash
# Conferir o par desktop/mobile antes de mandar pra loja
node checar-mobile.mjs --section /path/sections/promise.liquid

# Gerar locale a partir do schema
node gen-locale.mjs --section /path/sections/promise.liquid --locale-file /path/locales/en.default.schema.json

# Dry-run mostra o que SERIA mudado, sem gravar (a flag pode vir em qualquer posição)
node gen-locale.mjs --dry-run --section ... --locale-file ...

# Migrar section v1 → v2
node migrator-v1-to-v2.mjs --section /path/sections/promise.liquid --locale-file /path/locales/en.default.schema.json [--dry-run]
```

O `checar-mobile.mjs` aceita só `--section`. O `gen-locale.mjs` e o `migrator-v1-to-v2.mjs` aceitam apenas `--section`, `--locale-file` e `--dry-run`. O slug é sempre o
basename do arquivo `.liquid` (não existe flag `--slug`).

## Como funciona o `gen-locale.mjs`

1. Lê o arquivo `.liquid`
2. Extrai o bloco `{% schema %} ... {% endschema %}`
3. Identifica todas as `t:sections.{slug}.*` no JSON
4. Lê `locales/en.default.schema.json` atual (se não existir, cria `{}`)
5. Pra cada `t:` key, popula a entrada se não existir (preserva customizações manuais)
6. Salva o JSON merged

O texto inicial de cada entrada é humanizado a partir do **id do setting**, não do sufixo:
`desktop_padding_top.label` vira `Desktop Padding Top` e `header_mobile.content` vira `Mobile`.
É rascunho pra o Theme Editor ficar legível de cara — reescrever à mão depois é esperado, e o
merge da etapa 5 nunca sobrescreve o que já foi escrito.

## Como funciona o `migrator-v1-to-v2.mjs`

1. Lê o arquivo `.liquid` v1 (com `"label": "Texto direto"`)
2. Pra cada setting, gera key `t:sections.{slug}.settings.{id}.label`
3. Settings de block vão pro namespace do block: `t:sections.{slug}.blocks.{type}.settings.{id}.label`
4. Substitui o label hardcoded pela key
5. Popula `en.default.schema.json` com os textos extraídos
6. Salva arquivo `.liquid` v2

**Preserva CSS, blocks e presets. Só mexe nos labels do schema.**

## O que a engine NÃO faz

Nenhum dos scripts gera Liquid, CSS ou a section em si. Eles mexem em locale e em labels de
um schema que já existe. Escrever o `.liquid` (markup, CSS com variáveis e a media query de 749px,
headers Desktop e Mobile) continua sendo trabalho do agente seguindo o template da skill.
