#!/usr/bin/env node
// Preflight de minerar-criativos-fb.
//
// Esta pasta tem dois caminhos para ler a Biblioteca de Anuncios:
//
//   1. coletar-navegador.mjs  — pelo Chrome que voce ja tem. De graca, sem conta.
//   2. os demais scripts      — pelo Apify, que e servico pago e precisa de token.
//
// O caminho 1 e o padrao e e o que o material da BaseX ensina. O caminho 2 fica
// aqui para quem ja tem conta no Apify e quer volume.
//
// Antes, este arquivo importava dotenv e apify-client no topo. Numa maquina sem
// esses pacotes ele morria com um stack trace do Node, e a primeira coisa que a
// pessoa via era ERR_MODULE_NOT_FOUND, sem nenhuma explicacao.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ok = (m) => console.log(`  ok     ${m}`);
const falta = (m) => console.log(`  falta  ${m}`);
const nota = (m) => console.log(`         ${m}`);

async function temPacote(nome) {
  try { await import(nome); return true; } catch { return false; }
}

async function main() {
  console.log('\n  Minerar criativos do concorrente\n');

  // ── caminho gratuito ──────────────────────────────────────────────────────
  console.log('  Caminho pelo navegador (o padrao, de graca)\n');
  let livre = true;

  const chromes = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  if (chromes.some(existsSync)) ok('Google Chrome instalado');
  else { falta('Google Chrome'); nota('baixe em google.com/chrome'); livre = false; }

  if (existsSync(join(AQUI, 'coletar-navegador.mjs'))) ok('coletor pelo navegador presente');
  else { falta('coletar-navegador.mjs'); livre = false; }

  if (existsSync(join(AQUI, '..', '_shared', 'chrome.mjs'))) ok('cliente de navegador presente');
  else { falta('_shared/chrome.mjs'); livre = false; }

  // ── caminho pago ──────────────────────────────────────────────────────────
  console.log('\n  Caminho pelo Apify (opcional, pago)\n');

  const temDotenv = await temPacote('dotenv');
  const temApify = await temPacote('apify-client');
  if (temDotenv && temApify) ok('pacotes instalados');
  else { falta('pacotes do Apify'); nota('so precisa se voce for usar o Apify: npm install nesta pasta'); }

  let token = process.env.APIFY_API_TOKEN || '';
  if (!token && temDotenv) {
    try {
      const dotenv = (await import('dotenv')).default;
      dotenv.config({ path: join(AQUI, '..', '.env') });
      token = process.env.APIFY_API_TOKEN || '';
    } catch { /* segue sem */ }
  }
  if (token) ok('APIFY_API_TOKEN encontrado');
  else { falta('APIFY_API_TOKEN'); nota('so precisa se voce for usar o Apify'); }

  // ── veredito ──────────────────────────────────────────────────────────────
  console.log('');
  if (livre) {
    console.log('  Pode minerar. O comando e:\n');
    console.log('    node coletar-navegador.mjs --pagina <id da pagina> --pais DE\n');
    console.log('  O id da pagina esta no endereco da Biblioteca de Anuncios,');
    console.log('  logo depois de view_all_page_id=\n');
    process.exitCode = 0;
  } else {
    console.log('  Resolva o que esta marcado como falta acima e rode de novo.\n');
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(`[erro] ${e.message}`); process.exitCode = 1; });
