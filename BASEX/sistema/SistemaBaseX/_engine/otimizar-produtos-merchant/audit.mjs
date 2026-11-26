#!/usr/bin/env node
// audit.mjs - re-fetch produtos e mostra diff antes (snapshot) vs depois (live)
// Uso: node audit.mjs --snapshot path.json --store minhaloja.myshopify.com

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const snapshotPath = args.snapshot;
const store = args.store;

if (!snapshotPath || !store) {
  console.error('ERRO: --snapshot {path.json} --store {handle} obrigatorios');
  process.exit(2);
}

const snap = JSON.parse(readFileSync(snapshotPath, 'utf-8'));

// Re-run snapshot mas pra mesmos produtos do snapshot original
const handles = snap.products.map((p) => p.handle).join(',');
const tmpCmd = `node ${join(__dirname, 'snapshot.mjs')} --store ${store} --filter ${handles}`;
console.log(`Re-snapshotting ${snap.products.length} produtos...`);
try {
  execSync(tmpCmd, { stdio: 'inherit', timeout: 120000 });
} catch (e) {
  console.error('Re-snapshot falhou:', e.message);
  process.exit(3);
}

// Pega o snapshot mais recente
const snapDir = join(__dirname, 'snapshots');
const newSnapPath = execSync(`ls -t "${snapDir}"/*.json | head -1`).toString().trim();
const newSnap = JSON.parse(readFileSync(newSnapPath, 'utf-8'));

console.log('\n=== Diff antes vs depois ===\n');

function countMetafields(products, key, level) {
  let with_val = 0;
  let without = 0;
  let total = 0;
  for (const p of products) {
    if (level === 'product') {
      const mf = p.metafields?.nodes?.find((m) => m.key === key);
      total++;
      if (mf?.value) with_val++;
      else without++;
    } else if (level === 'variant') {
      for (const v of p.variants?.nodes || []) {
        total++;
        const mf = v.metafields?.nodes?.find((m) => m.key === key);
        if (mf?.value) with_val++;
        else without++;
      }
    } else if (key === 'product_category' && level === 'product') {
      total++;
      if (p.productCategory?.productTaxonomyNode?.id) with_val++;
      else without++;
    }
  }
  return { with_val, without, total };
}

const FIELDS = [
  { key: 'age_group', level: 'product' },
  { key: 'gender', level: 'product' },
  { key: 'condition', level: 'product' },
  { key: 'custom_product', level: 'product' },
  { key: 'color', level: 'variant' },
  { key: 'size', level: 'variant' },
];

console.log('Campo            | Antes (X/Y)        | Depois (X/Y)       | Delta');
console.log('-----------------|--------------------|--------------------|-------');
for (const f of FIELDS) {
  const before = countMetafields(snap.products, f.key, f.level);
  const after = countMetafields(newSnap.products, f.key, f.level);
  const delta = after.with_val - before.with_val;
  console.log(
    `${(f.key + ' (' + f.level + ')').padEnd(17)}| ${(before.with_val + '/' + before.total).padEnd(20)}| ${(after.with_val + '/' + after.total).padEnd(20)}| ${delta >= 0 ? '+' : ''}${delta}`
  );
}

// productCategory separado
const pcBefore = snap.products.filter((p) => p.productCategory?.productTaxonomyNode?.id).length;
const pcAfter = newSnap.products.filter((p) => p.productCategory?.productTaxonomyNode?.id).length;
console.log(
  `${'product_category'.padEnd(17)}| ${(pcBefore + '/' + snap.products.length).padEnd(20)}| ${(pcAfter + '/' + newSnap.products.length).padEnd(20)}| ${pcAfter - pcBefore >= 0 ? '+' : ''}${pcAfter - pcBefore}`
);

console.log(`\nNovo snapshot: ${newSnapPath}`);
