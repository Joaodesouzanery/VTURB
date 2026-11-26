#!/usr/bin/env node
// Histórico por loja (máx 4 semanas, rotativo). Grava dentro da pasta da loja no SistemaBaseX.
// Uso:
//   node history-rotate.mjs --loja "Minha Loja" --metrics metrics.json [--dry-run]
//   node history-rotate.mjs --loja "Minha Loja" --rollback        (restaura .bak)
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rollback = args.includes('--rollback');
const flag = (n, d = null) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };

const loja = flag('loja');
const dirBase = flag('dir', 'Minhas Lojas');
if (!loja) {
  console.error('Uso: --loja "Nome" [--dir "Minhas Lojas"] [--metrics m.json] [--dry-run] [--rollback]');
  process.exit(1);
}

const opDir = resolve(RAIZ, dirBase, loja, '_Operação');
const histFile = resolve(opDir, 'historico-4-semanas.md');
const bak = histFile + '.bak';
const hoje = new Date().toISOString().slice(0, 10);

if (rollback) {
  if (!existsSync(bak)) { console.error('Sem backup pra rollback: ' + bak); process.exit(1); }
  if (dryRun) { console.log('[dry-run] restauraria ' + bak); process.exit(0); }
  copyFileSync(bak, histFile);
  console.log('Histórico restaurado do backup.');
  process.exit(0);
}

const metricsPath = flag('metrics');
const CHAVES = ['faturamento', 'roas', 'cpa', 'conversao', 'gasto'];
let metrics = {};
if (metricsPath) {
  if (!existsSync(metricsPath)) {
    console.error('Arquivo de métricas não encontrado: ' + metricsPath);
    console.error('Confira o caminho. Sem ele a linha do dia entraria com traço em todas as colunas.');
    process.exit(1);
  }
  try { metrics = JSON.parse(readFileSync(metricsPath, 'utf8')); }
  catch (e) { console.error('JSON inválido em ' + metricsPath + ': ' + e.message); process.exit(1); }
  const ignoradas = Object.keys(metrics).filter((k) => !CHAVES.includes(k));
  if (ignoradas.length) console.error('AVISO: chave(s) ignorada(s) pelo histórico: ' + ignoradas.join(', ') + '. As aceitas são ' + CHAVES.join(', ') + ' (conversao sem acento)');
  const vazias = CHAVES.filter((k) => metrics[k] === undefined || metrics[k] === null);
  if (vazias.length) console.error('AVISO: sem valor para ' + vazias.join(', ') + ': essas colunas entram com traço');
}

const v = (x) => (x === undefined || x === null ? '-' : x);
const entryLine = `| ${hoje} | ${v(metrics.faturamento)} | ${v(metrics.roas)} | ${v(metrics.cpa)} | ${v(metrics.conversao)} | ${v(metrics.gasto)} |`;

console.log(`Loja: ${loja}`);
console.log('Dir: ' + opDir);
console.log('Linha a inserir: ' + entryLine);
if (dryRun) { console.log('[dry-run] nada gravado'); process.exit(0); }

if (!existsSync(opDir)) mkdirSync(opDir, { recursive: true });
let md;
if (existsSync(histFile)) { copyFileSync(histFile, bak); md = readFileSync(histFile, 'utf8'); }
else md = header(loja);

const marker = '<!-- HIST:ROWS -->';
md = md.replace(marker, marker + '\n' + entryLine);
md = pruneOld(md, 28);
writeFileSync(histFile, md);
console.log('Histórico atualizado e rotacionado (28 dias). Backup em .bak');

function header(nome) {
  return `---\ntipo: dados-operacao\nloja: "${nome}"\natualizado: ${hoje}\n---\n\n# Histórico de Operação - ${nome}\n\n> Máx. 4 semanas. Linhas com mais de 28 dias são descartadas automaticamente a cada execução.\n\n| Data | Faturamento | ROAS | CPA | Conversão | Gasto |\n|---|---|---|---|---|---|\n<!-- HIST:ROWS -->\n`;
}

function pruneOld(text, days) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return text.split('\n').filter((line) => {
    const m = line.match(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|/);
    if (!m) return true;
    return m[1] >= cutoff;
  }).join('\n');
}
