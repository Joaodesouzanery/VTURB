#!/usr/bin/env node
// Pre-flight da skill 75. Analisar Operação. Valida ambiente ANTES de executar.
import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(__dirname, '..', '..');

// Localiza '02. Conhecimento/Operação & Performance' aceitando prefixo numérico
// na pasta (ex.: '16. Operação & Performance') e nomes normalizados em NFD.
const ALVO_CONHECIMENTO = 'Operação & Performance'.normalize('NFC');
const dirConhecimento = () => {
  const base = resolve(RAIZ, '02. Conhecimento');
  if (!existsSync(base)) return null;
  const hit = readdirSync(base).find((d) => {
    const n = d.normalize('NFC');
    return n === ALVO_CONHECIMENTO || n.replace(/^\d+\.\s*/, '') === ALVO_CONHECIMENTO;
  });
  return hit ? resolve(base, hit) : null;
};

const checks = [];
const check = (nome, ok, dica = '') => checks.push({ nome, ok, dica });

check('Node 20+', parseInt(process.versions.node.split('.')[0], 10) >= 20, 'Atualize o Node para 20+');

let xlsxOk = false;
try { await import('xlsx'); xlsxOk = true; } catch { /* ausente */ }
check('Lib xlsx instalada', xlsxOk, 'Rode "npm install" em _engine/analisar-operacao');

check('Pasta de catálogo/placar global',
  dirConhecimento() !== null,
  'Pasta "02. Conhecimento/Operação & Performance" ausente');

check('breakpoints.json', existsSync(resolve(__dirname, 'breakpoints.json')), 'Arquivo de limiares ausente');
check('header-map.json', existsSync(resolve(__dirname, 'header-map.json')), 'Mapa de cabeçalhos ausente');

let shopify = false;
try { execSync('shopify version', { stdio: 'ignore' }); shopify = true; } catch { /* opcional */ }

console.log('\n=== Pre-flight: Analisar Operação ===\n');
let bloqueios = 0;
for (const c of checks) {
  console.log(`${c.ok ? '[OK]  ' : '[FAIL]'} ${c.nome}${!c.ok && c.dica ? '  -> ' + c.dica : ''}`);
  if (!c.ok) bloqueios++;
}
console.log(`\n[INFO] Shopify CLI: ${shopify ? 'disponível' : 'ausente (integração loja é opcional)'}`);
console.log('[INFO] Integração Meta Ads é opcional: a análise roda inteira a partir do .xlsx exportado.');
console.log(`\n${bloqueios === 0 ? 'PRONTO' : bloqueios + ' bloqueio(s) - resolva antes de executar'}\n`);
process.exit(bloqueios === 0 ? 0 : 1);
