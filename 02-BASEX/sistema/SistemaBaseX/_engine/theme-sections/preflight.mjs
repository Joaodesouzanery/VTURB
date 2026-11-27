#!/usr/bin/env node
// Pre-voo das sections prontas de tema. Confere as pecas e o acesso a loja.
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criar } from '../_shared/preflight-base.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const loja = process.argv[2];
const p = criar('theme-sections');

const liquids = readdirSync(AQUI).filter(f => f.endsWith('.liquid'));
p.check('Sections disponiveis', liquids.length > 0, liquids.join(', '));
p.comando('Shopify CLI no PATH', 'shopify', ['version'], 'instale com: npm i -g @shopify/cli');

if (loja) {
  let ok = false;
  try {
    const { execFileSync } = await import('node:child_process');
    execFileSync('shopify', ['store', 'execute', '--store', loja, '--query', 'query { shop { name } }'],
                 { stdio: 'pipe', timeout: 30000 });
    ok = true;
  } catch {}
  p.check('Loja autorizada', ok, ok ? loja : `rode: shopify store auth --store ${loja}`);
} else {
  console.log('(passe o handle da loja para conferir o acesso: node preflight.mjs sualoja.myshopify.com)');
}

p.fechar('Pode aplicar. Nunca envie sem --only, e nunca toque em layout/theme.liquid.');
