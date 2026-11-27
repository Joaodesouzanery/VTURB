#!/usr/bin/env node
/**
 * Filtra ads brutos da Apify aplicando regras de qualidade.
 *
 * Uso:
 *   node filter.mjs --input outputs/raw-XXX.json [--tamanho medium] [--tempo-min 30] [--variacoes-min 3] [--formato all]
 *
 * Output: outputs/filtered-{nicho}-{ts}.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BLACKLISTS_DIR = path.join(__dirname, 'blacklists');
const OUTPUTS_DIR = path.join(__dirname, 'outputs');

const TAMANHOS = {
  small: [1, 20],
  medium: [5, 150],
  large: [50, 500],
  all: [1, 100000]
};

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

function carregarBlacklistGlobal(nicho) {
  const candidatos = [
    path.join(BLACKLISTS_DIR, `${nicho}.json`),
    path.join(BLACKLISTS_DIR, 'global.json')
  ];
  let nomes = [];
  for (const p of candidatos) {
    if (fs.existsSync(p)) {
      try {
        nomes = nomes.concat(JSON.parse(fs.readFileSync(p, 'utf8')).marcas || []);
      } catch {}
    }
  }
  return new Set(nomes.map((n) => n.toLowerCase()));
}

function diasEntre(dataInicio) {
  if (!dataInicio) return 0;
  const ini = new Date(dataInicio).getTime();
  if (Number.isNaN(ini)) return 0;
  const dias = Math.floor((Date.now() - ini) / (1000 * 60 * 60 * 24));
  return Math.max(0, dias);
}

function detectarDominio(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function temDominioProprio(ad) {
  const candidatos = [ad.link_url, ad.destination_url, ad.snapshot?.link_url].filter(Boolean);
  const dom = candidatos.map(detectarDominio).find(Boolean);
  if (!dom) return false;
  const proibidos = ['linktr.ee', 'beacons.ai', 'bio.link', 'lnk.bio', 'instagram.com', 'facebook.com', 'wa.me', 'whatsapp.com', 'msng.link'];
  return !proibidos.includes(dom);
}

function detectarPlacements(ad) {
  const raw = ad.publisher_platforms || ad.publisher_platform || ad.snapshot?.publisher_platforms;
  if (Array.isArray(raw)) return [...new Set(raw.map((s) => String(s).toLowerCase()))];
  if (typeof raw === 'string') return [raw.toLowerCase()];
  return [];
}

function detectarFormato(ad) {
  if (ad.video_url || ad.snapshot?.video_url || ad.snapshot?.videos?.length) return 'video';
  if (ad.image_url || ad.snapshot?.image_url || ad.snapshot?.images?.length) return 'imagem';
  return 'desconhecido';
}

function nomeDaPagina(ad) {
  return ad.page_name || ad.snapshot?.page_name || ad.advertiser?.name || null;
}

function adsAtivosDaPagina(ad, contagemPorPagina) {
  const nome = nomeDaPagina(ad);
  if (!nome) return 1;
  return contagemPorPagina.get(nome) || 1;
}

function adIsAtivo(ad) {
  const status = (ad.is_active ?? ad.active ?? ad.status ?? '').toString().toLowerCase();
  if (typeof ad.is_active === 'boolean') return ad.is_active;
  if (status === 'active') return true;
  if (status === '') return true; // assume ativo se omitido (já filtrado na URL)
  return false;
}

function paginaVerifiedAzul(ad) {
  return Boolean(ad.page_is_verified || ad.snapshot?.page_is_verified);
}

function idiomaConfere(ad, paisHint) {
  const idioma = (ad.ad_creative_languages?.[0] || ad.language || '').toLowerCase();
  if (!idioma) return true; // não penaliza se desconhecido
  const map = {
    US: ['en'], GB: ['en'], DE: ['de'], FR: ['fr'], ES: ['es', 'ca'],
    IT: ['it'], PT: ['pt'], NL: ['nl'], BR: ['pt'], MX: ['es'], AR: ['es']
  };
  const aceitos = map[paisHint?.toUpperCase()] || [];
  if (!aceitos.length) return true;
  return aceitos.some((l) => idioma.startsWith(l));
}

function detectarConceito(ad) {
  // Heurística simples: primeiras 80 chars do body, normalizadas
  const body = (ad.body_text || ad.snapshot?.body?.text || ad.ad_creative_body || '').slice(0, 80).toLowerCase().replace(/\s+/g, ' ').trim();
  return body || `${nomeDaPagina(ad) || 'sem-pagina'}-${detectarFormato(ad)}`;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.input) {
    console.error('Faltou --input outputs/raw-XXX.json');
    process.exit(1);
  }
  const inPath = path.isAbsolute(args.input) ? args.input : path.join(__dirname, args.input);
  if (!fs.existsSync(inPath)) {
    console.error('Arquivo não existe:', inPath);
    process.exit(2);
  }

  const tamanho = args['tamanho'] || 'medium';
  const tempoMin = Number(args['tempo-min'] ?? 30);
  const variacoesMin = Number(args['variacoes-min'] ?? 3);
  const formato = args['formato'] || 'all';

  const [adsMin, adsMax] = TAMANHOS[tamanho] || TAMANHOS.medium;

  const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const ads = raw.ads || [];
  const nicho = raw.meta?.nicho || 'sem-nicho';
  console.log(`Total bruto: ${ads.length}`);

  const blacklist = carregarBlacklistGlobal(nicho);

  // Contagem de ads ativos por página (pra detectar variações + tamanho)
  const contagem = new Map();
  for (const ad of ads) {
    if (!adIsAtivo(ad)) continue;
    const nome = nomeDaPagina(ad);
    if (!nome) continue;
    contagem.set(nome, (contagem.get(nome) || 0) + 1);
  }

  // Agrupar por conceito por página (variações)
  const variacoesPorConceito = new Map();
  for (const ad of ads) {
    if (!adIsAtivo(ad)) continue;
    const chave = `${nomeDaPagina(ad)}::${detectarConceito(ad)}`;
    variacoesPorConceito.set(chave, (variacoesPorConceito.get(chave) || 0) + 1);
  }

  const filtrados = [];
  const rejeitados = { inativo: 0, blacklist: 0, tamanho: 0, tempo: 0, variacoes: 0, formato: 0, dominio: 0, verified: 0, idioma: 0 };

  for (const ad of ads) {
    if (!adIsAtivo(ad)) { rejeitados.inativo++; continue; }

    const nomePag = nomeDaPagina(ad);
    if (nomePag && blacklist.has(nomePag.toLowerCase())) { rejeitados.blacklist++; continue; }

    const adsPag = adsAtivosDaPagina(ad, contagem);
    if (adsPag < adsMin || adsPag > adsMax) { rejeitados.tamanho++; continue; }

    const dias = diasEntre(ad.start_date || ad.start_date_string || ad.snapshot?.creation_time);
    if (dias < tempoMin) { rejeitados.tempo++; continue; }

    const chaveConc = `${nomePag}::${detectarConceito(ad)}`;
    const variacoes = variacoesPorConceito.get(chaveConc) || 1;
    if (variacoes < variacoesMin) { rejeitados.variacoes++; continue; }

    const fmt = detectarFormato(ad);
    if (formato !== 'all' && fmt !== formato) { rejeitados.formato++; continue; }

    const dominio = temDominioProprio(ad);
    if (!dominio) { rejeitados.dominio++; continue; }

    if (paginaVerifiedAzul(ad)) { rejeitados.verified++; continue; }

    const paisHint = ad._context?.country_hint || ad.country || ad.delivery_country;
    if (!idiomaConfere(ad, paisHint)) { rejeitados.idioma++; continue; }

    filtrados.push({
      ...ad,
      _enrich: {
        dias_ativo: dias,
        variacoes_ativas: variacoes,
        ads_pagina_total: adsPag,
        placements: detectarPlacements(ad),
        formato: fmt,
        tem_dominio_proprio: dominio,
        pagina: nomePag,
        pais_hint: paisHint
      }
    });
  }

  console.log(`Filtrados: ${filtrados.length}`);
  console.log('Rejeitados por motivo:', rejeitados);

  if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const slugNicho = nicho.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const outFile = path.join(OUTPUTS_DIR, `filtered-${slugNicho}-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ meta: { ...raw.meta, filtros: { tamanho, tempoMin, variacoesMin, formato }, rejeitados, total_filtrado: filtrados.length }, ads: filtrados }, null, 2));
  console.log(`Salvo: ${outFile}`);
  console.log(outFile);
}

main();
