#!/usr/bin/env node
// Placar de ROI (aprendizado). Fonte de verdade: data/placar.json (sincroniza no SistemaBaseX).
// Espelha tabela legível em '02. Conhecimento/Operação & Performance/01. Catálogo de Ações e Placar de ROI.md'.
// Comandos:
//   node score-engine.mjs list
//   node score-engine.mjs record --action "baixar CPA target" [--context "minha loja"] --roi-before 1.4 --roi-after 1.9 [--dry-run]
//   node score-engine.mjs render [--dry-run]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(__dirname, '..', '..');
const DATA_DIR = resolve(__dirname, 'data');
const PLACAR = resolve(DATA_DIR, 'placar.json');
// Localiza '02. Conhecimento/Operação & Performance' aceitando prefixo numérico
// na pasta (ex.: '16. Operação & Performance') e nomes normalizados em NFD.
const ALVO_CONHECIMENTO = 'Operação & Performance'.normalize('NFC');
const dirConhecimento = () => {
  const base = resolve(RAIZ, '02. Conhecimento');
  if (!existsSync(base)) return null;
  const hit = readdirSync(base).find((d) => {
    const n = d.normalize('NFC');
    return n === ALVO_CONHECIMENTO || n.replace(/^\d+\.\s*/, '') === ALVO_CONHECIMENTO;
  });
  return hit ? resolve(base, hit) : null;
};

const CONHECIMENTO = dirConhecimento();
const CATALOGO_MD = CONHECIMENTO ? resolve(CONHECIMENTO, '01. Catálogo de Ações e Placar de ROI.md') : null;

const args = process.argv.slice(2);
const cmd = args[0];
const dryRun = args.includes('--dry-run');
const flag = (n, d = null) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };

const load = () => existsSync(PLACAR) ? JSON.parse(readFileSync(PLACAR, 'utf8')) : { acoes: [] };
const save = (db) => { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); writeFileSync(PLACAR, JSON.stringify(db, null, 2)); };
const ranked = (db) => [...db.acoes].sort((a, b) => (b.pontos - a.pontos) || (b.wins - a.wins));

if (cmd === 'list') {
  const db = load();
  if (!db.acoes.length) { console.log('(placar vazio)'); process.exit(0); }
  for (const a of ranked(db)) console.log(`${a.pontos >= 0 ? '+' : ''}${a.pontos}\t${a.wins}W/${a.losses}L\t${a.acao}`);
  process.exit(0);
}

if (cmd === 'record') {
  const acao = flag('action');
  const contexto = flag('context', '');
  const before = parseFloat(flag('roi-before'));
  const after = parseFloat(flag('roi-after'));
  if (!acao || Number.isNaN(before) || Number.isNaN(after)) {
    console.error('Uso: record --action "..." [--context "..."] --roi-before X --roi-after Y [--dry-run]');
    process.exit(1);
  }
  const raw = Math.round((after - before) * 10);
  const delta = Math.max(-5, Math.min(5, raw || (after > before ? 1 : after < before ? -1 : 0)));
  const db = load();
  let a = db.acoes.find((x) => x.acao.toLowerCase() === acao.toLowerCase());
  if (!a) { a = { acao, pontos: 0, wins: 0, losses: 0, historico: [] }; db.acoes.push(a); }
  const entry = { data: new Date().toISOString().slice(0, 10), contexto, roiBefore: before, roiAfter: after, delta };
  console.log(`Ação: ${acao}`);
  console.log(`ROI ${before} -> ${after} | delta pontos: ${delta >= 0 ? '+' : ''}${delta}`);
  if (dryRun) { console.log('[dry-run] nada gravado'); process.exit(0); }
  a.pontos += delta;
  if (after > before) a.wins++; else if (after < before) a.losses++;
  a.historico.push(entry);
  save(db);
  renderMd(db);
  console.log('Placar atualizado.');
  process.exit(0);
}

if (cmd === 'render') {
  const db = load();
  if (dryRun) { console.log('[dry-run] regeneraria o catálogo .md'); process.exit(0); }
  const ok = renderMd(db);
  console.log(ok ? 'Catálogo .md regenerado.' : 'Nada foi regenerado.');
  process.exit(ok ? 0 : 1);
}

console.error('Comandos: list | record | render');
process.exit(1);

function renderMd(db) {
  if (!CATALOGO_MD || !existsSync(CATALOGO_MD)) {
    console.error('[placar] catálogo .md não encontrado em "02. Conhecimento/Operação & Performance/01. Catálogo de Ações e Placar de ROI.md": nada foi espelhado');
    return false;
  }
  let md = readFileSync(CATALOGO_MD, 'utf8');
  const linhas = ranked(db).map((a) => {
    const ultima = (a.historico[a.historico.length - 1] || {}).data || '-';
    return `| ${a.pontos} | ${a.wins}/${a.losses} | ${a.acao} | ${ultima} |`;
  }).join('\n') || '| - | - | (placar vazio) | - |';
  const tabela = `| Pontos | W/L | Ação | Última |\n|---:|:---:|---|---|\n${linhas}`;
  const re = /(<!-- PLACAR:START -->)[\s\S]*?(<!-- PLACAR:END -->)/;
  if (!re.test(md)) {
    console.error('[placar] marcadores <!-- PLACAR:START/END --> ausentes no catálogo .md, nada foi espelhado');
    return false;
  }
  md = md.replace(re, `$1\n${tabela}\n$2`);
  writeFileSync(CATALOGO_MD, md);
  return true;
}
