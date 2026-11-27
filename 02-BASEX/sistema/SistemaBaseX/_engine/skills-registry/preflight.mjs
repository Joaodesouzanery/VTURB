#!/usr/bin/env node
// Pre-voo do gerador do indice de skills que o basex-master consulta.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, existsSync } from 'node:fs';
import { criar } from '../_shared/preflight-base.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = process.env.BASEX_ARQUIVO || join(AQUI, '..', '..');
const p = criar('skills-registry');

p.node(18);
p.arquivo('Gerador build.mjs', join(AQUI, 'build.mjs'));
p.check('Raiz do SistemaBaseX encontrada', existsSync(join(RAIZ, '03. Skills')),
        existsSync(join(RAIZ, '03. Skills')) ? RAIZ : 'defina BASEX_ARQUIVO com o caminho da pasta');

if (existsSync(join(RAIZ, '03. Skills'))) {
  const n = readdirSync(join(RAIZ, '03. Skills')).filter(f => f.endsWith('.md')).length;
  p.check('Skills para indexar', n > 0, n + ' skill(s)');
  p.check('Pasta _brain existe', existsSync(join(RAIZ, '_brain')), join(RAIZ, '_brain'));
}

p.fechar('Pode gerar. Use --dry-run para ver o indice sem gravar.');
