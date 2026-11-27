#!/usr/bin/env node
/**
 * compor-texto.mjs — grava tipografia real por cima de uma cena gerada por IA.
 *
 *   node compor-texto.mjs --img cena.png --out banner.png \
 *     --titulo "BUY ONE GET ONE FREE" --sub "LINEN SHIRTS" \
 *     [--fonte "EB Garamond"] [--cor "#1e2a3a"] [--pos esquerda|centro|topo]
 *     [--largura 1672] [--altura 941]
 *
 * Existe porque texto escrito pelo modelo de imagem sai torto ou com palavra errada, e
 * banner de loja nao pode ter erro de ortografia. A cena vem da IA, a letra vem da fonte
 * de verdade, renderizada em Chrome headless.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const execFileP = promisify(execFile);
const argv = process.argv.slice(2);
const val = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };

const img = val('img'), out = val('out');
if (!img || !out) { console.error('Uso: node compor-texto.mjs --img cena.png --out banner.png --titulo "..." [--sub "..."]'); process.exit(1); }
const titulo = val('titulo') || '';
const sub = val('sub') || '';
const fonte = val('fonte') || 'EB Garamond';
const cor = val('cor') || '#1e2a3a';
const pos = val('pos') || 'esquerda';
const sobre = val('sobre') || '';                 // linha de olho (eyebrow) acima do titulo
const corSobre = val('cor-sobre') || '#c9a063';   // dourado por padrao

/* Dimensao nativa da imagem, PNG e JPEG. Sem isso um input .jpg caía num fallback
   1536x1024 (deitado) e gravava o banner no tamanho errado, calado — bug real em producao. */
function dimensao(p) {
  const b = readFileSync(p);
  // PNG: largura/altura nos 4 bytes em 16 e 20 do IHDR.
  if (b.slice(1, 4).toString() === 'PNG') return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) };
  // JPEG: procurar o marcador SOF (0xFFC0..0xFFCF, exceto C4/C8/CC) e ler altura+largura.
  if (b[0] === 0xFF && b[1] === 0xD8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        return { altura: b.readUInt16BE(i + 5), largura: b.readUInt16BE(i + 7) };
      }
      i += 2 + b.readUInt16BE(i + 2); // pular pro proximo segmento pelo length
    }
  }
  return null;
}
const dim = dimensao(img) || { largura: 1536, altura: 1024 };
const L = Number(val('largura')) || dim.largura;
const A = Number(val('altura')) || dim.altura;

/* A escala do texto acompanha a menor dimensao. --escala multiplica (ex.: mobile pede letra maior). */
const escala = Number(val('escala')) || 1;
const ehLado = pos.includes('esquerda');
const base = Math.min(L, A);
const tamTitulo = Math.round(base * (ehLado ? 0.086 : 0.075) * escala);
const tamSub = Math.round(tamTitulo * 0.38);
const tamSobre = Math.round(tamSub * 0.8);

/* flex-direction column: justify-content = eixo VERTICAL (topo/centro/baixo), align-items = horizontal. */
const A_MAP = {
  'esquerda':       'justify-content:center; align-items:flex-start; padding-left:7%; text-align:left;',
  'topo':           'justify-content:flex-start; align-items:center; padding-top:8%; text-align:center;',
  'topo-esquerda':  'justify-content:flex-start; align-items:flex-start; padding-top:6%; padding-left:7%; text-align:left;',
  'baixo':          'justify-content:flex-end; align-items:center; padding-bottom:9%; text-align:center;',
  'baixo-esquerda': 'justify-content:flex-end; align-items:flex-start; padding-bottom:8%; padding-left:7%; text-align:left;',
  'centro':         'justify-content:center; align-items:center; text-align:center;',
};
const alinhamento = A_MAP[pos] || A_MAP['centro'];

/* O texto nunca ocupa a largura toda: no banner deitado ele divide o quadro com o modelo.
   --largura-texto força a zona segura (ex.: mobile onde o tema dá overflow/zoom à direita
   e corta a borda — confinar o bloco ao centro evita texto cortado). */
const larguraTexto = val('largura-texto') || (ehLado ? '52%' : '86%');

/* --scrim: gradiente escuro atras do texto pra garantir legibilidade quando o fundo nao e liso
   (ex.: texto claro no rodape entrando na foto). A direcao segue a posicao do texto. */
const scrim = argv.includes('--scrim');
const scrimRGB = val('scrim-cor') || '12,18,36';
const scrimGrad = pos.startsWith('baixo')
  ? `linear-gradient(to top, rgba(${scrimRGB},0.96), rgba(${scrimRGB},0.66) 26%, rgba(${scrimRGB},0) 52%)`
  : pos.startsWith('topo')
    ? `linear-gradient(to bottom, rgba(${scrimRGB},0.92), rgba(${scrimRGB},0) 45%)`
    : pos === 'esquerda'
      ? `linear-gradient(to right, rgba(${scrimRGB},0.85), rgba(${scrimRGB},0) 55%)`
      : `radial-gradient(ellipse at center, rgba(${scrimRGB},0.6), rgba(${scrimRGB},0) 70%)`;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500&family=Playfair+Display:wght@400;500&display=block" rel="stylesheet">
<style>
  html,body{margin:0;padding:0;}
  body{width:${L}px;height:${A}px;position:relative;overflow:hidden;}
  .cena{position:absolute;inset:0;background-image:url("${path.resolve(img).replace(/\\/g, '/').replace(/^/, 'file:///')}");background-size:cover;background-position:center;}
  .scrim{position:absolute;inset:0;display:${scrim ? 'block' : 'none'};background:${scrimGrad};}
  .texto{position:absolute;inset:0;display:flex;flex-direction:column;${alinhamento}}
  .bloco{max-width:${larguraTexto};}
  .t{font-family:'${fonte}',Garamond,serif;font-weight:400;font-size:${tamTitulo}px;line-height:1.08;color:${cor};margin:0;}
  .s{font-family:'${fonte}',Garamond,serif;font-weight:400;font-size:${tamSub}px;letter-spacing:0.3em;text-indent:0.3em;color:${cor};margin:${Math.round(tamTitulo * 0.28)}px 0 0;}
  .sobre{font-family:'${fonte}',Garamond,serif;font-weight:500;font-size:${tamSobre}px;letter-spacing:0.4em;text-indent:0.4em;text-transform:uppercase;color:${corSobre};margin:0 0 ${Math.round(tamSobre*0.7)}px;}
  .rule{display:${sobre ? 'block' : 'none'};width:${Math.round(tamTitulo*0.7)}px;height:1px;background:${corSobre};margin:0 0 ${Math.round(tamSobre*1.1)}px;${ehLado ? '' : 'margin-left:auto;margin-right:auto;'}}
</style></head><body>
  <div class="cena"></div>
  <div class="scrim"></div>
  <div class="texto"><div class="bloco">${sobre ? `<p class="sobre">${sobre}</p><span class="rule"></span>` : ''}<p class="t">${titulo}</p>${sub ? `<p class="s">${sub}</p>` : ''}</div></div>
</body></html>`;

const tmp = path.join(os.tmpdir(), `compor-${Date.now()}.html`);
await fs.writeFile(tmp, html);

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => existsSync(p));
if (!chrome) { console.error('Chrome nao encontrado'); process.exit(1); }

await execFileP(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--virtual-time-budget=15000', '--force-device-scale-factor=1',
  `--window-size=${L},${A}`, `--screenshot=${path.resolve(out)}`, tmp], { maxBuffer: 1e8 });
await fs.rm(tmp).catch(() => {});
console.log(`OK ${path.basename(out)} (${L}x${A})`);
