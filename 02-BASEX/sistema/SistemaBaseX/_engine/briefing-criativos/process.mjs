#!/usr/bin/env node
/**
 * process.mjs - engine da skill "Briefing de Criativos".
 *
 * Dado um arquivo de video OU uma pasta de videos minerados, para cada video:
 *   1. ffmpeg  -> extrai audio 16kHz mono wav
 *   2. ffmpeg  -> extrai frames distribuidos (analise visual pelo Claude)
 *   3. transcribe.py (faster-whisper) -> transcricao com timestamps + idioma detectado
 *
 * Emite no stdout um JSON consolidado que o Claude consome pra montar o briefing.
 * Progresso vai pro stderr (nao polui o JSON).
 *
 * Uso:
 *   node process.mjs <arquivo-ou-pasta> [opcoes]
 *     --out DIR            pasta de trabalho (default: <tmp>/briefing-criativos-<id>)
 *     --model MODEL        modelo whisper (default: medium; use large-v3 so com GPU)
 *     --language LANG      idioma (default: auto)
 *     --device D           auto | cuda | cpu (default: auto)
 *     --frames-every S     1 frame a cada S segundos (default: 2.5)
 *     --max-frames N       teto de frames por video (default: 24)
 *     --dry-run            lista o que seria processado e valida, sem transcrever
 *
 * NAO e destrutivo: le videos locais e escreve artefatos temporarios na pasta --out.
 * Nao chama API paga, nao modifica o video original, nao toca no SistemaBaseX.
 */
import { spawn } from 'node:child_process';
import { mkdir, readdir, stat, access, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg';
const PYTHON = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi', '.flv', '.m4v']);

function parseArgs(argv) {
  const a = {
    input: null, out: null, model: 'medium', language: 'auto',
    device: 'auto', framesEvery: 2.5, maxFrames: 24, dryRun: false, words: false,
  };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (t === '--out') a.out = rest[++i];
    else if (t === '--model') a.model = rest[++i];
    else if (t === '--language') a.language = rest[++i];
    else if (t === '--device') a.device = rest[++i];
    else if (t === '--frames-every') a.framesEvery = parseFloat(rest[++i]);
    else if (t === '--max-frames') a.maxFrames = parseInt(rest[++i], 10);
    else if (t === '--words') a.words = true;
    else if (t === '--dry-run') a.dryRun = true;
    else if (!a.input) a.input = t;
  }
  if (!a.input) {
    console.error('Uso: node process.mjs <arquivo-ou-pasta> [--out DIR] [--dry-run]');
    process.exit(2);
  }
  return a;
}

function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; process.stderr.write(d); });
    p.on('error', rej);
    p.on('close', (code) => (code === 0 ? res({ out, err }) : rej(new Error(`${cmd} exit ${code}\n${err}`))));
  });
}

// ffmpeg -i retorna exit 1 sem output, mas o stderr traz a Duration.
function runFfmpegProbe(input) {
  return new Promise((res) => {
    const p = spawn(FFMPEG, ['-i', input], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', () => {
      const m = err.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      const dur = m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : null;
      res(dur);
    });
    p.on('error', () => res(null));
  });
}

async function listVideos(input) {
  const s = await stat(input).catch(() => null);
  if (!s) throw new Error(`Caminho nao existe: ${input}`);
  if (s.isFile()) {
    if (!VIDEO_EXTS.has(extname(input).toLowerCase())) throw new Error(`Nao e video: ${input}`);
    return [resolve(input)];
  }
  const names = await readdir(input);
  const vids = names
    .filter((n) => VIDEO_EXTS.has(extname(n).toLowerCase()))
    .sort()
    .map((n) => resolve(join(input, n)));
  if (vids.length === 0) throw new Error(`Nenhum video em: ${input}`);
  return vids;
}

