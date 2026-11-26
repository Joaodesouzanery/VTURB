#!/usr/bin/env node
// Pre-voo do gerador de marca vetorial (logo, simbolo, monograma, favicon).
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criar, CHROME } from '../_shared/preflight-base.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const p = criar('marca-vetorial');

// o motor dirige o Chrome por CDP, e o WebSocket global so e estavel no Node 22
p.node(22);
p.arquivo('Motor gerar.mjs', join(AQUI, 'gerar.mjs'));
p.arquivo('Biblioteca do Chrome', join(AQUI, '..', '_shared', 'chrome.mjs'));
p.check('Chrome instalado', CHROME.some(existsSync),
        CHROME.find(existsSync) || 'instale o Google Chrome');

let fontes = false;
try {
  const r = await fetch('https://fonts.googleapis.com/', { method: 'HEAD', signal: AbortSignal.timeout(8000) });
  fontes = r.status < 500;
} catch {}
p.check('Google Fonts alcancavel', fontes, fontes ? '' : 'sem rede: a tipografia cai no fallback e o desenho muda');

p.fechar('Pode gerar. Comece por "conceitos" para escolher a direcao antes de gerar os 20 arquivos.');
