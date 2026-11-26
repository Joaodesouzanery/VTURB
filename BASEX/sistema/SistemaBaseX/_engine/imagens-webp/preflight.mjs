#!/usr/bin/env node
// Pre-flight da skill "Converter Imagens para WebP".
// Uso: node preflight.mjs "<pasta-ou-arquivo>"
// Sai 0 se pode converter, 1 se falta algo. Nao converte nada.

import { existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const AQUI = dirname(fileURLToPath(import.meta.url));
const alvo = process.argv[2];
const checks = [];
const EXT = new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.heic', '.heif', '.gif']);

function check(nome, ok, extra = '') {
  checks.push({ nome, ok, extra });
}

// 1. o caminho foi informado e existe
if (!alvo) {
  console.error('Uso: node preflight.mjs "<pasta-ou-arquivo>"');
  process.exit(1);
}
check('Caminho existe', existsSync(alvo), alvo);

// 2. a engine esta no lugar
const engine = join(AQUI, 'convert.py');
check('Engine convert.py', existsSync(engine), engine);

// 3. python3 disponivel
let py = false;
try {
  execFileSync('python3', ['--version'], { stdio: 'pipe' });
  py = true;
} catch {}
check('python3 no PATH', py, py ? '' : 'instale o Python 3');

// 4. Pillow instalado (nao vem por padrao)
let pil = false;
if (py) {
  try {
    execFileSync('python3', ['-c', 'from PIL import Image'], { stdio: 'pipe' });
    pil = true;
  } catch {}
}
check('Pillow instalado', pil, pil ? '' : 'rode: pip3 install --user Pillow');

// 5. escopo: quantas imagens seriam convertidas
let total = 0;
if (existsSync(alvo)) {
  const st = statSync(alvo);
  if (st.isDirectory()) {
    for (const f of readdirSync(alvo)) {
      if (EXT.has(extname(f).toLowerCase())) total++;
    }
  } else if (EXT.has(extname(alvo).toLowerCase())) {
    total = 1;
  }
}
check('Imagens no escopo', total > 0, total + ' arquivo(s)');

console.log('\n=== Pre-flight: imagens-webp ===\n');
let bloqueios = 0;
for (const c of checks) {
  console.log(`[${c.ok ? 'OK' : 'FAIL'}]   ${c.nome}${c.extra ? '  (' + c.extra + ')' : ''}`);
  if (!c.ok) bloqueios++;
}
if (bloqueios) {
  console.error(`\n${bloqueios} bloqueio(s). Nao converta ate resolver.`);
  process.exit(1);
}
console.log('\nPode converter. Rode com --dry-run primeiro se for usar --replace.');
