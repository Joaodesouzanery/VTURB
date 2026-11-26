#!/usr/bin/env node
/**
 * setup.mjs - instalador automatico das dependencias da skill briefing-criativos.
 *
 * Idempotente e cross-platform: instala SO o que falta.
 *   - ffmpeg  (Windows: winget Gyan.FFmpeg | macOS: brew | Linux: apt/dnf)
 *   - faster-whisper (pip)
 *
 * Rodado automaticamente pela skill quando o preflight acusa dependencia faltando,
 * entao o primeiro colaborador a usar a skill tem tudo instalado sem passo manual.
 *
 * Uso:
 *   node setup.mjs            instala o que falta
 *   node setup.mjs --dry-run  mostra os comandos que rodaria, sem executar
 *
 * O modelo Whisper (medium, ~1.4GB) NAO e baixado aqui: ele vem sob demanda
 * no primeiro transcribe, cacheado em ~/.cache/huggingface.
 */
import { spawnSync } from 'node:child_process';

const DRY = process.argv.includes('--dry-run');
const PY = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg';

function has(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return r.status === 0;
}

function pyImportOk(mod) {
  return spawnSync(PY, ['-c', `import ${mod}`], { encoding: 'utf8' }).status === 0;
}

function exec(cmd, args, label) {
  console.error(`\n[setup] ${label}`);
  console.error(`        > ${cmd} ${args.join(' ')}`);
  if (DRY) { console.error('        (dry-run: nao executado)'); return true; }
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) { console.error(`[setup] FALHOU: ${label}`); return false; }
  return true;
}

function installFfmpeg() {
  if (has(FFMPEG, ['-version'])) { console.error('[ok] ffmpeg ja presente'); return true; }
  if (process.platform === 'win32') {
    return exec('winget', ['install', '--id', 'Gyan.FFmpeg', '-e',
      '--accept-source-agreements', '--accept-package-agreements'], 'instalando ffmpeg (winget)');
  }
  if (process.platform === 'darwin') {
    if (!has('brew', ['--version'])) { console.error('[setup] Homebrew ausente. Instale em https://brew.sh e rode de novo.'); return false; }
    return exec('brew', ['install', 'ffmpeg'], 'instalando ffmpeg (brew)');
  }
  // linux
  if (has('apt-get', ['--version'])) return exec('sudo', ['apt-get', 'install', '-y', 'ffmpeg'], 'instalando ffmpeg (apt)');
  if (has('dnf', ['--version'])) return exec('sudo', ['dnf', 'install', '-y', 'ffmpeg'], 'instalando ffmpeg (dnf)');
  console.error('[setup] gerenciador de pacotes nao reconhecido. Instale ffmpeg manualmente.');
  return false;
}

function installFasterWhisper() {
  if (pyImportOk('faster_whisper') && pyImportOk('av')) { console.error('[ok] faster-whisper ja presente'); return true; }
  if (!has(PY, ['--version'])) { console.error(`[setup] Python nao encontrado (${PY}). Instale o Python 3 em https://python.org e rode de novo.`); return false; }
  return exec(PY, ['-m', 'pip', 'install', '--upgrade', 'faster-whisper'], 'instalando faster-whisper (pip)');
}

console.error(`\n=== Setup: briefing-criativos (${process.platform}${DRY ? ', dry-run' : ''}) ===`);
const okFf = installFfmpeg();
const okFw = installFasterWhisper();

console.error('\n=== Resultado ===');
console.error(`ffmpeg:         ${okFf ? 'OK' : 'PENDENTE'}`);
console.error(`faster-whisper: ${okFw ? 'OK' : 'PENDENTE'}`);
console.error('modelo medium: baixa no primeiro uso (~1.4GB, cache HF)\n');
process.exit(okFf && okFw ? 0 : 1);
