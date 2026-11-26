#!/usr/bin/env node
/**
 * Le sections/{slug}.liquid, extrai t: keys do schema, popula locales/en.default.schema.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) =>
    a.startsWith('--')
      ? [[a.slice(2), (arr[i + 1] && !arr[i + 1].startsWith('--')) ? arr[i + 1] : true]]
      : []
  )
);

const sectionPath = args.section;
const localeFile = args['locale-file'];
const dryRun = args['dry-run'] === true;

if (!sectionPath || !localeFile) {
  console.error('Uso: node gen-locale.mjs --section path/sections/x.liquid --locale-file path/locales/en.default.schema.json [--dry-run]');
  process.exit(2);
}

const liquidContent = readFileSync(sectionPath, 'utf8');
const slug = basename(sectionPath, '.liquid');

// Extrair bloco schema
const schemaMatch = liquidContent.match(/{%\s*schema\s*%}([\s\S]+?){%\s*endschema\s*%}/);
if (!schemaMatch) {
  console.error('Bloco schema nao encontrado em', sectionPath);
  process.exit(1);
}

let schema;
try {
  schema = JSON.parse(schemaMatch[1].trim());
} catch (err) {
  console.error('Schema JSON invalido:', err.message);
  process.exit(1);
}

// Funcao recursiva pra encontrar todas as t: keys
const tKeys = new Set();
function collectKeys(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach(collectKeys);
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && v.startsWith('t:')) {
      tKeys.add(v.slice(2));
    } else if (typeof v === 'object') {
      collectKeys(v);
    }
  }
}
collectKeys(schema);

// Carregar locale atual (ou {})
const locale = existsSync(localeFile)
  ? JSON.parse(readFileSync(localeFile, 'utf8'))
  : {};

// Pra cada t: key, garantir caminho no JSON. Se nao existe, gerar texto a partir do path.
let novas = 0;
let existentes = 0;
for (const key of tKeys) {
  const path = key.split('.');
  let cur = locale;
  for (let i = 0; i < path.length - 1; i++) {
    if (!cur[path[i]]) cur[path[i]] = {};
    cur = cur[path[i]];
  }
  const last = path[path.length - 1];
  if (cur[last] === undefined) {
    // Humanizar a partir do ID do setting, nao do sufixo (label/content/name),
    // senao todo campo sairia chamado "Label" e os headers Desktop/Mobile sairiam ambos como "Content".
    let i = path.length - 1;
    if (['label', 'content', 'name'].includes(last) && i > 0) i--;
    let fonte = path[i];
    // Segmento numerico (presets.0.name) nao vira texto util: usa o pai + o numero.
    if (/^\d+$/.test(fonte) && i > 0) {
      fonte = `${path[i - 1].replace(/s$/, '')} ${Number(fonte) + 1}`;
    }
    const human = fonte
      .replace(/^header_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    cur[last] = human;
    novas++;
  } else {
    existentes++;
  }
}

console.error(`Section: ${slug}`);
console.error(`t: keys encontradas: ${tKeys.size}`);
console.error(`Novas (a inserir): ${novas}`);
console.error(`Existentes (preservadas): ${existentes}`);

if (dryRun) {
  console.log(JSON.stringify({
    dry_run: true,
    section: slug,
    t_keys: Array.from(tKeys),
    novas, existentes,
    locale_preview: locale.sections?.[slug],
  }, null, 2));
  process.exit(0);
}

writeFileSync(localeFile, JSON.stringify(locale, null, 2) + '\n');
console.log(JSON.stringify({
  ok: true,
  section: slug,
  novas, existentes,
  locale_file: localeFile,
}));
