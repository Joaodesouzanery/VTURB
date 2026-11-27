#!/usr/bin/env node
// Pre-flight da skill "Aplicar Carrinho" (cart drawer Buy More Save More).
// Uso: node preflight.mjs --store minhaloja.myshopify.com
// Sai 0 se pode aplicar, 1 se falta algo. Nao escreve nada na loja.

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ARQUIVO = process.env.BASEX_ARQUIVO || join(AQUI, '..', '..');

const args = process.argv.slice(2);
const store = (args.find(a => a.startsWith('--store')) || '').split('=')[1]
  || (args.includes('--store') ? args[args.indexOf('--store') + 1] : null);

const checks = [];
const check = (nome, ok, extra = '') => checks.push({ nome, ok, extra });

// 1. Node 20+
const major = Number(process.versions.node.split('.')[0]);
check('Node 20+', major >= 20, 'v' + process.versions.node);

// 2. Shopify CLI no PATH
let cli = '';
try {
  cli = execFileSync('shopify', ['version'], { stdio: 'pipe' }).toString().trim();
} catch {}
check('Shopify CLI no PATH', Boolean(cli), cli || 'instale: npm i -g @shopify/cli');

// 3. Os templates do carrinho existem no SistemaBaseX
const tpl = join(ARQUIVO, '04. Templates', 'Cart Drawer BMSM');
const variantes = ['cart-drawer-sound-maestrooo.md', 'cart-drawer-liquid.md', 'cart-drawer-horizon.md'];
const faltando = variantes.filter(v => !existsSync(join(tpl, v)));
check('Templates das 3 variantes', faltando.length === 0, faltando.length ? 'faltam: ' + faltando.join(', ') : tpl);

// 4. Loja informada
check('Loja informada', Boolean(store), store || 'passe --store minhaloja.myshopify.com');

// 5. Acesso a loja: consegue listar os temas?
let temas = null;
if (store && cli) {
  try {
    const out = execFileSync('shopify', ['theme', 'list', '--store', store, '--json'], {
      stdio: 'pipe', timeout: 60000,
    }).toString();
    temas = JSON.parse(out.slice(out.indexOf('[')));
  } catch {}
}
check(
  'Acesso a loja (theme list)',
  Array.isArray(temas),
  Array.isArray(temas)
    ? temas.length + ' tema(s)'
    : 'rode: shopify auth login --store ' + (store || '<loja>')
);

// 6. Existe tema publicado para servir de base
const live = Array.isArray(temas) ? temas.find(t => t.role === 'live' || t.role === 'main') : null;
check('Tema publicado identificado', Boolean(live), live ? `${live.name} (#${live.id})` : '');

console.log('\n=== Pre-flight: aplicar-carrinho ===\n');
let bloqueios = 0;
for (const c of checks) {
  console.log(`[${c.ok ? 'OK' : 'FAIL'}]   ${c.nome}${c.extra ? '  (' + c.extra + ')' : ''}`);
  if (!c.ok) bloqueios++;
}
if (bloqueios) {
  console.error(`\n${bloqueios} bloqueio(s). Nao aplique ate resolver.`);
  process.exit(1);
}
console.log('\nPode aplicar. Lembre: instalar numa COPIA nao publicada do tema, validar no preview,');
console.log('e so publicar depois da sua conferencia. Nunca editar layout/theme.liquid.');
