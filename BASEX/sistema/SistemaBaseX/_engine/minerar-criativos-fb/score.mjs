#!/usr/bin/env node
/**
 * Calcula score de cada ad filtrado, classifica em lanes e exporta top N.
 *
 * Uso:
 *   node score.mjs --input outputs/filtered-XXX.json [--limite 30]
 *
 * Output: outputs/scored-{nicho}-{ts}.json
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

function scoreAd(ad) {
  const e = ad._enrich || {};
  const dias = e.dias_ativo || 0;
  const variacoes = e.variacoes_ativas || 1;
  const placements = (e.placements || []).length;
  const formato = e.formato;
  const dominio = e.tem_dominio_proprio;
  const adsPag = e.ads_pagina_total || 0;
  const paisesSimultaneos = e.paises_simultaneos || 1;

  let s = 0;
  s += (Math.min(dias, 90) / 90) * 25;
  s += (Math.min(variacoes, 10) / 10) * 20;
  s += (placements / 5) * 15;
  s += formato === 'video' ? 15 : 5;
  s += dominio ? 15 : 0;
  s += adsPag >= 5 && adsPag <= 150 ? 10 : 0;
  s += paisesSimultaneos >= 3 ? 20 : 0;

  // Penalidades
  if (adsPag > 500) s -= 50;
  if (ad.page_is_verified || ad.snapshot?.page_is_verified) s -= 50;
  if (dias < 7) s -= 30;
  if (!dominio) s -= 20;

  return Math.round(Math.max(0, s));
}

function classificarLane(score, dias) {
  if (score >= 75) return 'VENCEDORES';
  if (score >= 50) return 'PROMISSORES';
  if (score >= 30 && dias <= 21) return 'TENDÊNCIAS';
  return null;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.input) {
    console.error('Faltou --input outputs/filtered-XXX.json');
    process.exit(1);
  }
  const inPath = path.isAbsolute(args.input) ? args.input : path.join(__dirname, args.input);
  if (!fs.existsSync(inPath)) {
    console.error('Arquivo não existe:', inPath);
    process.exit(2);
  }

  const limite = Number(args.limite ?? 30);
  const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const ads = raw.ads || [];

  // Detectar paises simultaneos por conceito (mesma página + mesmo conceito em N países)
  const conceitoPaises = new Map();
  for (const ad of ads) {
    const pag = ad._enrich?.pagina;
    const body = (ad.body_text || ad.snapshot?.body?.text || '').slice(0, 80).toLowerCase().trim();
    const chave = `${pag}::${body}`;
    const pais = ad._enrich?.pais_hint;
    if (!conceitoPaises.has(chave)) conceitoPaises.set(chave, new Set());
    if (pais) conceitoPaises.get(chave).add(pais);
  }

  // Anexar paises_simultaneos no enrich antes de pontuar
  for (const ad of ads) {
    const pag = ad._enrich?.pagina;
    const body = (ad.body_text || ad.snapshot?.body?.text || '').slice(0, 80).toLowerCase().trim();
    const chave = `${pag}::${body}`;
    ad._enrich = ad._enrich || {};
    ad._enrich.paises_simultaneos = (conceitoPaises.get(chave) || new Set()).size;
  }

  const scored = ads
    .map((ad) => {
      const s = scoreAd(ad);
      const lane = classificarLane(s, ad._enrich?.dias_ativo || 0);
      return lane ? { ...ad, _score: s, _lane: lane } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b._score - a._score);

  const top = scored.slice(0, limite);

  const distribuicao = {
    VENCEDORES: top.filter((a) => a._lane === 'VENCEDORES').length,
    PROMISSORES: top.filter((a) => a._lane === 'PROMISSORES').length,
    TENDÊNCIAS: top.filter((a) => a._lane === 'TENDÊNCIAS').length
  };

  // Top players (agrupar por página)
  const porPagina = new Map();
  for (const ad of top) {
    const p = ad._enrich?.pagina || 'sem-pagina';
    if (!porPagina.has(p)) porPagina.set(p, { ads: 0, soma: 0 });
    const entry = porPagina.get(p);
    entry.ads++;
    entry.soma += ad._score;
  }
  const topPlayers = [...porPagina.entries()]
    .map(([nome, v]) => ({ nome, ads: v.ads, score_medio: Math.round(v.soma / v.ads) }))
    .sort((a, b) => b.ads - a.ads || b.score_medio - a.score_medio)
    .slice(0, 10);

  console.log('Distribuição em lanes:', distribuicao);
  console.log('Top 5 players:');
  topPlayers.slice(0, 5).forEach((p, i) => console.log(`  ${i + 1}. ${p.nome} — ${p.ads} ads, score médio ${p.score_medio}`));

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const slugNicho = (raw.meta?.nicho || 'sem-nicho').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  const outFile = path.join(OUTPUTS_DIR, `scored-${slugNicho}-${ts}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        meta: { ...raw.meta, scoring: { limite, distribuicao, top_players: topPlayers } },
        ads: top
      },
      null,
      2
    )
  );
  console.log(`Salvo: ${outFile}`);
  console.log(outFile);
}

main();
