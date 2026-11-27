#!/usr/bin/env node
/**
 * Aplica overrides via translationsRegister em lotes de 100.
 * Filtra automaticamente URL fields e Shopify nativas (defesa em profundidade).
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) =>
    a.startsWith('--') ? [[a.slice(2), arr[i + 1] ?? true]] : []
  )
);

const store = args.store;
const locale = args.locale;
const overridesPath = args.overrides;
const dryRun = args['dry-run'] === true;

if (!store || !locale || !overridesPath) {
  console.error('Uso: node apply.mjs --store {handle} --locale fr --overrides path.json [--dry-run]');
  process.exit(2);
}

if (!existsSync(overridesPath)) {
  console.error('Overrides nao encontrado:', overridesPath);
  process.exit(1);
}

const payload = JSON.parse(readFileSync(overridesPath, 'utf8'));
const overrides = (payload.overrides ?? payload).filter(o => o.tr_proposta);

function isUrlField(key, value) {
  if (!value || typeof value !== 'string') return false;
  return (
    value.startsWith('/') ||
    value.startsWith('shopify://') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('mailto:') ||
    key.endsWith('_url') ||
    key === 'handle' ||
    key === 'url'
  );
}

function isShopifyNativeKey(key) {
  return key.startsWith('shopify.checkout.') || key.startsWith('customer_account.');
}

// Filtro defesa em profundidade
const filtrados = overrides.filter(o => !isUrlField(o.key, o.tr_proposta) && !isShopifyNativeKey(o.key));
const pulados = overrides.length - filtrados.length;

if (dryRun) {
  console.log(JSON.stringify({
    dry_run: true,
    store, locale,
    overrides_total: overrides.length,
    overrides_pulados: pulados,
    overrides_aplicar: filtrados.length,
    amostra_10: filtrados.slice(0, 10),
  }, null, 2));
  process.exit(0);
}

const BATCH = 100;
const MUTATION = `
mutation Apply($resourceId: ID!, $translations: [TranslationInput!]!) {
  translationsRegister(resourceId: $resourceId, translations: $translations) {
    translations { key value locale }
    userErrors { code field message }
  }
}
`;

// Agrupar por resource_id
const porResource = filtrados.reduce((acc, o) => {
  (acc[o.resource_id] ??= []).push(o);
  return acc;
}, {});

const erros = [];
const sucessos = [];

for (const [resourceId, items] of Object.entries(porResource)) {
  console.error(`Resource ${resourceId} (${items.length} items)...`);

  // Lote por resource (cada resource pode ter ate 100 traducoes por chamada)
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const translations = batch.map(o => ({
      key: o.key,
      value: o.tr_proposta,
      translatableContentDigest: o.digest,
      locale,
    }));

    const tmp = join(tmpdir(), `apply-${Date.now()}-${i}.gql`);
    const varsFile = join(tmpdir(), `apply-vars-${Date.now()}-${i}.json`);
    const outFile = join(tmpdir(), `apply-out-${Date.now()}-${i}.json`);
    writeFileSync(tmp, MUTATION);
    writeFileSync(varsFile, JSON.stringify({ resourceId, translations }));

    try {
      execSync(
        `shopify store execute --store "${store}" --query-file "${tmp}" --variables-file "${varsFile}" --output-file "${outFile}" --allow-mutations 2>/dev/null`,
        { stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const data = JSON.parse(readFileSync(outFile, 'utf8'));
      const userErrors = data?.data?.translationsRegister?.userErrors ?? [];
      if (userErrors.length) {
        erros.push({ resource_id: resourceId, batch_start: i, userErrors });
        console.error(`  ERRO no lote ${i}:`, userErrors.map(e => e.message).join('; '));
      } else {
        sucessos.push({ resource_id: resourceId, aplicados: batch.length });
        console.error(`  OK lote ${i}: ${batch.length} traducoes`);
      }
      unlinkSync(tmp); unlinkSync(varsFile); unlinkSync(outFile);
    } catch (err) {
      erros.push({ resource_id: resourceId, batch_start: i, erro: err.message });
      console.error(`  FAIL lote ${i}:`, err.message);
    }
  }
}

console.log(JSON.stringify({
  store, locale,
  total_aplicado: sucessos.reduce((s, x) => s + x.aplicados, 0),
  pulados,
  erros,
  resumo_sucesso: sucessos,
}, null, 2));
