#!/usr/bin/env node
// Pre-voo do leitor do acervo de nichos. Nao baixa nada, so confere se daria.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criar } from '../_shared/preflight-base.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const p = criar('acervo-nichos');

p.node(18);
p.arquivo('Motor ler-acervo.mjs', join(AQUI, 'ler-acervo.mjs'));

// o acervo vem da web; sem rede o motor nao tem de onde ler
let rede = false;
try {
  const r = await fetch('https://basex-di3.pages.dev/nichos/', { method: 'HEAD', signal: AbortSignal.timeout(8000) });
  rede = r.ok;
} catch {}
p.check('Acervo respondendo', rede, rede ? '' : 'sem rede ou o acervo esta fora do ar');

p.fechar('Pode consultar. A primeira consulta baixa o acervo e guarda em cache por 24h.');
