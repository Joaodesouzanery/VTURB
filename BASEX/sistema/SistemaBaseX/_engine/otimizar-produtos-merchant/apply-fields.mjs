#!/usr/bin/env node
// apply-fields.mjs - aplica o plano via productUpdate + productVariantsBulkUpdate
// Uso: node apply-fields.mjs --plan path.json --store minhaloja.myshopify.com [--dry-run=false]
// Padrao e dry-run. SO grava na loja com --dry-run=false.

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
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

const planPath = args.plan;
const store = args.store;
const dryRun = boolArg(args['dry-run'], true);
const batchSize = parseInt(args['batch-size'] || '50');

if (!planPath || !store) {
  console.error('ERRO: --plan {path.json} --store {handle} obrigatorios');
  process.exit(2);
}

const plan = JSON.parse(readFileSync(planPath, 'utf-8'));

const logsDir = join(__dirname, 'logs');
mkdirSync(logsDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const logPath = join(logsDir, `apply-${store}-${ts}.jsonl`);

console.log('\n=== Apply Fields ===');
console.log(`Store:     ${store}`);
console.log(`Plan:      ${planPath}`);
console.log(`Produtos:  ${plan.products.length}`);
console.log(`Batch:     ${batchSize}`);
console.log(`Dry-run:   ${dryRun}`);
console.log(`Log:       ${logPath}\n`);

if (!dryRun) {
  console.log('AVISO: vai aplicar mutation REAL em producao em 3 segundos. Ctrl+C pra abortar.');
  await new Promise((r) => setTimeout(r, 3000));
}

const PRODUCT_UPDATE_MUTATION = `
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

function logEntry(obj) {
  appendFileSync(logPath, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n');
}

// Tipos dos metafields mm-google-shopping (Shopify usa definicoes especificas).
// Se a definicao na loja for diferente, mutation falha — usar este mapa pra acertar.
const METAFIELD_TYPES = {
  age_group: 'single_line_text_field',
  gender: 'single_line_text_field',
  condition: 'single_line_text_field',
  custom_product: 'boolean',
  google_product_category: 'single_line_text_field',
  color: 'single_line_text_field',
  size: 'single_line_text_field',
  custom_label_0: 'single_line_text_field',
  custom_label_1: 'single_line_text_field',
  custom_label_2: 'single_line_text_field',
  custom_label_3: 'single_line_text_field',
  custom_label_4: 'single_line_text_field',
};

function buildMetafield(key, value) {
  const type = METAFIELD_TYPES[key] || 'single_line_text_field';
  let v = value;
  if (type === 'boolean') {
    // Aceita boolean ou string 'true'/'false'
    v = (value === true || value === 'true') ? 'true' : 'false';
  } else {
    v = String(value);
  }
  return { namespace: 'mm-google-shopping', key, value: v, type };
}

function buildProductInput(p) {
  const metafields = [];
  for (const [key, value] of Object.entries(p.product_changes)) {
    if (key === 'product_category') continue; // handled below
    metafields.push(buildMetafield(key, value));
  }
  // Google product category vira metafield (Shopify mapeia internamente pro channel Google&YT)
  const pc = p.product_changes.product_category;
  if (pc && typeof pc === 'object' && pc.id && !pc.status) {
    metafields.push(buildMetafield('google_product_category', String(pc.id)));
  }
  const input = { id: p.id };
  if (metafields.length > 0) input.metafields = metafields;
  return input;
}

// Campos que podem vir no plano de variante (cor/tamanho/idade/genero/condition/custom + inventory)
const VARIANT_METAFIELD_KEYS = ['color', 'size', 'age_group', 'gender', 'condition', 'custom_product', 'custom_label_0', 'custom_label_1', 'custom_label_2', 'custom_label_3', 'custom_label_4'];

function buildVariantInputs(p) {
  const out = [];
  for (const [vid, changes] of Object.entries(p.variant_changes || {})) {
    const metafields = [];
    for (const k of VARIANT_METAFIELD_KEYS) {
      if (changes[k] !== undefined && changes[k] !== null && changes[k] !== '') {
        metafields.push(buildMetafield(k, changes[k]));
      }
    }
    const v = { id: vid };
    if (metafields.length > 0) v.metafields = metafields;
    if (changes.inventory_policy) v.inventoryPolicy = changes.inventory_policy;
    out.push(v);
  }
  return out;
}

async function applyOne(p) {
  const productInput = buildProductInput(p);
  const variantInputs = buildVariantInputs(p);

  if (dryRun) {
    console.log(`[DRY] ${p.handle}: productInput=${JSON.stringify(productInput).length}b variants=${variantInputs.length}`);
    logEntry({ event: 'dry_run', handle: p.handle, productInput, variantInputs });
    return { ok: true };
  }

  const errors = [];

  const outFile = join(__dirname, '.tmp-out.json');
  const varsFile = join(__dirname, '.tmp-vars.json');

  // 1. productUpdate
  if (Object.keys(productInput).length > 1) {
    try {
      const queryFile = join(__dirname, '.tmp-product.graphql');
      writeFileSync(queryFile, PRODUCT_UPDATE_MUTATION);
      writeFileSync(varsFile, JSON.stringify({ input: productInput }));
      execSync(`shopify store execute --store ${store} --query-file "${queryFile}" --variable-file "${varsFile}" --allow-mutations --json --output-file "${outFile}"`, { stdio: 'pipe', timeout: 30000 });
      const d = JSON.parse(readFileSync(outFile, 'utf-8'));
      const uErr = d?.productUpdate?.userErrors || [];
      if (uErr.length > 0) errors.push({ stage: 'productUpdate', errors: uErr });
    } catch (e) {
      const stderr = e.stderr ? e.stderr.toString().slice(0, 300) : '';
      errors.push({ stage: 'productUpdate', exception: String(e.message).slice(0, 200), stderr });
    }
  }

  // 2. variantsBulkUpdate
  if (variantInputs.length > 0) {
    try {
      const queryFile = join(__dirname, '.tmp-variants.graphql');
      writeFileSync(queryFile, VARIANTS_BULK_UPDATE);
      writeFileSync(varsFile, JSON.stringify({ productId: p.id, variants: variantInputs }));
      execSync(`shopify store execute --store ${store} --query-file "${queryFile}" --variable-file "${varsFile}" --allow-mutations --json --output-file "${outFile}"`, { stdio: 'pipe', timeout: 30000 });
      const d = JSON.parse(readFileSync(outFile, 'utf-8'));
      const uErr = d?.productVariantsBulkUpdate?.userErrors || [];
      if (uErr.length > 0) errors.push({ stage: 'variantsBulkUpdate', errors: uErr });
    } catch (e) {
      const stderr = e.stderr ? e.stderr.toString().slice(0, 300) : '';
      errors.push({ stage: 'variantsBulkUpdate', exception: String(e.message).slice(0, 200), stderr });
    }
  }

  logEntry({ event: 'apply', handle: p.handle, ok: errors.length === 0, errors });
  return { ok: errors.length === 0, errors };
}

let success = 0;
let failure = 0;
const failureList = [];

for (let i = 0; i < plan.products.length; i += batchSize) {
  const batch = plan.products.slice(i, i + batchSize);
  console.log(`\nBatch ${Math.floor(i / batchSize) + 1}/${Math.ceil(plan.products.length / batchSize)} (${batch.length} produtos)`);
  for (const p of batch) {
    const result = await applyOne(p);
    if (result.ok) success++;
    else {
      failure++;
      failureList.push({ handle: p.handle, errors: result.errors });
    }
  }
  if (!dryRun && i + batchSize < plan.products.length) {
    console.log('Sleep 1s entre batches (rate limit safety)...');
    await new Promise((r) => setTimeout(r, 1000));
  }
}

console.log('\n=== Resultado ===');
console.log(`Sucesso: ${success}`);
console.log(`Falha:   ${failure}`);
if (failureList.length > 0) {
  console.log('\nFalhas:');
  for (const f of failureList.slice(0, 10)) {
    console.log(`  ${f.handle}: ${JSON.stringify(f.errors).slice(0, 200)}`);
  }
}
console.log(`\nLog completo: ${logPath}`);
if (dryRun) console.log('\nDRY-RUN: nenhuma mutation foi enviada. Rerun com --dry-run=false pra aplicar.');
