#!/usr/bin/env node
// Lê export .xlsx (layout Meta Ads Manager) e normaliza colunas via header-map.json.
// Read-only: não modifica o .xlsx. Uso:
//   node parse-xlsx.mjs <arquivo.xlsx> [--out saida.json]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
const outPath = outIdx >= 0 ? args[outIdx + 1] : null;

if (!file) {
  console.error('Uso: node parse-xlsx.mjs <arquivo.xlsx> [--out saida.json]');
  process.exit(1);
}
if (!existsSync(file)) { console.error('Arquivo não encontrado: ' + file); process.exit(1); }

const norm = (s) => String(s).toLowerCase().trim().replace(/[()%,]/g, '').replace(/\s+/g, ' ').trim();

const map = JSON.parse(readFileSync(resolve(__dirname, 'header-map.json'), 'utf8'));
const synonyms = map.synonyms || {};
const lookup = {};
const keys = [];
for (const [canon, list] of Object.entries(synonyms)) {
  lookup[norm(canon)] = canon;
  keys.push([norm(canon), canon]);
  for (const s of list) { lookup[norm(s)] = canon; keys.push([norm(s), canon]); }
}
// Match tolerante: exato -> prefixo (lida com sufixos tipo "purchase roas (return on ad spend)").
const matchHeader = (raw) => {
  const n = norm(raw);
  if (lookup[n]) return lookup[n];
  for (const [k, canon] of keys) {
    if (k.length > 3 && (n.startsWith(k) || k.startsWith(n))) return canon;
  }
  return null;
};

let XLSX;
try { const mod = await import('xlsx'); XLSX = mod.default ?? mod; }
catch { console.error('Lib xlsx ausente. Rode "npm install" em _engine/analisar-operacao.'); process.exit(1); }

const wb = XLSX.readFile(file);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

const mappedHeaders = {};
const unmapped = [];
const data = rows.map((row) => {
  const out = { _raw: {} };
  for (const [key, val] of Object.entries(row)) {
    const canon = matchHeader(key);
    if (canon) { out[canon] = val; mappedHeaders[key] = canon; }
    else { out._raw[key] = val; if (!unmapped.includes(key)) unmapped.push(key); }
  }
  return out;
});

const result = { source: file, rows: data.length, mappedHeaders, unmapped, data };
const json = JSON.stringify(result, null, 2);
if (outPath) { writeFileSync(outPath, json); console.log('Salvo: ' + outPath); }
else { console.log(json); }

console.error(`\n[parse] ${data.length} linhas | ${Object.keys(mappedHeaders).length} colunas mapeadas | ${unmapped.length} não mapeadas`);
if (unmapped.length) console.error('[parse] Não mapeadas (revisar header-map.json): ' + unmapped.join(', '));
