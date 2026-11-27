#!/usr/bin/env node
/**
 * Seleciona top N imagens + top M vídeos por concorrente.
 *
 * Uso:
 *   node select-top.mjs --input outputs/raw-concorrentes-XXX.json [--top-imagens 10] [--top-videos 5]
 *
 * Output: outputs/top-concorrentes-{ts}.json
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

function diasEntre(dataInicio) {
  if (!dataInicio) return 0;
  const ini = new Date(dataInicio).getTime();
  if (Number.isNaN(ini)) return 0;
  return Math.max(0, Math.floor((Date.now() - ini) / 86400000));
}

function detectarConceito(ad) {
  const body = (ad.body_text || ad.snapshot?.body?.text || ad.ad_creative_body || '').slice(0, 80).toLowerCase().replace(/\s+/g, ' ').trim();
  return body || `${ad.image_url || ad.video_url || 'sem-midia'}`.slice(0, 80);
}

function detectarPlacements(ad) {
  const raw = ad.publisher_platforms || ad.publisher_platform || ad.snapshot?.publisher_platforms;
  if (Array.isArray(raw)) return [...new Set(raw.map((s) => String(s).toLowerCase()))];
  if (typeof raw === 'string') return [raw.toLowerCase()];
  return [];
}

function adIsAtivo(ad) {
  if (typeof ad.is_active === 'boolean') return ad.is_active;
  const status = String(ad.active ?? ad.status ?? '').toLowerCase();
  return status === '' || status === 'active';
}

function agruparPorConceito(ads) {
  const grupos = new Map();
  for (const ad of ads) {
    if (!adIsAtivo(ad)) continue;
    const chave = detectarConceito(ad);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(ad);
  }
  return grupos;
}

function extrairAssets(ad) {
  const s = ad.snapshot || {};
  const assets = {
    display_format: s.display_format,
    images: [],
    videos: [],
    cards: []
  };
  for (const img of (s.images || [])) {
    assets.images.push({
      original: img.original_image_url || img.url,
      resized: img.resized_image_url
    });
  }
  for (const vid of (s.videos || [])) {
    assets.videos.push({
      hd: vid.video_hd_url,
      sd: vid.video_sd_url,
      preview: vid.video_preview_image_url
    });
  }
  for (const card of (s.cards || [])) {
    assets.cards.push({
      title: card.title,
      body: card.body,
      image: card.original_image_url || card.resized_image_url,
      video_hd: card.video_hd_url,
      video_preview: card.video_preview_image_url,
      link_url: card.link_url
    });
  }
  return assets;
}

function selecionarTop(ads, topN) {
  const grupos = agruparPorConceito(ads);
  const conceitos = [];
  for (const [chave, ads_grupo] of grupos.entries()) {
    const variacoes = ads_grupo.length;
    const placementsUniao = new Set();
    let diasMax = 0;
    let representante = ads_grupo[0];
    for (const ad of ads_grupo) {
      const d = diasEntre(ad.start_date || ad.start_date_string || ad.snapshot?.creation_time);
      if (d > diasMax) {
        diasMax = d;
        representante = ad;
      }
      for (const p of detectarPlacements(ad)) placementsUniao.add(p);
    }
    const score =
      variacoes * 0.5 +
      (Math.min(diasMax, 90) / 90) * 30 +
      (placementsUniao.size / 5) * 20;

    const s = representante.snapshot || {};
    representante._enrich = {
      conceito: chave.slice(0, 60),
      variacoes_ativas: variacoes,
      dias_ativo_max: diasMax,
      placements: [...placementsUniao],
      score: Math.round(score * 10) / 10,
      // Campos ricos preservados pra briefing:
      body_text: s.body?.text || '',
      title: s.title || '',
      caption: s.caption || '',
      cta_text: s.cta_text || ad.cta_text || '',
      cta_type: s.cta_type || ad.cta_type || '',
      link_url: s.link_url || '',
      link_description: s.link_description || '',
      page_name: s.page_name || ad.page_name || '',
      is_active: representante.is_active,
      assets: extrairAssets(representante)
    };
    conceitos.push(representante);
  }
  conceitos.sort((a, b) => b._enrich.score - a._enrich.score);
  return conceitos.slice(0, topN);
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.input) {
    console.error('Faltou --input outputs/raw-concorrentes-XXX.json');
    process.exit(1);
  }
  const topImagens = Number(args['top-imagens'] ?? 10);
  const topVideos = Number(args['top-videos'] ?? 5);

  const inPath = path.isAbsolute(args.input) ? args.input : path.join(__dirname, args.input);
  const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const concorrentes = raw.concorrentes || [];

  const out = [];
  for (const c of concorrentes) {
    const imagens = selecionarTop(c.ads?.image || [], topImagens);
    const videos = selecionarTop(c.ads?.video || [], topVideos);

    out.push({
      nome: c.nome,
      page_id: c.page_id,
      country: c.country,
      imagens,
      videos,
      stats: {
        imagens_brutas: (c.ads?.image || []).length,
        videos_brutos: (c.ads?.video || []).length,
        imagens_selecionadas: imagens.length,
        videos_selecionados: videos.length,
        descartar_imagens: imagens.length === 0,
        descartar_videos: videos.length === 0
      }
    });

    console.log(`${c.nome}: ${imagens.length}/${(c.ads?.image||[]).length} imagens, ${videos.length}/${(c.ads?.video||[]).length} vídeos`);
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  const file = path.join(OUTPUTS_DIR, `top-concorrentes-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify({ meta: { ...raw.meta, topImagens, topVideos, ts }, concorrentes: out }, null, 2));
  console.log(`Salvo: ${file}`);
  console.log(file);
}

main();