async function extractAudio(video, workdir) {
  const audio = join(workdir, 'audio.wav');
  await run(FFMPEG, ['-y', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', audio]);
  return audio;
}

async function extractFrames(video, workdir, everyS, maxFrames) {
  const framesDir = join(workdir, 'frames');
  await mkdir(framesDir, { recursive: true });
  const fps = (1 / everyS).toFixed(4);
  await run(FFMPEG, [
    '-y', '-i', video,
    '-vf', `fps=${fps},scale='min(640,iw)':-2`,
    '-frames:v', String(maxFrames),
    '-q:v', '3',
    join(framesDir, 'frame_%03d.jpg'),
  ]);
  const files = (await readdir(framesDir)).filter((f) => f.endsWith('.jpg')).sort();
  return files.map((f, i) => ({
    index: i + 1,
    approx_t: +((i + 0.5) * everyS).toFixed(1),
    path: join(framesDir, f),
  }));
}

async function transcribeAudio(audio, { model, language, device, words }) {
  const pyArgs = [
    join(__dirname, 'transcribe.py'), audio,
    '--model', model, '--language', language, '--device', device,
  ];
  if (words) pyArgs.push('--words');
  const { out } = await run(PYTHON, pyArgs);
  return JSON.parse(out);
}

function toSrtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const mm = String(ms % 1000).padStart(3, '0');
  return `${h}:${m}:${s},${mm}`;
}

function segmentsToSrt(segments) {
  return segments
    .map((s, i) => `${i + 1}\n${toSrtTime(s.start)} --> ${toSrtTime(s.end)}\n${s.text}\n`)
    .join('\n');
}

// Se o usuario colocou um export de metricas da ferramenta onde ele minera na
// pasta dos videos, anexa o conteudo bruto pro ranking usar performance real.
async function readMetricasExternas(input) {
  const s = await stat(input).catch(() => null);
  const dir = s && s.isDirectory() ? input : dirname(input);
  for (const name of ['metricas.json', 'metricas.csv', 'kalodata.json', 'kalodata.csv']) {
    const p = join(dir, name);
    try { await access(p); return { file: name, content: await readFile(p, 'utf8') }; } catch { /* nao existe */ }
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  const videos = await listVideos(args.input);
  const sessionId = randomBytes(3).toString('hex');
  const outRoot = resolve(args.out || join(tmpdir(), `briefing-criativos-${sessionId}`));
  await mkdir(outRoot, { recursive: true });

  process.stderr.write(`\n[engine] ${videos.length} video(s) | out=${outRoot} | device=${args.device}\n`);

  if (args.dryRun) {
    const plan = [];
    for (const v of videos) {
      const dur = await runFfmpegProbe(v);
      plan.push({ video: basename(v), duration_s: dur });
      process.stderr.write(`  - ${basename(v)} (${dur ?? '?'}s)\n`);
    }
    process.stdout.write(JSON.stringify({ dry_run: true, out_dir: outRoot, videos: plan }, null, 2));
    return;
  }

  const results = [];
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const name = basename(v);
    const workdir = join(outRoot, String(i + 1).padStart(2, '0') + '-' + name.replace(/[^\w.-]/g, '_'));
    await mkdir(workdir, { recursive: true });
    process.stderr.write(`\n[${i + 1}/${videos.length}] ${name}\n`);
    try {
      const duration = await runFfmpegProbe(v);
      process.stderr.write('  -> extraindo audio...\n');
      const audio = await extractAudio(v, workdir);
      process.stderr.write('  -> extraindo frames...\n');
      const frames = await extractFrames(v, workdir, args.framesEvery, args.maxFrames);
      process.stderr.write(`  -> transcrevendo (${frames.length} frames capturados)...\n`);
      const transcript = await transcribeAudio(audio, args);
      const srtPath = join(workdir, 'legenda-original.srt');
      await writeFile(srtPath, segmentsToSrt(transcript.segments || []), 'utf8');
      results.push({
        index: i + 1, video: name, path: v, duration_s: duration,
        workdir, audio_path: audio, srt_path: srtPath, frames, transcript, error: null,
      });
    } catch (e) {
      process.stderr.write(`  !! erro: ${e.message}\n`);
      results.push({ index: i + 1, video: name, path: v, workdir, error: e.message });
    }
  }

  const metricasExternas = await readMetricasExternas(args.input);
  if (metricasExternas) process.stderr.write(`\n[engine] metricas anexadas: ${metricasExternas.file}\n`);

  const consolidated = {
    engine: 'briefing-criativos',
    generated_from: args.input,
    out_dir: outRoot,
    total: videos.length,
    ok: results.filter((r) => !r.error).length,
    failed: results.filter((r) => r.error).length,
    metricas_externas: metricasExternas,
    creatives: results,
  };
  const jsonPath = join(outRoot, 'transcripts.json');
  await writeFile(jsonPath, JSON.stringify(consolidated, null, 2), 'utf8');
  process.stderr.write(`\n[engine] pronto. JSON: ${jsonPath}\n`);
  process.stdout.write(JSON.stringify(consolidated, null, 2));
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
