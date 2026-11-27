#!/usr/bin/env node
// Pre-flight da skill 58. Setup Avaliação Manual (Section Trust Reviews)
// Valida o ambiente ANTES de qualquer push. Exit 0 = ok, 1 = bloqueado.
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const VAULT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CANON = join(VAULT, '06. Anexos', 'trust-reviews.liquid');

const checks = [];

// 1. Node 20+
checks.push({ nome: 'Node 20+', ok: parseInt(process.versions.node.split('.')[0], 10) >= 20, extra: 'v' + process.versions.node });

// 2. Shopify CLI no PATH
let cliOk = false, cliVer = '';
try { cliVer = execSync('shopify version', { encoding: 'utf8', timeout: 30000 }).trim().split('\n').pop(); cliOk = true; } catch (e) {}
checks.push({ nome: 'Shopify CLI no PATH', ok: cliOk, extra: cliVer });

// 3. Arquivo canonico existe
const canonOk = existsSync(CANON);
checks.push({ nome: 'Arquivo canonico existe', ok: canonOk, extra: CANON });

// 4. {% schema %} do canonico parseia
let schemaOk = false, settingsCount = 0;
if (canonOk) {
  try {
    const src = readFileSync(CANON, 'utf8');
    const m = src.match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/);
    const sc = JSON.parse(m[1]);
    settingsCount = sc.settings.length;
    schemaOk = settingsCount >= 40 && Array.isArray(sc.blocks) && sc.blocks.length >= 1;
  } catch (e) {}
}
checks.push({ nome: 'Schema da section valido', ok: schemaOk, extra: settingsCount + ' settings' });



console.log('\n=== Pre-flight: setup-avaliacao-manual ===\n');
let bloqueios = 0;
for (const c of checks) {
  console.log(`${c.ok ? '[OK]  ' : '[FAIL]'} ${c.nome}${c.extra ? '  (' + c.extra + ')' : ''}`);
  if (!c.ok) bloqueios++;
}
console.log('');
process.exit(bloqueios === 0 ? 0 : 1);
