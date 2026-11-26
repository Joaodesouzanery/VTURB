#!/usr/bin/env node
// snapshot.mjs - estado pre-execucao completo do catalogo
// Uso: node snapshot.mjs --store minhaloja.myshopify.com [--filter handle1,handle2|all]

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
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

const store = args.store;
const filter = args.filter || 'all';
if (!store) {
  console.error('ERRO: --store {handle.myshopify.com} obrigatorio');
  process.exit(2);
}

const QUERY = `
query ProductsPage($cursor: String) {
  products(first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      handle
      title
      productType
      vendor
      tags
      status
      productCategory { productTaxonomyNode { fullName id } }
      variants(first: 100) {
        nodes {
          id
          title
          sku
          option1: selectedOptions { name value }
          inventoryQuantity
          inventoryPolicy
          inventoryItem { id tracked }
          metafields(first: 30, namespace: "mm-google-shopping") {
            nodes { id namespace key value type }
          }
        }
      }
      metafields(first: 30, namespace: "mm-google-shopping") {
        nodes { id namespace key value type }
      }
    }
  }
}
`;

const snapshotsDir = join(__dirname, 'snapshots');
mkdirSync(snapshotsDir, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outPath = join(snapshotsDir, `${store}-${ts}.json`);

let allProducts = [];
let cursor = null;
let page = 0;

while (true) {
  page++;
  const queryFile = join(__dirname, '.snapshot-query.graphql');
  const outFile = join(snapshotsDir, '.last-page.json');
  writeFileSync(queryFile, QUERY);
  const vars = cursor ? ['--variables', `{"cursor":"${cursor}"}`] : [];
  const cmdArgs = [
    'shopify', 'store', 'execute',
    '--store', store,
    '--query-file', `"${queryFile}"`,
    ...vars.map((v) => v.startsWith('--') ? v : `'${v}'`),
    '--json',
    '--output-file', `"${outFile}"`,
  ];
  const cmd = cmdArgs.join(' ');
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 60000 });
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : '';
    const stdout = e.stdout ? e.stdout.toString() : '';
    console.error(`Page ${page}: ERRO`);
    console.error('stderr:', stderr.slice(0, 500));
    console.error('stdout:', stdout.slice(0, 500));
    console.error('cmd:', cmd.slice(0, 300));
    process.exit(3);
  }

  const d = JSON.parse(readFileSync(outFile, 'utf-8'));
  const nodes = d?.products?.nodes || [];
  const pi = d?.products?.pageInfo || {};

  allProducts.push(...nodes);
  console.log(`Page ${page}: +${nodes.length} (total ${allProducts.length})`);
  if (!pi.hasNextPage) break;
  cursor = pi.endCursor;
  if (page > 100) {
    console.error('Safety stop: 100 pages reached');
    break;
  }
}

// Apply filter if specified
if (filter !== 'all') {
  const handles = filter.split(',').map((h) => h.trim());
  allProducts = allProducts.filter((p) => handles.includes(p.handle));
  console.log(`Filtrado: ${allProducts.length} produtos com handle em [${handles.join(', ')}]`);
}

writeFileSync(outPath, JSON.stringify({ store, ts, filter, count: allProducts.length, products: allProducts }, null, 2));
console.log(`\nSnapshot salvo: ${outPath}`);
console.log(`Total produtos: ${allProducts.length}`);
console.log(`Variantes totais: ${allProducts.reduce((s, p) => s + (p.variants?.nodes?.length || 0), 0)}`);
console.log(`\nUsar este path em --snapshot do decide-fields.mjs`);
