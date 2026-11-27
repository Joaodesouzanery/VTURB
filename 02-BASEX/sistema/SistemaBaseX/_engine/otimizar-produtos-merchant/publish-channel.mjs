#!/usr/bin/env node
// publish-channel.mjs - publica produtos no canal Google & YouTube
// Uso: node publish-channel.mjs --store minhaloja.myshopify.com --snapshot path.json [--dry-run=false]

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

const store = args.store;
const snapshotPath = args.snapshot;
const dryRun = boolArg(args['dry-run'], true);

if (!store || !snapshotPath) {
  console.error('ERRO: --store + --snapshot obrigatorios');
  process.exit(2);
}

// 1. Buscar publication ID do canal Google & YouTube
const PUBLICATIONS_QUERY = `
query { publications(first: 20) { nodes { id name } } }
`;

writeFileSync(join(__dirname, '.tmp-q.graphql'), PUBLICATIONS_QUERY);
execSync(`shopify store execute --store ${store} --query-file ${join(__dirname, '.tmp-q.graphql')} --json --output-file ${join(__dirname, '.tmp-out.json')}`, { stdio: 'pipe', timeout: 15000 });
const pubs = JSON.parse(readFileSync(join(__dirname, '.tmp-out.json'), 'utf-8'));
const googleYT = pubs?.publications?.nodes?.find((p) => /google\s*&\s*youtube|google.*youtube/i.test(p.name));

if (!googleYT) {
  console.error('Canal Google & YouTube NAO encontrado na loja. Publications disponiveis:');
  for (const p of pubs?.publications?.nodes || []) console.error(`  ${p.id} | ${p.name}`);
  console.error('\nInstalar app Google & YouTube no admin antes de rodar este script.');
  process.exit(3);
}

console.log(`Canal alvo: ${googleYT.name} (${googleYT.id})`);

const snap = JSON.parse(readFileSync(snapshotPath, 'utf-8'));

const PUBLISH = `
mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    userErrors { field message }
  }
}
`;

let success = 0;
let failure = 0;

for (const p of snap.products) {
  if (dryRun) {
    console.log(`[DRY] publish ${p.handle} -> ${googleYT.name}`);
    success++;
    continue;
  }
  try {
    writeFileSync(join(__dirname, '.tmp-q.graphql'), PUBLISH);
    writeFileSync(join(__dirname, '.tmp-v.json'), JSON.stringify({ id: p.id, input: [{ publicationId: googleYT.id }] }));
    execSync(`shopify store execute --store ${store} --query-file ${join(__dirname, '.tmp-q.graphql')} --variable-file ${join(__dirname, '.tmp-v.json')} --allow-mutations --json --output-file ${join(__dirname, '.tmp-out.json')}`, { stdio: 'pipe', timeout: 20000 });
    const d = JSON.parse(readFileSync(join(__dirname, '.tmp-out.json'), 'utf-8'));
    const errs = d?.publishablePublish?.userErrors || [];
    if (errs.length > 0) {
      failure++;
      console.error(`FAIL ${p.handle}: ${JSON.stringify(errs).slice(0, 150)}`);
    } else {
      success++;
      console.log(`OK ${p.handle}`);
    }
  } catch (e) {
    failure++;
    console.error(`EXC ${p.handle}: ${String(e.message).slice(0, 150)}`);
  }
}

console.log(`\nPublicados: ${success}, Falhas: ${failure}`);
if (dryRun) console.log('DRY-RUN: nada foi publicado. Rerun com --dry-run=false pra aplicar.');
