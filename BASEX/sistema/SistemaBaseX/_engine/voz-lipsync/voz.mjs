#!/usr/bin/env node
/**
 * voz.mjs — voz nova na ElevenLabs, com a chave do próprio aluno (_engine/.env: ELEVENLABS_API_KEY).
 *
 *   node _engine/voz-lipsync/voz.mjs vozes
 *       lista as vozes da sua conta (as prontas e os seus clones), com o voice_id de cada uma
 *   node _engine/voz-lipsync/voz.mjs clonar --nome "Minha voz" amostra1.mp3 [amostra2.mp3 ...]
 *       cria um clone e devolve o voice_id. Pede plano Starter ou acima. Amostra boa: 1 a 3 minutos
 *       de fala limpa, sem música por baixo
 *   node _engine/voz-lipsync/voz.mjs falar <video.mp4> --texto copy.txt --voz <voice_id> [--simular]
 *       PADRÃO. Lê a copy nova com a voz escolhida, ajusta o ritmo para caber no vídeo e troca a
 *       faixa de áudio. Ajusta até 15%; acima disso recusa e diz quantos caracteres a copy deve ter.
 *       Grava também a legenda da voz nova, no tempo de cada palavra
 *   node _engine/voz-lipsync/voz.mjs dublar <video.mp4> --para en [--de pt] [--trocar "MarcaAntiga=SuaMarca"] [--simular]
 *       ATALHO. Traduz o vídeo inteiro mantendo a voz original e mostra a fala traduzida. Traduz fiel:
 *       se o vídeo fala o nome de outra marca, a marca vem junto. --trocar (pode repetir) troca o nome:
 *       edita só os trechos que falam a marca e dubla de novo só esses trechos. Rodar de novo no mesmo
 *       vídeo retoma a mesma dublagem (<nome>.dublagem-<idioma>.json), sem pagar outra: é assim que se
 *       troca o nome depois de ouvir
 *
 * --simular não chama a ElevenLabs: gera um áudio de teste do tamanho certo e roda o resto (ritmo, troca
 * do nome, legenda e montagem), para conferir o caminho inteiro sem gastar crédito.
 * Saídas ficam ao lado do vídeo: <nome>.voz.mp3, <nome>.voz.srt, <nome>.voz-nova.mp4,
 * <nome>.dublado-<idioma>.mp4 e <nome>.dublado-<idioma>.vtt (a legenda da fala dublada).
 */
