#!/usr/bin/env node
/**
 * legenda.mjs — borra a legenda antiga queimada no vídeo e cobre com a legenda nova, numa passada só.
 *
 *   node _engine/voz-lipsync/legenda.mjs <video.mp4> --faixa 0.70-0.82 [--quando 0-12.5,14-20] [--legenda nova.srt]
 *
 * --faixa    onde está a legenda antiga, em fração da altura da tela (0 é o topo, 1 é a base), com folga para
 *            a letra inteira. Ache nos quadros de `lipsync.mjs quadros <video.mp4>`
 * --quando   os segundos em que a legenda antiga aparece (padrão: o vídeo inteiro). O borrão só roda neles
 * --legenda  a legenda nova, .srt ou .vtt: a `voz.mjs falar` grava <nome>.voz.srt e a `voz.mjs dublar` grava
 *            <nome>.dublado-<idioma>.vtt. Ela entra em cima da faixa borrada. Sem --legenda, só borra, e a
 *            legenda nova entra no CapCut
 *
 * Sai <nome>.legenda.mp4 e <nome>.legenda-confere.jpg, um quadro do meio da primeira fala, para conferir no
 * olho que a legenda nova apareceu e cobriu o borrão: o ffmpeg termina sem erro mesmo com a legenda fora da tela.
 */
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { arg, sair, ff, duracao, infoVideo, temFfmpeg, temFiltro, lerTrechos } from './lib.mjs';

const uso = readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*?/, '').replace(/^ \* ?/gm, '');
const m = String(arg('--faixa') || '').match(/^(\d*\.?\d+)\s*-\s*(\d*\.?\d+)$/);
const video = resolve(process.argv[2] || '');
if (!process.argv[2] || process.argv[2].startsWith('--') || !existsSync(video) || !m) sair(uso);
const [y1, y2] = [parseFloat(m[1]), parseFloat(m[2])];
if (!(y1 >= 0 && y2 <= 1 && y2 - y1 >= 0.02 && y2 - y1 <= 0.4)) sair('faixa inválida: use início-fim em fração da altura, como 0.70-0.82, entre 2% e 40% da tela');
const legenda = arg('--legenda') ? resolve(arg('--legenda')) : '';
const ext = extname(legenda).toLowerCase();
if (legenda && (!existsSync(legenda) || !['.srt', '.vtt'].includes(ext))) sair(`legenda não encontrada ou fora do formato (.srt ou .vtt): ${legenda}`);
if (!temFfmpeg()) sair('Falta o ffmpeg. Rode: node _engine/briefing-criativos/setup.mjs');
if (!temFiltro('delogo')) sair('O seu ffmpeg não tem o filtro que apaga a faixa (delogo). Instale o ffmpeg completo: no Mac, brew install ffmpeg-full; no Windows, winget install Gyan.FFmpeg.');
if (legenda && !temFiltro('subtitles')) {
  sair('O seu ffmpeg não escreve legenda (falta o libass). No Mac: brew install ffmpeg-full (se o brew reclamar do ffmpeg já instalado, rode brew uninstall ffmpeg antes). No Windows: winget install Gyan.FFmpeg. Ou rode sem --legenda, só com o borrão, e importe a legenda no CapCut.');
}

const total = duracao(video);
let W, H, janelas;
try {
  ({ largura: W, altura: H } = infoVideo(video));
  janelas = arg('--quando') ? lerTrechos(arg('--quando'), total) : [[0, total]];
} catch (e) { sair(e.message); }

// A faixa é apagada com delogo, que refaz a área puxando a cor das bordas dela: a letra some. O boxblur deixava a
// mancha clara da letra grossa à mostra ("80% OFF" borrado, medido em 11/11/2026). A caixa não pode encostar na
// borda do quadro, senão o delogo não tem de onde puxar a cor.
const y = Math.max(1, Math.round(H * y1)), h = Math.min(Math.round(H * (y2 - y1)), H - 2 - y);
const quando = janelas.map(([a, b]) => `between(t,${a},${b})`).join('+');
// regra da casa: o enable fica no próprio filtro de efeito, para ele só rodar nos segundos com legenda antiga
let fc = `[0:v]delogo=x=1:y=${y}:w=${W - 3}:h=${h}:enable='${quando}'`;
if (legenda) {
  // o libass mede o estilo numa tela de 288 de altura (384 de largura), não em pixel: valor em pixel joga a legenda
  // para fora da tela sem erro. Fonte de 4,5% da altura, branca, contorno fino, sem caixa; uma linha fica centrada
  // na faixa apagada (a base sobe 7 da linha de base), e a segunda linha cresce para cima
  const estilo = ['FontName=Arial', 'FontSize=13', 'Bold=1', 'PrimaryColour=&H00FFFFFF', 'OutlineColour=&H00000000', 'BorderStyle=1',
    'Outline=0.8', 'Shadow=0', 'Alignment=2', `MarginV=${Math.max(4, Math.round((1 - (y1 + y2) / 2) * 288 - 7))}`, 'MarginL=38', 'MarginR=38'].join(',');
  fc += `,subtitles=leg${ext}:force_style='${estilo}'`;
  if (y1 < 0.14 || y2 > 0.8) console.log('atenção: a faixa está fora da área segura do Reels e do Stories (14% de cima, 20% de baixo); a interface pode cobrir parte da legenda nova.');
}
fc += ',pad=ceil(iw/2)*2:ceil(ih/2)*2[v]';   // largura ou altura ímpar quebra o h264 em yuv420p: completa 1 pixel

const final = join(dirname(video), basename(video, extname(video)) + '.legenda.mp4');
const confere = join(dirname(video), basename(video, extname(video)) + '.legenda-confere.jpg');
const tmp = mkdtempSync(join(tmpdir(), 'legenda-'));
try {
  // a legenda vai para uma pasta temporária com nome simples: o filtro subtitles quebra com espaço, dois-pontos
  // e a barra do Windows no caminho, e assim não precisa escapar nada
  if (legenda) copyFileSync(legenda, join(tmp, `leg${ext}`));
  ff(['-i', video, '-filter_complex', fc, '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'copy', '-movflags', '+faststart', final], { cwd: tmp });
} catch (e) { sair(`Erro: ${e.message}`); }
finally { rmSync(tmp, { recursive: true, force: true }); }

// quadro de conferência: o meio da primeira fala da legenda nova, ou o meio do primeiro trecho borrado
const t = legenda && readFileSync(legenda, 'utf8').match(/(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{3})/);
const seg = (h, mi, s, ms) => (Number(h) || 0) * 3600 + Number(mi) * 60 + Number(s) + Number(ms) / 1000;
const quadro = t ? (seg(t[1], t[2], t[3], t[4]) + seg(t[5], t[6], t[7], t[8])) / 2 : (janelas[0][0] + janelas[0][1]) / 2;
ff(['-ss', Math.min(quadro, total - 0.1).toFixed(2), '-i', final, '-frames:v', '1', '-q:v', '3', confere]);
console.log(`faixa apagada: ${(y1 * 100).toFixed(0)}% a ${(y2 * 100).toFixed(0)}% da altura, em ${janelas.map(([a, b]) => `${a}-${b.toFixed(1)} s`).join(', ')}`);
console.log(`pronto: ${final}`);
console.log(`confira no olho: ${confere}\n  a legenda nova tem que estar em cima da faixa borrada. Borrão à mostra ou letra antiga aparecendo: ajuste --faixa ou --quando.`);
