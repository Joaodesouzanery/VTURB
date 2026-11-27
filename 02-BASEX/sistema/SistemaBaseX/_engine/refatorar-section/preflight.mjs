#!/usr/bin/env node
// Pre-voo da refatoracao de section (locale + migrador v1 -> v2).
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criar } from '../_shared/preflight-base.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const alvo = process.argv[2];
const p = criar('refatorar-section');

p.node(20);
p.arquivo('Gerador de locale', join(AQUI, 'gen-locale.mjs'));
p.arquivo('Migrador v1 para v2', join(AQUI, 'migrator-v1-to-v2.mjs'));
p.arquivo('Checador de mobile', join(AQUI, 'checar-mobile.mjs'));

if (alvo) p.arquivo('Section informada', alvo);
else console.log('(passe o .liquid para conferir: node preflight.mjs caminho/da/section.liquid)');

p.fechar('Pode refatorar. Gere o locale antes de migrar, senao o schema fica sem tradução.');
