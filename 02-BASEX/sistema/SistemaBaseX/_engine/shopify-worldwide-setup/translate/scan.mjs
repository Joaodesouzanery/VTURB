#!/usr/bin/env node
/**
 * Scan via translatableResources GraphQL.
 * Modos:
 *   completar: identifica campos com translatedValue vazio
 *   auditar: varre traducoes existentes e flagueia divergencias vs glossario + 14 erros
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) =>
    a.startsWith('--') ? [[a.slice(2), arr[i + 1] ?? true]] : []
  )
);

const store = args.store;
const locale = args.locale;
const modo = args.modo ?? 'completar';
const glossario = args.glossario ?? resolve(import.meta.dirname, 'glossary', 'generic.json');
const dryRun = args['dry-run'] === true;

if (!store || !locale) {
  console.error('Uso: node scan.mjs --store {handle} --locale fr [--modo completar|auditar] [--glossario path] [--dry-run]');
  process.exit(2);
}

const gloss = existsSync(glossario) ? JSON.parse(readFileSync(glossario, 'utf8')) : {};
const dictKey = `en_to_${locale.split('-')[0]}`;
const dict = gloss[dictKey] ?? {};
const skipUniversal = gloss.skip_keys_universal ?? [];

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
  return skipUniversal.some(prefix => key.startsWith(prefix));
}

const QUERY = `
query Scan($locale: String!, $cursor: String) {
  translatableResources(first: 50, after: $cursor) {
    edges {
      cursor
      node {
        resourceId
        translatableContent { key value digest locale }
        translations(locale: $locale) { key value }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
`;

if (dryRun) {
  console.log(JSON.stringify({
    dry_run: true,
    store, locale, modo,
    glossario: glossario,
    dict_keys: Object.keys(dict).length,
    skip_universal_count: skipUniversal.length,
    query_template: 'translatableResources com paginacao via cursor',
  }, null, 2));
  process.exit(0);
}

async function executar(cursor) {
  const tmpDir = join(tmpdir(), `wwsetup-scan-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const queryFile = join(tmpDir, 'q.gql');
  const varsFile = join(tmpDir, 'vars.json');
  const outFile = join(tmpDir, 'out.json');
  writeFileSync(queryFile, QUERY);
  writeFileSync(varsFile, JSON.stringify({ locale, cursor }));
  execSync(
    `shopify store execute --store "${store}" --query-file "${queryFile}" --variables-file "${varsFile}" --output-file "${outFile}" 2>/dev/null`,
    { stdio: ['ignore', 'pipe', 'ignore'] }
  );
  const data = JSON.parse(readFileSync(outFile, 'utf8'));
  unlinkSync(queryFile); unlinkSync(varsFile); unlinkSync(outFile);
  return data?.data?.translatableResources ?? { edges: [], pageInfo: { hasNextPage: false } };
}

const overrides = [];
let cursor = null;
let pagina = 0;

try {
  do {
    pagina++;
    console.error(`Pagina ${pagina}...`);
    const page = await executar(cursor);

    for (const { node } of page.edges) {
      const translations = Object.fromEntries((node.translations ?? []).map(t => [t.key, t.value]));

      for (const item of node.translatableContent) {
        const enValue = item.value;
        const trValue = translations[item.key];

        if (isUrlField(item.key, enValue)) continue;
        if (isShopifyNativeKey(item.key)) continue;

        if (modo === 'completar') {
          if (!trValue || trValue.trim() === '') {
            // Tentar dicionário (substring case-insensitive)
            let proposta = enValue;
            for (const [enTerm, locTerm] of Object.entries(dict)) {
              const re = new RegExp(`\\b${enTerm}\\b`, 'gi');
              if (re.test(proposta)) proposta = proposta.replace(re, locTerm);
            }
            overrides.push({
              resource_id: node.resourceId,
              key: item.key,
              digest: item.digest,
              en_value: enValue,
              tr_atual: '',
              tr_proposta: proposta === enValue ? null : proposta,
              regra: 'completar_via_glossario',
            });
          }
        } else if (modo === 'auditar' && trValue) {
          // Checa se tradução atual diverge do glossário
          for (const [enTerm, locTerm] of Object.entries(dict)) {
            const reEn = new RegExp(`\\b${enTerm}\\b`, 'gi');
            if (reEn.test(enValue) && !trValue.toLowerCase().includes(locTerm.toLowerCase())) {
              overrides.push({
                resource_id: node.resourceId,
                key: item.key,
                digest: item.digest,
                en_value: enValue,
                tr_atual: trValue,
                tr_proposta: trValue.replace(new RegExp(`\\b\\w+\\b`, 'i'), locTerm), // simplificado
                regra: `auditar_glossario:${enTerm}_${locTerm}`,
              });
              break;
            }
          }
        }
      }
    }

    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);

  console.log(JSON.stringify({
    store, locale, modo,
    total_overrides: overrides.length,
    overrides,
  }, null, 2));
} catch (err) {
  console.error('Erro:', err.message);
  process.exit(1);
}
