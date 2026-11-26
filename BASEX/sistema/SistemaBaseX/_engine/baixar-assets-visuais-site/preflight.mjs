#!/usr/bin/env node
/**
 * Preflight da skill baixar-assets-visuais-site.
 * Valida Node 20+, playwright instalado, URL responde, destino gravavel.
 * Sai com codigo != 0 se algo critico estiver faltando.
 */

import { existsSync, mkdirSync, accessSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function log(level, msg) {
  const tag = { ok: '[OK]  ', warn: '[WARN]', err: '[FAIL]', info: '[INFO]' }[level] || '[----]';
  console.log(`${tag} ${msg}`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function deriveSlug(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '').split('.')[0];
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  log('info', 'Preflight: baixar-assets-visuais-site');

  let bloqueios = 0;

  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  if (nodeMajor >= 20) {
    log('ok', `Node ${process.versions.node}`);
  } else {
    log('err', `Node ${process.versions.node} - precisa de 20+`);
    bloqueios++;
  }

  const pkgPath = join(__dirname, 'package.json');
  if (existsSync(pkgPath)) {
    log('ok', 'package.json encontrado');
  } else {
    log('err', 'package.json ausente');
    bloqueios++;
  }

  const nmPath = join(__dirname, 'node_modules', 'playwright');
  if (existsSync(nmPath)) {
    log('ok', 'playwright instalado (node_modules/playwright)');
  } else {
    log('err', 'playwright nao instalado. Rodar: npm install na pasta do engine');
    bloqueios++;
  }

  let chromium = null;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    log('ok', 'Chromium executavel disponivel');
  } catch (e) {
    log('err', `Chromium nao disponivel: ${e.message.split('\n')[0]}`);
    console.log('  Como resolver: npx playwright install chromium');
    bloqueios++;
  }

  const url = args.url || args.URL || null;
  if (!url) {
    log('warn', '--url nao fornecido. Pulando checks de URL e destino.');
  } else {
    let parsed;
    try {
      parsed = new URL(url);
      log('ok', `URL parseada: ${parsed.href}`);
    } catch {
      log('err', `URL invalida: ${url}`);
      bloqueios++;
    }

    if (parsed) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(parsed.href, {
          method: 'HEAD',
          signal: ctrl.signal,
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; baixar-assets-bot/1.0)' },
        });
        clearTimeout(t);
        if (res.ok || (res.status >= 300 && res.status < 400)) {
          log('ok', `URL responde ${res.status}`);
        } else {
          log('warn', `URL responde ${res.status} (download pode falhar)`);
        }
      } catch (e) {
        log('warn', `HEAD falhou: ${e.message}. Vai tentar GET na execucao real.`);
      }
    }

    const slug = deriveSlug(url);
    const destino = args.destino || (slug ? join(homedir(), 'Desktop', slug) : null);
    if (!destino) {
      log('err', 'Nao consegui derivar destino. Passe --destino explicito.');
      bloqueios++;
    } else {
      try {
        if (!existsSync(destino)) {
          mkdirSync(destino, { recursive: true });
          log('ok', `Destino criavel: ${destino}`);
        } else {
          accessSync(destino, constants.W_OK);
          log('ok', `Destino existe e e gravavel: ${destino}`);
        }
      } catch (e) {
        log('err', `Destino nao gravavel: ${destino} (${e.message})`);
        bloqueios++;
      }
    }
  }

  console.log('');
  if (bloqueios === 0) {
    log('info', 'Pre-flight OK. Pode rodar download.mjs');
    process.exit(0);
  } else {
    log('err', `Pre-flight bloqueado por ${bloqueios} item(ns) acima.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[FAIL] Erro inesperado:', e.message);
  process.exit(99);
});
