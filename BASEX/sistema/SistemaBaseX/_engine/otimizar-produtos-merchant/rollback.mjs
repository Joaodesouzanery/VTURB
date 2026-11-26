#!/usr/bin/env node
// rollback.mjs - reverte aplicação usando snapshot pré-execução
// Uso: node rollback.mjs --snapshot path.json --store minhaloja.myshopify.com [--dry-run=false]

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

// Aceita --flag, --flag true, --flag=false, --flag no. Ausente devolve o padrao.
function boolArg(v, padrao) {
  if (v === undefined) return padrao;
  if (v === true) return true;
  return !/^(false|0|no|nao)$/i.test(String(v).trim());
}

const snapshotPath = args.snapshot;
const store = args.store;
const dryRun = boolArg(args['dry-run'], true);

if (!snapshotPath || !store) {
  console.error('ERRO: --snapshot {path.json} --store {handle} obrigatorios');
  process.exit(2);
}

const snap = JSON.parse(readFileSync(snapshotPath, 'utf-8'));

console.log('\n=== Rollback ===');
console.log(`Store:    ${store}`);
console.log(`Snapshot: ${snapshotPath}`);
console.log(`Produtos: ${snap.products.length}`);
console.log(`Dry-run:  ${dryRun}\n`);

if (!dryRun) {
  console.log('AVISO: vai reverter mutation REAL em 5 segundos. Ctrl+C pra abortar.');
  await new Promise((r) => setTimeout(r, 5000));
}

// Pra cada produto no snapshot, recriar productInput E variantInputs com os valores ORIGINAIS
const PRODUCT_UPDATE = `
mutation ProductUpdate($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id }
    userErrors { field message }
  }
}
`;

const VARIANTS_BULK_UPDATE = `
mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    userErrors { field message }
  }
}
`;

let success = 0;
let failure = 0;

for (const p of snap.products) {
  // Reverter metafields no produto pros valores que existiam no snapshot
  const productMetafields = (p.metafields?.nodes || []).map((m) => ({
    namespace: m.namespace,
    key: m.key,
    value: m.value,
    type: m.type,
  }));

  const productInput = { id: p.id };
  if (productMetafields.length > 0) productInput.metafields = productMetafields;
  if (p.productCategory?.productTaxonomyNode?.id) {
    productInput.productCategory = { productTaxonomyNodeId: p.productCategory.productTaxonomyNode.id };
  }

  // Reverter variantes
  const variantInputs = [];
  for (const v of p.variants?.nodes || []) {
    const vmf = (v.metafields?.nodes || []).map((m) => ({
      namespace: m.namespace,
      key: m.key,
      value: m.value,
      type: m.type,
    }));
    const vi = { id: v.id, inventoryPolicy: v.inventoryPolicy };
    if (vmf.length > 0) vi.metafields = vmf;
    variantInputs.push(vi);
  }

  if (dryRun) {
    console.log(`[DRY] ${p.handle}: revert ${productMetafields.length} pmf + ${variantInputs.length} variants`);
    success++;
    continue;
  }

  try {
    if (Object.keys(productInput).length > 1) {
      writeFileSync(join(__dirname, '.tmp-q.graphql'), PRODUCT_UPDATE);
      writeFileSync(join(__dirname, '.tmp-v.json'), JSON.stringify({ input: productInput }));
      execSync(`shopify store execute --store ${store} --query-file ${join(__dirname, '.tmp-q.graphql')} --variable-file ${join(__dirname, '.tmp-v.json')} --allow-mutations --json --output-file ${join(__dirname, '.tmp-out.json')}`, { stdio: 'pipe', timeout: 30000 });
    }
    if (variantInputs.length > 0) {
      writeFileSync(join(__dirname, '.tmp-q.graphql'), VARIANTS_BULK_UPDATE);
      writeFileSync(join(__dirname, '.tmp-v.json'), JSON.stringify({ productId: p.id, variants: variantInputs }));
      execSync(`shopify store execute --store ${store} --query-file ${join(__dirname, '.tmp-q.graphql')} --variable-file ${join(__dirname, '.tmp-v.json')} --allow-mutations --json --output-file ${join(__dirname, '.tmp-out.json')}`, { stdio: 'pipe', timeout: 30000 });
    }
    success++;
    console.log(`OK ${p.handle}`);
  } catch (e) {
    failure++;
    console.error(`FAIL ${p.handle}: ${String(e.message).slice(0, 150)}`);
  }
}

console.log(`\n=== Rollback completo ===`);
console.log(`Revertidos: ${success}`);
console.log(`Falhas:     ${failure}`);
if (dryRun) console.log('\nDRY-RUN: nada foi revertido. Rerun com --dry-run=false pra aplicar.');
