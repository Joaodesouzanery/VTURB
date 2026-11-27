#!/usr/bin/env node
/**
 * Baixa thumbnails dos ads scored. Salva em outputs/thumbs-{slug}/{ad_id}.jpg
 *
 * Uso:
 *   node thumbnails.mjs --input outputs/scored-XXX.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUTS_DIR = path.join(__dirname, 'outputs');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[k] = v;
    }
  }
  return out;
}

function extrairThumbnail(ad) {
  // Preferência: thumbnail/preview do vídeo > imagem > snapshot
  const candidatos = [
    ad.video_preview_image_url,
    ad.thumbnail_url,
    ad.image_url,
    ad.snapshot?.video_preview_image_url,
    ad.snapshot?.image_url,
    ad.snapshot?.images?.[0]?.original_image_url,
    ad.snapshot?.images?.[0]?.resized_image_url,
    ad.snapshot?.videos?.[0]?.video_preview_image_url
  ].filter(Boolean);
  return candidatos[0] || null;
}

async function baixar(url, dest, tentativas = 3) {
  for (let t = 1; t <= tentativas; t++) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(dest, buf);
      return true;
    } catch (e) {
      if (t === tentativas) {
        console.warn(`  ✗ falhou ${url}: ${e.message}`);
        return false;
      }
      await new Promise((r) => setTimeout(r, 500 * t));
    }
  }
  return false;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.input) {
    console.error('Faltou --input outputs/(scored|top-concorrentes)-XXX.json');
    process.exit(1);
  }
  const inPath = path.isAbsolute(args.input) ? args.input : path.join(__dirname, args.input);
  const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));

  // Detecta estrutura: scored (ads[]) ou top-concorrentes (concorrentes[].imagens/videos)
  let ads = [];
  let baseDir = OUTPUTS_DIR;
  if (Array.isArray(raw.ads)) {
    ads = raw.ads.map((a) => ({ ad: a, scope: 'sem-nicho' }));
    const slugNicho = (raw.meta?.nicho || 'sem-nicho').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    baseDir = path.join(OUTPUTS_DIR, `thumbs-${slugNicho}`);
  } else if (Array.isArray(raw.concorrentes)) {
    for (const c of raw.concorrentes) {
      for (const a of (c.imagens || [])) ads.push({ ad: a, scope: c.page_id });
      for (const a of (c.videos || [])) ads.push({ ad: a, scope: c.page_id });
    }
    baseDir = path.join(OUTPUTS_DIR, `thumbs-concorrentes`);
  } else {
    console.error('Formato de input não reconhecido');
    process.exit(2);
  }

  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

  let ok = 0;
  for (const { ad, scope } of ads) {
    const id = ad.ad_archive_id || ad.adid || ad.ad_id || ad.id || Math.random().toString(36).slice(2, 10);
    const url = extrairThumbnail(ad);
    if (!url) { console.warn(`  − sem thumbnail: ${id}`); continue; }
    const scopeDir = path.join(baseDir, String(scope));
    if (!fs.existsSync(scopeDir)) fs.mkdirSync(scopeDir, { recursive: true });
    const dest = path.join(scopeDir, `${id}.jpg`);
    if (fs.existsSync(dest)) { ad._thumbnail_local = dest; ok++; continue; }
    const sucesso = await baixar(url, dest);
    if (sucesso) { ad._thumbnail_local = dest; ok++; }
  }

  fs.writeFileSync(inPath, JSON.stringify(raw, null, 2));
  console.log(`Thumbnails baixados: ${ok}/${ads.length}`);
  console.log(baseDir);
}

main();
