#!/usr/bin/env node
/**
 * Aplica a marca de uma loja sobre um criativo NEUTRO do banco.
 * O banco guarda matrizes sem marca; esta operacao gera o derivado, sem tocar na matriz.
 *
 * uso: node aplicar-marca.mjs --criativo m.jpg --marca "Sua Marca" [--logo logo.png]
 *                             [--out saida.jpg] [--onde topo|rodape] [--model flash|pro]
 * lote: --criativo pasta/ gera um derivado por arquivo, com sufixo --marca
 */
import { gerar } from './gen-image-api.mjs';
import { readdirSync, statSync } from 'node:fs';
import { join, extname, basename, dirname } from 'node:path';

const a = process.argv;
const val = (f, d=null) => { const i=a.indexOf(f); return i>-1 ? a[i+1] : d; };
const criativo = val('--criativo'), marca = val('--marca');
const logo = val('--logo'), onde = val('--onde','topo'), model = val('--model','pro');
if (!criativo || !marca) { console.error('uso: --criativo <arquivo|pasta> --marca "Nome" [--logo logo.png]'); process.exit(1); }

const slug = marca.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-');
const posicao = onde === 'rodape' ? 'at the bottom of the layout' : 'at the top of the layout';

function prompt(comLogo) {
  return `Add the brand to this advertising creative and change NOTHING else. ` +
    `Keep the exact same product, photography, background, colours, fonts, text wording, prices and layout. ` +
    (comLogo
      ? `Place the brand mark from the SECOND image ${posicao}, in the piece's own style, at a natural size - ` +
        `as if it had been designed there from the start.`
      : `Write the brand name "${marca}" ${posicao} as a clean wordmark, in a typeface that matches the piece.`) +
    ` Do not add any other logo, symbol, flag or watermark. Do not cover the product or any text. ` +
    `Photorealistic, high resolution, same aspect ratio as the input.`;
}

const arquivos = statSync(criativo).isDirectory()
  ? readdirSync(criativo).filter(f=>/\.(jpg|jpeg|png)$/i.test(f)).map(f=>join(criativo,f))
  : [criativo];

let ok=0;
for (const f of arquivos) {
  const saida = arquivos.length === 1 && val('--out')
    ? val('--out')
    : join(dirname(f), `${basename(f, extname(f))}--${slug}.jpg`);
  try {
    const refs = logo ? [f, logo] : [f];
    const r = await gerar({ prompt: prompt(!!logo), refs, out: saida, model, size: '2K' });
    console.log('OK', basename(r.out), Math.round(r.bytes/1024)+'KB');
    ok++;
  } catch(e) { console.log('FALHA', basename(f), String(e.message).slice(0,90)); }
}
console.log(`--- ${ok}/${arquivos.length} derivados de "${marca}" (matrizes intactas)`);
