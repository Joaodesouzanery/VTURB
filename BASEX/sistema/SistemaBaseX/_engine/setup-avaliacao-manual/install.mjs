#!/usr/bin/env node
// Instala a section trust-reviews.liquid num tema Shopify.
// Uso:
//   node install.mjs --store handle.myshopify.com --theme <id|nome> [--password shptka_...] [--dry-run] [--allow-live]
//   node install.mjs --store handle.myshopify.com --theme <id|nome> --rollback [--dry-run]
// Seguranca: push cirurgico (--only + --nodelete). Tema LIVE bloqueado sem --allow-live.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const args = process.argv.slice(2);
const get = (k) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : null; };
const has = (k) => args.includes(k);

const STORE = get('--store');
const THEME = get('--theme');
const PASSWORD = get('--password');
const DRY = has('--dry-run');
const ALLOW_LIVE = has('--allow-live');
const ROLLBACK = has('--rollback');

const VAULT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CANON = join(VAULT, '06. Anexos', 'trust-reviews.liquid');
const FILE = 'sections/trust-reviews.liquid';

function fail(msg, code = 1) { console.error(msg); process.exit(code); }

if (!STORE || !THEME) {
  fail('Uso: node install.mjs --store <handle>.myshopify.com --theme <id|nome> [--password shptka_...] [--dry-run] [--allow-live] [--rollback]');
}
if (!ROLLBACK && !existsSync(CANON)) fail('[FAIL] Arquivo canonico nao encontrado: ' + CANON);

const pw = PASSWORD ? ` --password ${PASSWORD}` : '';

// 1. Resolver tema + role
let themes = [];
try {
  const out = execSync(`shopify theme list --store ${STORE}${pw} --json`, { encoding: 'utf8', timeout: 120000 });
  themes = JSON.parse(out.slice(out.indexOf('[')));
} catch (e) {
  fail('[FAIL] Nao consegui listar os temas de ' + STORE + '. Verifique credencial/handle. Detalhe: ' + e.message.split('\n')[0]);
}
const t = themes.find(x => String(x.id) === String(THEME) || (x.name || '').toLowerCase() === String(THEME).toLowerCase());
if (!t) {
  fail('[FAIL] Tema "' + THEME + '" nao encontrado. Temas disponiveis:\n' + themes.map(x => `  ${x.id}  "${x.name}"  (${x.role})`).join('\n'));
}
const isLive = t.role === 'main' || t.role === 'live';

// 2. Rollback (remove o arquivo do tema via Admin API)
if (ROLLBACK) {
  console.log(`Plano [rollback]: remover ${FILE} do tema "${t.name}" (#${t.id}, ${t.role}) em ${STORE}`);
  if (isLive && !ALLOW_LIVE) fail('[BLOQUEADO] Tema LIVE. Rode com --allow-live somente com autorizacao explicita.', 2);
  if (DRY) { console.log('[dry-run] Nada foi removido.'); process.exit(0); }
  const q = `mutation { themeFilesDelete(themeId: "gid://shopify/OnlineStoreTheme/${t.id}", files: ["${FILE}"]) { deletedThemeFiles { filename } userErrors { field message } } }`;
  try {
    execSync(`shopify store execute -s ${STORE} --json --no-color --allow-mutations -q "${q.replace(/"/g, '\\"')}"`, { stdio: 'inherit', timeout: 90000 });
    console.log('[OK] Rollback enviado. Se a section foi inserida em templates JSON, remova tambem a entrada do order.');
  } catch (e) {
    fail('[FAIL] themeFilesDelete falhou (precisa de auth OAuth com write_themes). Alternativa manual: admin > tema > Edit code > deletar ' + FILE);
  }
  process.exit(0);
}

// 3. Gate de tema live
console.log(`Plano: instalar ${FILE} no tema "${t.name}" (#${t.id}, ${t.role}) da loja ${STORE}`);
if (isLive && !ALLOW_LIVE) {
  fail('[BLOQUEADO] "' + t.name + '" e o tema LIVE (publicado). Regra de seguranca: instale primeiro num tema backup/unpublished, valide, e rode com --allow-live somente com autorizacao explicita do dono da loja.', 2);
}
if (DRY) { console.log('[dry-run] Nada foi enviado. Nenhum outro arquivo do tema sera tocado (--only + --nodelete).'); process.exit(0); }

// 4. Push cirurgico a partir de pasta temporaria
const tmp = join(os.tmpdir(), 'trust-reviews-' + Date.now());
mkdirSync(join(tmp, 'sections'), { recursive: true });
copyFileSync(CANON, join(tmp, FILE));
try {
  execSync(
    `shopify theme push --store ${STORE} --theme ${t.id}${pw} --path "${tmp}" --only ${FILE} --nodelete${isLive ? ' --allow-live' : ''}`,
    { stdio: 'inherit', timeout: 300000 }
  );
} catch (e) {
  rmSync(tmp, { recursive: true, force: true });
  fail('[FAIL] Push falhou. Rode o preflight e confira a credencial.');
}
rmSync(tmp, { recursive: true, force: true });

console.log('');
console.log('[OK] Section instalada.');
console.log(`Preview: https://${STORE}?preview_theme_id=${t.id}`);
console.log('Proximo passo: editor de temas > Add section > "Trust Reviews" (ja vem com 3 reviews de exemplo).');
