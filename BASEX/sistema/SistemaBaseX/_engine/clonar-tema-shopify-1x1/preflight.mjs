#!/usr/bin/env node
/**
 * Pre-flight check — Fase 0 da skill 55.
 *
 * Valida:
 * - shopify CLI autenticado no store
 * - SOURCE + TARGET theme IDs existem
 * - roles estão coerentes (target=MAIN precisa confirmação explícita)
 * - dir /tmp/theme-clone/ é gravável
 *
 * Uso: node preflight.mjs --source=<gid> --target=<gid> --store=<handle> [--publish-after]
 * Exit 0 = OK, non-zero = ABORT.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [null, null];
  }).filter(([k]) => k)
);

const SOURCE = args.source;
const TARGET = args.target;
const STORE = args.store;
const PUBLISH = args['publish-after'] === true || args['publish-after'] === 'true';

if (!SOURCE || !TARGET || !STORE) {
  console.error('MISSING ARGS: --source=<gid> --target=<gid> --store=<handle>');
  process.exit(2);
}

const q = `query themes { themes(first: 25) { nodes { id name role } } }`;
const qPath = `${tmpdir()}/preflight-q.gql`;
writeFileSync(qPath, q);

let out;
try {
  out = execSync(
    `shopify store execute --store ${STORE} --query-file ${qPath} --json`,
    { encoding: 'utf8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
  );
} catch (e) {
  console.error('SHOPIFY CLI FAILED:', e.message);
  console.error('Verifique: shopify store auth --store ' + STORE);
  process.exit(3);
}

const clean = out.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
const jsStart = clean.indexOf('{');
const data = JSON.parse(clean.slice(jsStart));
const themes = Object.fromEntries(data.themes.nodes.map(t => [t.id, t]));

if (!themes[SOURCE]) {
  console.error(`SOURCE ${SOURCE} não existe na store`);
  process.exit(4);
}
if (!themes[TARGET]) {
  console.error(`TARGET ${TARGET} não existe na store`);
  process.exit(4);
}

const source = themes[SOURCE];
const target = themes[TARGET];

console.log(`✓ SOURCE: ${source.name} (${source.role})`);
console.log(`✓ TARGET: ${target.name} (${target.role})`);

if (target.role === 'MAIN') {
  console.log('');
  console.log('⚠️  TARGET é MAIN/LIVE.');
  console.log('   Todas as alterações serão visíveis PUBLICAMENTE imediatamente.');
  console.log('   Confirme explicitamente antes de continuar.');
  if (!PUBLISH && process.env.SKILL_55_CONFIRM !== 'yes') {
    console.error('   ABORTANDO. Set SKILL_55_CONFIRM=yes para prosseguir.');
    process.exit(5);
  }
}

// Snapshot dir gravável?
const dir = '/tmp/theme-clone';
try {
  mkdirSync(dir, { recursive: true });
  statSync(dir);
  console.log(`✓ Snapshot dir gravável: ${dir}`);
} catch (e) {
  console.error(`Snapshot dir não gravável: ${e.message}`);
  process.exit(6);
}

console.log('');
console.log('PRE-FLIGHT OK. Pronto para Fase 1 (snapshot).');
console.log(JSON.stringify({
  source: { id: SOURCE, name: source.name, role: source.role },
  target: { id: TARGET, name: target.name, role: target.role },
  store: STORE,
  publish_after: PUBLISH,
  snapshot_dir: dir,
}, null, 2));
