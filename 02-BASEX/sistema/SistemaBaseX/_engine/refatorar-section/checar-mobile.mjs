#!/usr/bin/env node
/**
 * Gate de par desktop/mobile.
 *
 * Le sections/{slug}.liquid, abre o bloco schema e cobra a regra da skill 19:
 * todo ajuste que muda entre as telas existe duas vezes, desktop_X e mobile_X,
 * e os dois grupos aparecem separados por um cabecalho no editor.
 *
 * Sai 0 quando passa, 1 quando reprova, 2 quando o uso esta errado.
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) =>
    a.startsWith('--')
      ? [[a.slice(2), (arr[i + 1] && !arr[i + 1].startsWith('--')) ? arr[i + 1] : true]]
      : []
  )
);

const sectionPath = args.section;
if (!sectionPath) {
  console.error('Uso: node checar-mobile.mjs --section caminho/sections/x.liquid');
  process.exit(2);
}

const liquid = readFileSync(sectionPath, 'utf8');
const nome = basename(sectionPath);

const m = liquid.match(/{%\s*schema\s*%}([\s\S]+?){%\s*endschema\s*%}/);
if (!m) {
  console.error(`${nome}: bloco schema nao encontrado.`);
  process.exit(1);
}

let schema;
try {
  schema = JSON.parse(m[1].trim());
} catch (err) {
  console.error(`${nome}: schema JSON invalido: ${err.message}`);
  process.exit(1);
}

const falhas = [];

function alvo(id, lado) {
  if (id.startsWith(lado + '_')) return id.slice(lado.length + 1);
  if (id.endsWith('_' + lado)) return id.slice(0, -(lado.length + 1));
  return null;
}

function conferir(rotulo, entradas) {
  const ids = entradas.filter(s => s && s.id).map(s => s.id);
  const cabecalhos = entradas
    .filter(s => s && s.type === 'header')
    .map(s => String(s.content || '').toLowerCase());

  const desktop = ids.filter(id => alvo(id, 'desktop'));
  const mobile = ids.filter(id => alvo(id, 'mobile'));

  if (desktop.length === 0 && mobile.length === 0) {
    falhas.push(`${rotulo}: nenhum ajuste de desktop nem de mobile. Um bloco unico de ajustes serve as duas telas com o mesmo valor.`);
    return;
  }
  const basesMobile = new Set(mobile.map(id => alvo(id, 'mobile')));
  const basesDesktop = new Set(desktop.map(id => alvo(id, 'desktop')));
  for (const id of desktop) {
    if (!basesMobile.has(alvo(id, 'desktop'))) falhas.push(`${rotulo}: ${id} sem o par de celular.`);
  }
  for (const id of mobile) {
    if (!basesDesktop.has(alvo(id, 'mobile'))) falhas.push(`${rotulo}: ${id} sem o par de computador.`);
  }
  const temDesktop = cabecalhos.some(c => c.includes('desktop') || c.includes('computador'));
  const temMobile = cabecalhos.some(c => c.includes('mobile') || c.includes('celular'));
  if (!temDesktop || !temMobile) {
    falhas.push(`${rotulo}: faltam os cabecalhos de grupo "Desktop" e "Mobile". Sem eles o editor mostra tudo numa lista so.`);
  }
}

conferir('secao', schema.settings || []);
for (const b of schema.blocks || []) {
  if (Array.isArray(b.settings) && b.settings.some(s => s && s.id && /^(desktop|mobile)_/.test(s.id))) {
    conferir(`bloco ${b.type}`, b.settings);
  }
}

if (falhas.length) {
  console.error(`${nome}: REPROVADO`);
  for (const f of falhas) console.error('  · ' + f);
  process.exit(1);
}

console.log(`${nome}: ok — ajustes pareados e agrupados em Desktop e Mobile.`);