import { readFileSync, writeFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { basename, dirname, join, extname, resolve } from 'node:path';
import { arg, tem, todos, sair, chave, ff, duracao, temFfmpeg, avaliarRitmo, srtDeAlinhamento, lerTrocas, trocarNomes, hms, CARACTERES_POR_SEGUNDO, TOLERANCIA } from './lib.mjs';

const API = 'https://api.elevenlabs.io/v1';
const MODELO = arg('--modelo', 'eleven_multilingual_v2');
const SIMULAR = tem('--simular');
const MIME = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' };

async function el(caminho, opcoes = {}) {
  const k = chave('ELEVENLABS_API_KEY');
  if (!k) sair('Falta ELEVENLABS_API_KEY em _engine/.env (ElevenLabs → Developers → API Keys).');
  const r = await fetch(API + caminho, { ...opcoes, headers: { 'xi-api-key': k, ...(opcoes.headers || {}) } });
  if (!r.ok) {
    const corpo = (await r.text()).slice(0, 400);
    const e = new Error(`ElevenLabs respondeu ${r.status}: ${corpo}`); e.status = r.status; e.corpo = corpo; throw e;
  }
  return r;
}

const arquivo = caminho => new Blob([readFileSync(caminho)], { type: MIME[extname(caminho).toLowerCase()] || 'application/octet-stream' });
const saida = (video, sufixo) => join(dirname(video), basename(video, extname(video)) + sufixo);

async function vozes() {
  const j = await (await el('/voices')).json();
  for (const v of j.voices || []) console.log(`  ${v.voice_id}  ${v.name}  [${v.category}]`);
  console.log(`\n${(j.voices || []).length} voz(es). Use o voice_id em --voz.`);
}

async function clonar() {
  const nome = arg('--nome');
  const amostras = process.argv.slice(3).filter((a, i, l) => !a.startsWith('--') && l[i - 1] !== '--nome');
  if (!nome || !amostras.length) sair('Uso: voz.mjs clonar --nome "Minha voz" amostra1.mp3 [amostra2.mp3 ...]');
  for (const a of amostras) if (!existsSync(a)) sair(`Amostra não encontrada: ${a}`);
  const form = new FormData();
  form.append('name', nome);
  form.append('remove_background_noise', 'true');
  for (const a of amostras) form.append('files', arquivo(a), basename(a));
  try {
    const j = await (await el('/voices/add', { method: 'POST', body: form })).json();
    console.log(`Clone criado: ${nome}\nvoice_id: ${j.voice_id}\nGuarde esse voice_id: ele vale para todos os vídeos com essa voz.`);
  } catch (e) {
    if (e.status === 401 || e.status === 403 || /subscription|plan|can_not_use_instant_voice_cloning/i.test(e.corpo || '')) sair('A ElevenLabs recusou o clone: clonar voz pede o plano Starter ou acima.');
    throw e;
  }
}

async function falar() {
  const video = resolve(process.argv[3] || '');
  const texto = arg('--texto') && existsSync(arg('--texto')) ? readFileSync(arg('--texto'), 'utf8').trim() : '';
  const voz = arg('--voz');
  if (!existsSync(video) || !texto || (!voz && !SIMULAR)) sair('Uso: voz.mjs falar <video.mp4> --texto copy.txt --voz <voice_id> [--simular]');
  if (!temFfmpeg()) sair('Falta o ffmpeg. Rode: node _engine/briefing-criativos/setup.mjs');
  const durVideo = duracao(video);
  console.log(`vídeo: ${basename(video)} · ${durVideo.toFixed(1)} s`);
  console.log(`copy : ${texto.length} caracteres (cerca de ${texto.length} créditos da ElevenLabs) · o vídeo comporta cerca de ${Math.round(durVideo * CARACTERES_POR_SEGUNDO)}`);
  const mp3 = saida(video, '.voz-bruta.mp3');
  let alinhamento;
  if (SIMULAR) {
    const dur = texto.length / CARACTERES_POR_SEGUNDO, passo = dur / texto.length;
    ff(['-f', 'lavfi', '-i', `sine=frequency=220:duration=${dur.toFixed(2)}`, '-ac', '1', mp3]);
    alinhamento = { characters: [...texto], character_start_times_seconds: [...texto].map((_, i) => i * passo), character_end_times_seconds: [...texto].map((_, i) => (i + 1) * passo) };
    console.log('SIMULAÇÃO: nenhuma chamada à ElevenLabs, o áudio é um tom do tamanho que a copy teria.');
  } else {
    // /with-timestamps devolve, junto com o áudio, o tempo de cada letra: é de onde sai a legenda da voz nova
    const j = await (await el(`/text-to-speech/${voz}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texto, model_id: MODELO, voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0 } }),
    })).json();
    writeFileSync(mp3, Buffer.from(j.audio_base64 || '', 'base64'));
    alinhamento = j.alignment || j.normalized_alignment;
  }
  const durAudio = duracao(mp3);
  const a = avaliarRitmo(durAudio, durVideo, texto.length);
  console.log(`áudio: ${durAudio.toFixed(1)} s · ${a.desvio >= 0 ? '+' : ''}${(a.desvio * 100).toFixed(1)}% do vídeo`);
  if (!a.ok) {
    console.log(`\nRECUSADO: passa de ${TOLERANCIA * 100}% de diferença. Reescreva a copy com cerca de ${a.alvo} caracteres (${a.desvio > 0 ? 'encurtar' : 'alongar'}).`);
    console.log('Acelerar mais que isso deixa a fala com cara de robô.');
    process.exit(2);
  }
  const voz_final = saida(video, '.voz.mp3');
  // a ElevenLabs entrega a voz perto de -23 LUFS (medido em 10/11/2026), baixo para anúncio: sai em -16
  const ritmo = Math.abs(a.desvio) > 0.01 ? `atempo=${a.ritmo.toFixed(4)},` : '';
  ff(['-i', mp3, '-filter:a', `${ritmo}loudnorm=I=-16:TP=-1.5:LRA=11`, '-ar', '44100', '-b:a', '192k', voz_final]);
  if (ritmo) console.log(`ritmo ajustado em ${a.ritmo.toFixed(3)}x para caber no vídeo`);
  console.log('volume da voz levado a -16 LUFS, o padrão de anúncio');
  rmSync(mp3, { force: true });
  const srt = saida(video, '.voz.srt');
  if (alinhamento?.characters?.length) writeFileSync(srt, srtDeAlinhamento(alinhamento, ritmo ? 1 / a.ritmo : 1));
  else rmSync(srt, { force: true });
  const mp4 = saida(video, '.voz-nova.mp4');
  ff(['-i', video, '-i', voz_final, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', mp4]);
  console.log(`\npronto:\n  ${voz_final}  (a voz sozinha, para o CapCut ou para o lipsync)\n  ${mp4}  (o vídeo com a voz nova)`);
  if (existsSync(srt)) console.log(`  ${srt}  (a legenda da voz nova, para a legenda.mjs ou o CapCut)`);
  console.log(`conferir: ${duracao(mp4).toFixed(1)} s contra ${durVideo.toFixed(1)} s do original. A música de fundo entra na edição.`);
}

const espera = ms => new Promise(r => setTimeout(r, ms));
const obter = async caminho => (await el(caminho)).json();
const enviar = async (caminho, metodo, corpo) => (await el(caminho, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })).json();

// segue o idioma até ter saída da revisão pedida; sem revisão, serve a saída que já existe (completed ou stale)
async function esperarIdioma(projeto, idioma, revisao = null) {
  const inicio = Date.now();
  for (;;) {
    const l = await obter(`/dubbing/project/${projeto}/language/${idioma}`);
    if (l.status === 'failed') sair(`A dublagem falhou: ${l.error?.message || 'sem detalhe'}${l.error?.code === 'project_failed' ? '. Confira se o vídeo abre e tem fala' : ''}`);
    const pronto = l.status === 'completed' || (l.status === 'stale' && revisao == null);
    if (pronto && l.outputs?.lossless_audio && (revisao == null || (l.output_revision ?? -1) >= revisao)) return l;
    console.log(`  ${l.status}... ${Math.round((Date.now() - inicio) / 1000)} s`);
    if (Date.now() - inicio > 30 * 60 * 1000) sair('A dublagem passou de 30 minutos. Rode o mesmo comando mais tarde: ele retoma a mesma dublagem, sem pagar outra.');
    await espera(10000);
  }
}

async function baixar(url, destino) {
  const r = await fetch(url);   // link assinado, vale uma hora: vai sem a chave
  if (!r.ok) throw new Error(`download falhou: HTTP ${r.status}`);
  writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
}

// A dublagem é um projeto da ElevenLabs (API de projeto de dublagem): é ele que deixa editar o texto de um trecho
// e dublar de novo só esse trecho. Os dubs da API antiga voltam "editable: false" (conferido em 11/11/2026).
async function dublar() {
  const video = resolve(process.argv[3] || '');
  const para = arg('--para');
  if (!process.argv[3] || !existsSync(video) || !para) sair('Uso: voz.mjs dublar <video.mp4> --para en [--de pt] [--trocar "MarcaAntiga=SuaMarca"] [--simular]');
  if (!temFfmpeg()) sair('Falta o ffmpeg. Rode: node _engine/briefing-criativos/setup.mjs');
  let trocas;
  try { trocas = lerTrocas(todos('--trocar')); } catch (e) { sair(e.message); }
  const dados = saida(video, `.dublagem-${para}.json`), destino = saida(video, `.dublado-${para}.mp4`);
  const legenda = saida(video, `.dublado-${para}.vtt`), audio = saida(video, `.dublado-${para}.flac`);
  const total = duracao(video);
  console.log(`vídeo: ${basename(video)} · ${total.toFixed(1)} s → ${para}${trocas.length ? ` · trocar ${trocas.map(([de, por]) => `"${de}" por "${por}"`).join(', ')}` : ''}`);

  let segs;
  if (SIMULAR) {
    // fala de teste com o nome a trocar: confere a troca, a legenda e a montagem sem gastar nada
    const meio = Math.min(3, total / 2);
    segs = [{ start_s: 0, end_s: meio, translation: `I found ${trocas[0]?.[0] || 'OtherBrand'} last week.` }, { start_s: meio, end_s: total, translation: 'Now I wear it every day.' }];
    console.log('SIMULAÇÃO: nada vai para a ElevenLabs; a fala é de teste.');
    for (const s of segs) {
      const nova = trocarNomes(s.translation, trocas);
      if (nova !== s.translation) { console.log(`  ${s.start_s.toFixed(1)}-${s.end_s.toFixed(1)} s: "${s.translation}" → "${nova}"`); s.translation = nova; }
    }
    ff(['-f', 'lavfi', '-i', `sine=frequency=220:duration=${total.toFixed(2)}`, '-ac', '1', audio]);
    writeFileSync(legenda, `WEBVTT\n\n${segs.map(s => `${hms(s.start_s, '.')} --> ${hms(s.end_s, '.')}\n${s.translation}\n`).join('\n')}`);
  } else {
    // a dublagem salva só vale para o mesmo arquivo: vídeo trocado com o mesmo nome (ou .mov ao lado do .mp4) dubla do zero
    const quem = { video: basename(video), bytes: statSync(video).size };
    let salvo = existsSync(dados) ? JSON.parse(readFileSync(dados, 'utf8')) : {};
    if (salvo.projeto && (salvo.video !== quem.video || salvo.bytes !== quem.bytes)) { console.log(`o vídeo não é o mesmo da dublagem salva em ${basename(dados)}: dublando do zero`); salvo = {}; }
    let { projeto, idioma } = salvo;
    if (projeto) console.log(`retomando a dublagem deste vídeo (${basename(dados)}): nada é cobrado de novo. Para dublar do zero, apague esse arquivo.`);
    else {
      const form = new FormData();
      form.append('file', arquivo(video), basename(video));
      form.append('target_language', para);
      if (arg('--de')) form.append('source_language', arg('--de'));
      for (const [de] of trocas) form.append('keyterms', de);   // a transcrição acerta a grafia do nome que vai ser trocado
      const p = await (await el('/dubbing/project', { method: 'POST', body: form })).json();
      projeto = p.project_id;
      idioma = p.language_ids?.[0] || (await enviar(`/dubbing/project/${projeto}/language`, 'POST', { target_language: para })).language_id;
      writeFileSync(dados, JSON.stringify({ projeto, idioma, para, ...quem }, null, 2));
      console.log(`dublagem na fila (projeto ${projeto})`);
    }
    const base = `/dubbing/project/${projeto}/language/${idioma}`;
    let l = await esperarIdioma(projeto, idioma);
    segs = (await obter(`${base}/transcript`)).segments || [];
    const mudar = segs.map(s => ({ s, nova: trocarNomes(s.translation || '', trocas) })).filter(m => m.nova !== (m.s.translation || ''));
    for (const { s, nova } of mudar) {
      console.log(`  ${s.start_s.toFixed(1)}-${s.end_s.toFixed(1)} s: "${s.translation}" → "${nova}"`);
      await enviar(`${base}/transcript/segment/${s.id}`, 'PATCH', { translation: nova });
      s.translation = nova;
    }
    if (trocas.length && !mudar.length) console.log(`\nNenhum trecho fala ${trocas.map(([de]) => `"${de}"`).join(' ou ')}. Se a troca já foi feita, a fala abaixo mostra o nome novo; se a marca veio escrita de outro jeito, rode de novo com essa grafia em --trocar.`);
    // stale = texto editado sem dublar de novo (uma troca que parou no meio): dubla agora
    if (mudar.length || l.status === 'stale') {
      try {
        const g = await (await el(`${base}/transcript/regenerate`, { method: 'POST' })).json();
        console.log(`dublando de novo só o que mudou: ${g.regenerated_seconds ?? '?'} s, ${g.charged_seconds ?? 0} s cobrados`);
      } catch (e) { if (e.status !== 409) throw e; }   // 409: não havia o que refazer
      l = await esperarIdioma(projeto, idioma, (await obter(`${base}/transcript`)).revision);
    }
    await baixar(l.outputs.lossless_audio, audio);
    if (l.outputs.subtitles) await baixar(l.outputs.subtitles, legenda);
    else rmSync(legenda, { force: true });
  }
  // a faixa dublada entra no vídeo original, no volume de anúncio (-16 LUFS), com silêncio no fim se faltar.
  // apad sem fim com -shortest e vídeo copiado não termina (o arquivo cresce sem parar): completa até a duração e corta no -t
  ff(['-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', `apad=whole_dur=${total.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11`,
    '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(3), '-movflags', '+faststart', destino]);
  rmSync(audio, { force: true });
  console.log('\nfala dublada:');
  for (const s of segs) console.log(`  ${s.start_s.toFixed(1)}-${s.end_s.toFixed(1)} s  ${s.translation ?? '(sem tradução)'}`);
  console.log(`\npronto:\n  ${destino}  (o vídeo dublado; confira se a música de fundo veio junto)${existsSync(legenda) ? `\n  ${legenda}  (a legenda da fala dublada, para a legenda.mjs ou o CapCut)` : ''}`);
  console.log('Leia a fala acima atrás do nome de outra marca, inclusive escrito errado. Achou? Rode de novo com --trocar "NomeAntigo=SuaMarca": só os trechos com o nome são dublados de novo.');
}

const comandos = { vozes, clonar, falar, dublar };
const c = comandos[process.argv[2]];
if (!c) sair(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*?/, '').replace(/^ \* ?/gm, ''));
c().catch(e => sair(`Erro: ${e.message}`));
