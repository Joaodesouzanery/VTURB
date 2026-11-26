/* Monta a section .liquid autocontida a partir dos modulos.
   Os modulos existem separados porque assim dao pra testar no node;
   a loja recebe um arquivo so, sem dependencia externa.

   Rodar: node montar.mjs [destino.liquid]                          */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const S = join(AQUI, 'section');

const ORDEM = [
  'bx-fit-dados.js',
  'bx-fit-core.js',
  'bx-fit-silhueta.js',
  'bx-fit-theme.js',
  'bx-fit-ui.js',
  'bx-fit-boot.js',
];

const js = ORDEM.map((f) => {
  const src = readFileSync(join(S, f), 'utf8');
  return `/* ---------- ${f} ---------- */\n${src}`;
}).join('\n');

const css = readFileSync(join(S, 'bx-fit.css'), 'utf8');
let liquid = readFileSync(join(S, '_template.liquid'), 'utf8');

// Liquid dentro de <script> e <style> nao existe aqui, mas se um dia
// algum modulo usar {{ ou {% o Shopify tenta interpretar. Barrar cedo.
for (const [nome, txt] of [['JS', js], ['CSS', css]]) {
  if (/\{\{|\{%/.test(txt)) {
    console.error(`ERRO: ${nome} contem sintaxe Liquid ({{ ou {%), o que quebraria a section.`);
    process.exit(1);
  }
}

liquid = liquid.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);

const destino = resolve(process.argv[2] || join(AQUI, 'bx-provador-virtual.liquid'));
writeFileSync(destino, liquid, 'utf8');

const kb = (Buffer.byteLength(liquid, 'utf8') / 1024).toFixed(1);
console.log(`section montada: ${destino}`);
console.log(`  ${ORDEM.length} modulos + css, ${kb} KB`);
console.log(`  linhas: ${liquid.split('\n').length}`);
