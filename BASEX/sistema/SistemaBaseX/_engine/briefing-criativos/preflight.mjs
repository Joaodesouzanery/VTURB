#!/usr/bin/env node
/**
 * preflight.mjs - valida o ambiente antes de rodar o engine briefing-criativos.
 * Falha cedo (barato) em vez de falhar no meio da transcricao (caro).
 *
 * Checa: Node 20+, ffmpeg no PATH, Python, faster-whisper importavel, GPU CUDA (opcional).
 * Exit 0 se nenhum bloqueio; exit 1 se algum check obrigatorio falhar.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg';
const PYTHON = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');

function which(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || ''), err: r.error };
}

const checks = [];

// 1. Node 20+
checks.push({
  nome: 'Node 20+', obrigatorio: true,
  ok: parseInt(process.versions.node.split('.')[0], 10) >= 20,
  info: process.versions.node,
});

// 2. ffmpeg
const ff = which(FFMPEG, ['-version']);
checks.push({
  nome: 'ffmpeg no PATH', obrigatorio: true, ok: ff.ok,
  info: ff.ok ? (ff.out.split('\n')[0] || 'ok') : 'nao encontrado (rode: node setup.mjs)',
});

// 3. Python
const py = which(PYTHON, ['--version']);
checks.push({
  nome: 'Python 3', obrigatorio: true, ok: py.ok,
  info: py.ok ? py.out.trim() : 'nao encontrado',
});

// 4. faster-whisper importavel
const fw = which(PYTHON, ['-c', 'import faster_whisper, av; print(faster_whisper.__version__)']);
checks.push({
  nome: 'faster-whisper + av', obrigatorio: true, ok: fw.ok,
  info: fw.ok ? `v${fw.out.trim()}` : 'pip install faster-whisper',
});

// 5. GPU CUDA (opcional - so acelera)
const gpu = which('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader']);
checks.push({
  nome: 'GPU NVIDIA (opcional)', obrigatorio: false, ok: gpu.ok,
  info: gpu.ok ? gpu.out.trim() : 'sem GPU -> roda em CPU (mais lento, ainda funciona)',
});

console.error('\n=== Pre-flight: briefing-criativos ===\n');
let bloqueios = 0;
for (const c of checks) {
  const tag = c.ok ? '[OK]  ' : (c.obrigatorio ? '[FAIL]' : '[warn]');
  console.error(`${tag} ${c.nome.padEnd(26)} ${c.info}`);
  if (!c.ok && c.obrigatorio) bloqueios++;
}
console.error('');
if (bloqueios > 0) {
  console.error(`${bloqueios} bloqueio(s). Instale as dependencias automaticamente com:`);
  console.error(`  node "${fileURLToPath(new URL('setup.mjs', import.meta.url))}"\n`);
  process.exit(1);
}
console.error('Ambiente OK.\n');
process.exit(0);
