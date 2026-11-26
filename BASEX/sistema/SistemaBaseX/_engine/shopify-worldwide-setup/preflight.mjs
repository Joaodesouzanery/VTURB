#!/usr/bin/env node
/**
 * Pre-flight da skill 04. Setup Loja Worldwide Shopify
 *
 * Verifica ambiente antes de rodar worldwide_setup.py.
 * Exit 0 = go. Exit 1 = falta algo, mostra o que corrigir.
 *
 * Uso:
 *   node preflight.mjs --store {handle}.myshopify.com
 *   node preflight.mjs --store minha-loja --phase 4a
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
};

const store = getArg('--store');
const phase = getArg('--phase') || 'all';

const checks = [];
let failed = false;

function check(label, ok, hint = '') {
  const tag = ok ? '[OK]  ' : '[FAIL]';
  checks.push({ label, ok, hint, tag });
  if (!ok) failed = true;
}

function pythonVersion() {
  try {
    const out = execSync('python3 --version', { encoding: 'utf8' });
    const m = out.match(/Python (\d+)\.(\d+)/);
    return m ? [parseInt(m[1]), parseInt(m[2])] : null;
  } catch {
    return null;
  }
}

function shopifyCliVersion() {
  try {
    const out = execSync('shopify version', { encoding: 'utf8', stdio: 'pipe' });
    const m = out.match(/(\d+\.\d+\.\d+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// O config do Shopify CLI muda de lugar por sistema operacional.
function shopifyCliConfigCandidates() {
  const home = homedir();
  const appdata = process.env.APPDATA || join(home, 'AppData', 'Roaming');
  const xdg = process.env.XDG_CONFIG_HOME || join(home, '.config');
  return [
    join(home, 'Library', 'Preferences', 'shopify-cli-store-nodejs', 'config.json'), // macOS
    join(appdata, 'shopify-cli-store-nodejs', 'config.json'),                        // Windows
    join(xdg, 'shopify-cli-store-nodejs', 'config.json'),                            // Linux
  ];
}

console.log('=== Pre-flight: shopify-worldwide-setup v3.0 ===\n');

const py = pythonVersion();
check(
  py ? `Python ${py[0]}.${py[1]}` : 'Python 3',
  py && py[0] === 3 && py[1] >= 8,
  'Instale Python 3.8+ (python.org ou brew install python@3.11). O engine usa só a biblioteca padrão.'
);

const cli = shopifyCliVersion();
check(
  cli ? `Shopify CLI ${cli}` : 'Shopify CLI',
  !!cli,
  'npm install -g @shopify/cli @shopify/theme'
);

const enginePath = dirname(fileURLToPath(import.meta.url));
check(
  'worldwide_setup.py existe',
  existsSync(join(enginePath, 'worldwide_setup.py')),
  'Engine ausente — o arquivo precisa estar em _engine/shopify-worldwide-setup/'
);

check(
  'translate/ submodule (tradução, opcional)',
  existsSync(join(enginePath, 'translate', 'preflight.mjs')),
  'Submodule translate ausente — o arquivo precisa estar em _engine/shopify-worldwide-setup/translate/'
);

if (store) {
  const authIndex = shopifyCliConfigCandidates().find(p => existsSync(p));
  let authed = false;
  if (authIndex) {
    try {
      const cfg = JSON.parse(readFileSync(authIndex, 'utf8'));
      const cliClientId = '7e9cb568cfd431c538f36d1ad3f2b4f6';
      const handle = store.replace('.myshopify.com', '');
      authed = Object.keys(cfg).some(k => k.includes(cliClientId) && k.includes(handle));
    } catch {}
  }
  check(
    `Shopify CLI autenticado em ${store}`,
    authed,
    `shopify store auth --store ${store} --scopes "read_themes,write_themes,read_products,write_products,read_content,write_content,read_files,write_files,read_publications,write_publications,read_online_store_navigation,write_online_store_navigation,read_online_store_pages,write_online_store_pages,read_locales,write_locales,read_markets,write_markets,read_shipping,write_shipping,read_translations,write_translations"`
  );
} else {
  check('--store informado', false, 'Passe --store {handle} pra checar a autenticação na loja');
}

console.log('');
for (const c of checks) {
  console.log(`${c.tag}  ${c.label}${c.hint && !c.ok ? '\n         → ' + c.hint : ''}`);
}

console.log('');
if (failed) {
  console.log('Pre-flight FALHOU. Corrija os itens acima antes de rodar worldwide_setup.py.');
  process.exit(1);
} else {
  console.log(`Pre-flight OK. Pronto pra rodar: python3 worldwide_setup.py --store ${store || '{handle}.myshopify.com'} --brand-name "Marca" --support-email suporte@marca.com --phase ${phase}`);
  process.exit(0);
}
