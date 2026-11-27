#!/usr/bin/env node
// Pre-voo da montagem de loja a partir de uma referencia.
// Uso: node preflight.mjs [sualoja.myshopify.com]
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { criar } from '../_shared/preflight-base.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const destino = process.argv[2];
const p = criar('criar-tema-clonado');

p.arquivo('Fases do motor', join(AQUI, 'fases'));
p.arquivo('Snapshot em lote', join(AQUI, 'snapshot-batch.py'));
p.comando('python3 no PATH', 'python3', ['--version'], 'instale o Python 3');
p.comando('Shopify CLI no PATH', 'shopify', ['version'], 'instale com: npm i -g @shopify/cli');

if (destino) {
  let ok = false;
  try {
    execFileSync('shopify', ['store', 'execute', '--store', destino, '--query', 'query { shop { name } }'],
                 { stdio: 'pipe', timeout: 30000 });
    ok = true;
  } catch {}
  p.check('Loja de destino autorizada', ok, ok ? destino : `rode: shopify store auth --store ${destino}`);
} else {
  console.log('(passe a loja de destino para conferir o acesso: node preflight.mjs sualoja.myshopify.com)');
}

console.log('\nLembre: este motor CRIA produto, nao atualiza. Rodar duas vezes duplica o catalogo inteiro.');
p.fechar('Pode montar. Termine sempre pelo passo de personalizacao: clone e ponto de partida, nao entrega.');
