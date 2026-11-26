#!/usr/bin/env node
/**
 * Scrape da Facebook Ads Library via Apify.
 *
 * Uso:
 *   node scrape.mjs --nicho "relogio masculino" --paises "US,GB,DE,FR" --termos "watch,montre,uhr"
 *
 * Output: outputs/raw-{slug}-{timestamp}.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { ApifyClient } from 'apify-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const OUTPUTS_DIR = path.join(__dirname, 'outputs');

const ACTOR_PRIMARIO = 'curious_coder/facebook-ads-library-scraper';
const ACTOR_FALLBACK = 'apify/facebook-ads-library-scraper';
const ADS_POR_BUSCA = 500;

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function montarUrls(termos, paises) {
  const urls = [];
  for (const pais of paises) {
    for (const termo of termos) {
      const q = encodeURIComponent(termo);
      const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${pais}&q=${q}&search_type=keyword_unordered`;
      urls.push({ url, country: pais, term: termo });
    }
  }
  return urls;
}

async function descobrirActorAtivo(client) {
  for (const id of [ACTOR_PRIMARIO, ACTOR_FALLBACK]) {
    try {
      const a = await client.actor(id).get();
      if (a) return id;
    } catch {}
  }
  throw new Error('Nenhum actor de FB Ads Library acessível. Rode preflight.mjs.');
}

async function rodarScrape(client, actorId, urls) {
  // Input compatível com curious_coder/facebook-ads-library-scraper:
  //   { urls: [{ url }], count: <ads por url> }
  const input = {
    urls: urls.map((u) => ({ url: u.url })),
    count: ADS_POR_BUSCA,
    scrapePageAds: false,
    expandedScrape: true
  };

  console.log(`Disparando actor ${actorId} com ${urls.length} buscas...`);
  const run = await client.actor(actorId).call(input, {
    timeout: 600,
    memory: 2048
  });
  console.log(`Run concluída: ${run.id} (status: ${run.status})`);

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`Recebidos ${items.length} ads brutos.`);
  return items;
}

function enriquecerComContexto(items, urls) {
  // Anexa pais/termo de busca em cada ad pra usar no filtro depois
  // Estratégia: se o actor retorna ad sem essa info, usar índice de origem
  return items.map((ad) => ({
    ...ad,
    _context: {
      country_hint: ad.country || ad.delivery_country || null,
      search_term_hint: ad.search_term || null
    }
  }));
}

async function main() {
  const args = parseArgs(process.argv);
  const nicho = args.nicho || 'sem-nicho';
  const paises = (args.paises || 'US,GB,DE,FR,ES,IT,PT,NL').split(',').map((s) => s.trim().toUpperCase());
  const termos = (args.termos || nicho).split(',').map((s) => s.trim()).filter(Boolean);

  if (!process.env.APIFY_API_TOKEN) {
    console.error('APIFY_API_TOKEN ausente. Rode preflight.mjs primeiro.');
    process.exit(1);
  }

  const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
  const actorId = await descobrirActorAtivo(client);

  const urls = montarUrls(termos, paises);
  console.log(`Buscas a realizar: ${urls.length} (${paises.length} países × ${termos.length} termos)`);
  console.log(`Custo estimado: ~$${((urls.length * ADS_POR_BUSCA) / 1000 * 0.1).toFixed(2)} USD`);

  const items = await rodarScrape(client, actorId, urls);
  const enriched = enriquecerComContexto(items, urls);

  if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(OUTPUTS_DIR, `raw-${slugify(nicho)}-${ts}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      { meta: { nicho, paises, termos, actor: actorId, total: enriched.length, ts }, ads: enriched },
      null,
      2
    )
  );
  console.log(`Salvo: ${file}`);
  console.log(file); // última linha = path do arquivo, pra ser capturado por scripts encadeados
}

main().catch((e) => {
  console.error('Erro scrape:', e.message);
  process.exit(2);
});
