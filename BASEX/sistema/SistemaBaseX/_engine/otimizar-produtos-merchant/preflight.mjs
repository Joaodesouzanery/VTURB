#!/usr/bin/env node
// preflight.mjs - valida ambiente antes de qualquer operacao destrutiva
// Uso: node preflight.mjs --store minhaloja.myshopify.com [--lang es-ES]

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findTaxonomyFile } from './taxonomy-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq > -1) {
        // forma --chave=valor
        acc.push([arg.slice(2, eq), arg.slice(eq + 1)]);
      } else {
        const key = arg.slice(2);
        const value = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true;
        acc.push([key, value]);
      }
    }
    return acc;
  }, [])
);

const store = args.store;
if (!store) {
  console.error('ERRO: --store {handle.myshopify.com} obrigatorio');
  process.exit(2);
}

const checks = [];

// Check 1: Node 20+
const nodeMajor = parseInt(process.versions.node.split('.')[0]);
checks.push({
  nome: 'Node 20+',
  ok: nodeMajor >= 20,
  detalhe: `versao atual: ${process.versions.node}`,
});

// Check 2: Shopify CLI autenticado na loja
// Todos os scripts desta engine falam com a loja por `shopify store execute`,
// entao este e o unico caminho de auth que importa.
let cliConnectorOk = false;
try {
  execSync(`shopify store execute --store ${store} --query 'query { shop { id } }' 2>&1`, {
    stdio: 'pipe',
    timeout: 15000,
  });
  cliConnectorOk = true;
} catch {
  cliConnectorOk = false;
}
checks.push({
  nome: 'Auth Shopify (CLI autenticado na loja)',
  ok: cliConnectorOk,
  detalhe: cliConnectorOk
    ? 'CLI autenticado'
    : `NAO autenticado. Rodar: shopify store auth --store ${store} --scopes read_products,write_products,read_inventory,write_inventory,read_publications,write_publications`,
});

// Check 3: Scopes minimos
let scopesOk = false;
let scopesDetalhe = 'nao verificado (auth falhou)';
if (cliConnectorOk) {
  try {
    execSync(
      `shopify store execute --store ${store} --query 'query { products(first: 1) { nodes { id } } }' 2>&1`,
      { stdio: 'pipe', timeout: 15000 }
    );
    scopesOk = true;
    scopesDetalhe = 'read_products OK (assume write_products, read_inventory, write_inventory tambem)';
  } catch (e) {
    scopesDetalhe = 'read_products falhou: ' + String(e.message).slice(0, 100);
  }
}
checks.push({
  nome: 'Scopes API minimos',
  ok: scopesOk,
  detalhe: scopesDetalhe,
});

// Check 4: Taxonomy disponivel
const lang = args.lang || 'es-ES';
const taxonomyPath = findTaxonomyFile(__dirname, lang);
const alvo = join(__dirname, 'taxonomy', `${lang}.txt`);
checks.push({
  nome: `Taxonomy Google product category (${lang})`,
  ok: Boolean(taxonomyPath),
  detalhe: taxonomyPath
    ? `${taxonomyPath}`
    : `FALTA. Baixar o arquivo oficial do Google:\n         curl -o "${alvo}" https://www.google.com/basepages/producttype/taxonomy-with-ids.${lang}.txt`,
});

// Check 5: Pastas de saida
const dirs = ['snapshots', 'plans', 'logs'].map((d) => join(__dirname, d));
const dirsOk = dirs.every((d) => existsSync(d));
checks.push({
  nome: 'Pastas snapshots/plans/logs',
  ok: dirsOk,
  detalhe: dirsOk ? 'existem' : 'rodar: mkdir -p ' + dirs.join(' '),
});

// Print
console.log('\n=== Pre-flight: Otimizar Produtos para Merchant Center ===\n');
console.log(`Store: ${store}`);
console.log(`Lang:  ${lang}\n`);

let bloqueios = 0;
for (const c of checks) {
  const tag = c.ok ? '[OK]  ' : '[FAIL]';
  console.log(`${tag} ${c.nome}`);
  console.log(`       ${c.detalhe}`);
  if (!c.ok) bloqueios++;
}

console.log('');
if (bloqueios === 0) {
  console.log('Tudo OK. Pode seguir pro Passo 2 (snapshot).');
  process.exit(0);
} else {
  console.error(`${bloqueios} check(s) falharam. Resolver antes de seguir.`);
  process.exit(1);
}
