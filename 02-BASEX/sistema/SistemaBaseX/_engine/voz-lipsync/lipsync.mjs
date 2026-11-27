#!/usr/bin/env node
/**
 * lipsync.mjs — boca sincronizada com a voz nova, no sync.so, com a chave do aluno (_engine/.env: SYNC_API_KEY).
 *
 *   node _engine/voz-lipsync/lipsync.mjs quadros <video.mp4> [--cada 0.5]
 *       tira um quadro a cada meio segundo, para achar os trechos em que o rosto FALA
 *   node _engine/voz-lipsync/lipsync.mjs <video.mp4> --audio <voz.mp3> --trechos 0-4.8,33.1-41.1 --loja <sua-loja>.myshopify.com
 *       [--modelo sync-3|lipsync-2] [--simular] [--manter-arquivos]
 *       manda só os trechos com rosto falando, um por vez, e remonta o vídeo inteiro com a voz nova
 *
 * Só os trechos com rosto falando, por dois motivos: o sync.so cobra por quadro enviado e devolve o trecho
 * recodificado. Rosto calado com voz por cima fica de fora, porque o modelo inventa a boca mexendo.
 * Modelos: sync-3 deixa dentes e pele nítidos (use em peça que vai ao ar); lipsync-2 custa 2,7 vezes menos.
 * O sync.so só aceita vídeo e áudio por link público: cada trecho sobe para os Files da sua loja pelo
 * Shopify CLI e é apagado no fim (--manter-arquivos deixa lá). Um trabalho por vez: o plano aceita um só.
 * Marca d'água: o plano de US$ 5 (hobbyist) grava "sync.so" no canto superior direito de cada trecho. O motor
 * compara o trecho enviado com o que voltou, acha a caixa exata da marca e apaga com delogo na remontagem,
 * só dentro do trecho. Sai também <nome>.lipsync-confere.jpg, um quadro do primeiro trecho, para conferir o canto.
 * --simular não sobe nada nem chama o sync.so: o retorno é o próprio trecho com uma marca de teste no canto,
 * e a medição, o borrão e a remontagem rodam como no real.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { basename, dirname, join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { arg, tem, sair, chave, ff, duracao, infoVideo, temFfmpeg, temFiltro, lerTrechos, pecas, custoLipsync, subirArquivo, apagarArquivos, UA, DOLAR, planoSync, PLANO_COM_MARCA, caixaMarca, caixaPadraoSync } from './lib.mjs';

const API = 'https://api.sync.so/v2/generate';
const SIMULAR = tem('--simular');
const espera = ms => new Promise(r => setTimeout(r, ms));

function quadros() {
  const video = resolve(process.argv[3] || '');
  if (!existsSync(video)) sair('Uso: lipsync.mjs quadros <video.mp4> [--cada 0.5]');
  const cada = Number(arg('--cada', '0.5'));
  const pasta = join(dirname(video), basename(video, extname(video)) + '.quadros');
  mkdirSync(pasta, { recursive: true });
  ff(['-i', video, '-vf', `fps=1/${cada},scale=480:-2`, join(pasta, 'q%05d.jpg')]);
  const arqs = readdirSync(pasta).filter(f => /^q\d{5}\.jpg$/.test(f)).sort();
  arqs.forEach((f, i) => renameSync(join(pasta, f), join(pasta, `t${(i * cada).toFixed(1).padStart(6, '0')}s.jpg`)));
  console.log(`${arqs.length} quadros em ${pasta}\nO nome de cada um é o segundo do vídeo. Marque os trechos em que a boca FALA (rosto calado fica de fora).`);
}

async function sync(caminho, opcoes = {}) {
  const k = chave('SYNC_API_KEY');
  if (!k) sair('Falta SYNC_API_KEY em _engine/.env (sync.so → Settings → API Keys).');
  for (let tentativa = 1; ; tentativa++) {
    const r = await fetch(API + caminho, { ...opcoes, headers: { 'x-api-key': k, 'User-Agent': UA, 'Content-Type': 'application/json', ...(opcoes.headers || {}) } });
    if (r.status === 429 && tentativa <= 5) { console.log('  o sync.so ainda está com outro trabalho seu; esperando 15 s'); await espera(15000); continue; }
    if (!r.ok) throw new Error(`sync.so respondeu ${r.status}: ${(await r.text()).slice(0, 400)}`);
    return r.json();
  }
}

async function lipsync() {
  const video = resolve(process.argv[2] || '');
  const audio = arg('--audio') ? resolve(arg('--audio')) : '';
  const loja = arg('--loja');
  const modelo = arg('--modelo', 'sync-3');
  if (!existsSync(video) || !existsSync(audio) || !arg('--trechos') || (!loja && !SIMULAR)) {
    sair('Uso: lipsync.mjs <video.mp4> --audio <voz.mp3> --trechos 0-4.8,33.1-41.1 --loja <sua-loja>.myshopify.com [--modelo sync-3|lipsync-2] [--simular]');
  }
  if (!temFfmpeg()) sair('Falta o ffmpeg. Rode: node _engine/briefing-criativos/setup.mjs');
  // sem o delogo, a marca d'água só seria notada na remontagem, com o sync.so já pago
  if (!temFiltro('delogo')) sair('O seu ffmpeg não tem o delogo, que apaga a marca d\'água do sync.so. Instale o ffmpeg completo antes de gastar: no Mac, brew install ffmpeg-full; no Windows, winget install Gyan.FFmpeg.');
  const total = duracao(video);
  const { largura: W, altura: H, fps } = infoVideo(video);
  const trechos = lerTrechos(arg('--trechos'), total);
  const custo = custoLipsync(trechos, fps, modelo);
  console.log(`vídeo: ${basename(video)} · ${total.toFixed(1)} s · ${W}x${H} · ${fps.toFixed(2)} fps`);
  console.log(`trechos com rosto falando: ${trechos.map(([a, b]) => `${a}-${b}`).join(', ')} (${custo.quadros} quadros)`);
  console.log(`custo estimado no ${modelo}: US$ ${custo.usd.toFixed(2)}, cerca de R$ ${custo.brl.toFixed(2)} (dólar a R$ ${DOLAR.toFixed(2)})`);
  if (Math.min(W, H) < 720) console.log('atenção: abaixo de 720p o rosto pequeno volta com a boca borrada. Baixe o vídeo em HD se der.');
  const plano = await planoSync();
  if (PLANO_COM_MARCA.has(plano)) console.log(`plano do sync.so: ${plano}. Ele grava a marca "sync.so" no canto de cada trecho; o motor mede a marca e apaga na remontagem.`);

  const tmp = mkdtempSync(join(tmpdir(), 'lipsync-'));
  const ids = [];
  try {
    const retornos = [];
    for (const [i, [a, b]] of trechos.entries()) {
      const segV = join(tmp, `trecho${i + 1}.mp4`), segA = join(tmp, `trecho${i + 1}.wav`);
      ff(['-ss', String(a), '-t', String(b - a), '-i', video, '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-pix_fmt', 'yuv420p', segV]);
      ff(['-ss', String(a), '-t', String(b - a), '-i', audio, '-vn', '-ac', '1', '-ar', '44100', segA]);
      console.log(`\ntrecho ${i + 1}: ${a}-${b} s`);
      if (SIMULAR) {
        // o retorno simulado leva uma marca de teste no canto, no lugar da do hobbyist, para a medição e o borrão rodarem
        const ret = join(tmp, `retorno${i + 1}.mp4`);
        ff(['-i', segV, '-vf', 'drawbox=x=iw*0.79:y=ih*0.014:w=iw*0.18:h=ih*0.026:color=white@0.9:t=fill', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-pix_fmt', 'yuv420p', ret]);
        console.log('  SIMULAÇÃO: nada sobe e o sync.so não é chamado; o retorno é o próprio trecho com uma marca de teste no canto');
        retornos.push(ret); continue;
      }
      const v = await subirArquivo(loja, segV, 'video/mp4'); ids.push(v.id);
      const s = await subirArquivo(loja, segA, 'audio/wav'); ids.push(s.id);
      console.log('  trecho e voz nos Files da loja');
      const job = await sync('', { method: 'POST', body: JSON.stringify({ model: modelo, input: [{ type: 'video', url: v.url }, { type: 'audio', url: s.url }] }) });
      const inicio = Date.now();
      let j = job;
      while (!['COMPLETED', 'FAILED', 'REJECTED', 'CANCELED', 'TIMED_OUT'].includes(j.status)) {
        await espera(12000);
        j = await sync(`/${job.id}`);
        console.log(`  ${j.status}... ${Math.round((Date.now() - inicio) / 1000)} s`);
        if (Date.now() - inicio > 20 * 60 * 1000) throw new Error('o sync.so passou de 20 minutos neste trecho');
      }
      if (j.status !== 'COMPLETED' || !j.outputUrl) throw new Error(`o sync.so não concluiu o trecho ${i + 1}: ${j.status} ${JSON.stringify(j.error || '').slice(0, 200)}`);
      // o link de saída já leva o token; mandar a chave junto quebra o download
      const r = await fetch(j.outputUrl, { redirect: 'follow' });
      if (!r.ok) throw new Error(`download do trecho ${i + 1} falhou: HTTP ${r.status}`);
      const ret = join(tmp, `retorno${i + 1}.mp4`);
      writeFileSync(ret, Buffer.from(await r.arrayBuffer()));
      retornos.push(ret);
    }

    // marca d'água: medida trecho a trecho, pela diferença entre o que foi e o que voltou
    const marcas = trechos.map(([a, b], i) => {
      let c = caixaMarca(join(tmp, `trecho${i + 1}.mp4`), retornos[i], W, H);
      if (!c && PLANO_COM_MARCA.has(plano)) { c = caixaPadraoSync(W, H); console.log(`trecho ${i + 1}: não consegui medir a marca d'água; apagando o canto padrão. Confira esse canto no vídeo.`); }
      if (c) console.log(`trecho ${i + 1}: marca d'água em x ${c.x}, y ${c.y} (${c.w}x${c.h}), apagada na remontagem`);
      return c && { ...c, a, b };
    }).filter(Boolean);

    // remonta numa passada só, recodificando: juntar pedaços com -c copy gera arquivo que quebra no passo seguinte
    const linha = pecas(trechos, total);
    const originais = linha.filter(p => p.tipo === 'original');
    const fc = [];
    if (originais.length) fc.push(`[0:v]split=${originais.length}${originais.map((_, k) => `[o${k}]`).join('')}`);
    let k = 0;
    linha.forEach((p, n) => {
      const norm = `fps=${fps},scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
      if (p.tipo === 'original') fc.push(`[o${k++}]trim=start=${p.ini}:end=${p.fim},setpts=PTS-STARTPTS,${norm}[p${n}]`);
      else fc.push(`[${2 + p.n}:v]${norm},tpad=stop_mode=clone:stop_duration=1,trim=duration=${(p.fim - p.ini).toFixed(3)},setpts=PTS-STARTPTS[p${n}]`);
    });
    fc.push(`${linha.map((_, n) => `[p${n}]`).join('')}concat=n=${linha.length}:v=1:a=0${marcas.length ? '[vc]' : '[v]'}`);
    // regra da casa: o enable fica no próprio filtro de efeito, para o delogo só rodar dentro do trecho com marca
    if (marcas.length) fc.push(`[vc]${marcas.map(c => `delogo=x=${c.x}:y=${c.y}:w=${c.w}:h=${c.h}:enable='between(t,${c.a},${c.b})'`).join(',')}[v]`);
    fc.push(`[1:a]apad,atrim=0:${total.toFixed(3)},asetpts=PTS-STARTPTS[a]`);
    const final = join(dirname(video), basename(video, extname(video)) + '.lipsync.mp4');
    ff(['-i', video, '-i', audio, ...retornos.flatMap(r => ['-i', r]), '-filter_complex', fc.join(';'), '-map', '[v]', '-map', '[a]',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final]);
    const d = duracao(final);
    const confere = join(dirname(video), basename(video, extname(video)) + '.lipsync-confere.jpg');
    ff(['-ss', ((trechos[0][0] + trechos[0][1]) / 2).toFixed(2), '-i', final, '-frames:v', '1', '-q:v', '3', confere]);
    console.log(`\npronto: ${final}\nduração ${d.toFixed(2)} s contra ${total.toFixed(2)} s do original${Math.abs(d - total) > 0.15 ? ' — DIFERENTE, confira antes de usar' : ''}`);
    console.log(`quadro para conferir o canto superior direito (sem "sync.so"): ${confere}`);
    if (!SIMULAR) console.log('Confira a boca em cada trecho antes de subir o anúncio. Errou um trecho? Rode de novo só com ele.');
  } finally {
    if (ids.length && !tem('--manter-arquivos')) { try { apagarArquivos(loja, ids); } catch (e) { console.log(`  não consegui apagar os temporários dos Files: ${e.message}`); } }
    rmSync(tmp, { recursive: true, force: true });
  }
}

const sub = process.argv[2];
if (!sub || sub === '--help') sair(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*?/, '').replace(/^ \* ?/gm, ''));
(sub === 'quadros' ? Promise.resolve(quadros()) : lipsync()).catch(e => sair(`Erro: ${e.message}`));
