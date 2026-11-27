#!/usr/bin/env node
/**
 * Scrape Beta: por concorrente (URLs diretas), separando imagem e vídeo.
 *
 * Uso:
 *   node scrape-concorrentes.mjs --input concorrentes.json
 *
 *   concorrentes.json:
 *   [
 *     { "nome": "Marca X", "page_id": "12345", "country": "ALL" },
 *     { "nome": "Marca Y", "page_id": "67890", "country": "US" }
 *   ]
 *
 *   Ou via flags inline:
 *   node scrape-concorrentes.mjs --concorrentes "Marca X:12345:ALL,Marca Y:67890:US"
 *
 * Output: outputs/raw-concorrentes-{ts}.json
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
const ADS_POR_BUSCA = 200;
const TIPOS = ['image', 'video'];

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

function parseConcorrentesInline(str) {
  return str.split(',').map((s) => {
    const [nome, page_id, country = 'ALL'] = s.split(':').map((x) => x.trim());
    return { nome, page_id, country };
  });
}

function montarUrl({ page_id, country, media_type, active_status = 'active' }) {
  return `https://www.facebook.com/ads/library/?active_status=${active_status}&ad_type=all&country=${country}&view_all_page_id=${page_id}&media_type=${media_type}`;
}

async function descobrirActor(client) {
  for (const id of [ACTOR_PRIMARIO, ACTOR_FALLBACK]) {
    try {
      const a = await client.actor(id).get();
      if (a) return id;
    } catch {}
  }
  throw new Error('Nenhum actor de FB Ads Library acessível. Rode preflight.mjs.');
}

async function rodar(client, actorId, urls) {
  // Actor exige 1 URL por 512MB de RAM. Calcula memória pra todas as URLs num call só.
  // limitPerSource garante o cap individual por URL.
  // FIX 2026-08-11: o Apify só aceita POTÊNCIA DE 2 em memory. O cálculo antigo arredondava
  // pra múltiplo de 1024 e gerava 6144 com 12 URLs, derrubando o run com
  // "memoryMbytes needs to be a power of two". Era a dependência quebrada que deixou esta
  // skill parada em beta desde junho. Agora arredonda pra cima na potência de 2, teto de 8192.
  const memoryMb = Math.min(8192, Math.max(512, 2 ** Math.ceil(Math.log2(urls.length * 512))));
  const input = {
    urls: urls.map((u) => ({ url: u.url })),
    limitPerSource: ADS_POR_BUSCA,
    scrapeAdDetails: false
  };
  console.log(`Apify call: ${urls.length} URLs, limitPerSource=${ADS_POR_BUSCA}, memory=${memoryMb}MB`);
  const run = await client.actor(actorId).call(input, { timeout: 1200, memory: memoryMb });
  console.log(`Run ${run.id} — status ${run.status}`);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items;
}

async function main() {
  const args = parseArgs(process.argv);

  let concorrentes = [];
  if (args.input) {
    const p = path.isAbsolute(args.input) ? args.input : path.join(__dirname, args.input);
    concorrentes = JSON.parse(fs.readFileSync(p, 'utf8'));
  } else if (args.concorrentes) {
    concorrentes = parseConcorrentesInline(args.concorrentes);
  } else {
    console.error('Faltou --input ou --concorrentes');
    process.exit(1);
  }

  if (!process.env.APIFY_API_TOKEN) {
    console.error('APIFY_API_TOKEN ausente. Rode preflight.mjs.');
    process.exit(2);
  }

  const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
  const actorId = await descobrirActor(client);

  // Active status: 'active' (default) | 'all' (inclui inativos) | 'inactive'
  const activeStatus = args['active-status'] || 'active';

  // Montar todas as buscas: cada concorrente × cada tipo
  const buscas = [];
  for (const c of concorrentes) {
    for (const tipo of TIPOS) {
      buscas.push({
        url: montarUrl({ page_id: c.page_id, country: c.country || 'ALL', media_type: tipo, active_status: activeStatus }),
        meta: { ...c, media_type_solicitado: tipo }
      });
    }
  }
  console.log(`Active status: ${activeStatus}`);

  const custoEstimado = (buscas.length * ADS_POR_BUSCA / 1000 * 0.1).toFixed(2);
  console.log(`Total buscas: ${buscas.length} (${concorrentes.length} concorrentes × 2 tipos)`);
  console.log(`Custo Apify estimado: ~$${custoEstimado}`);

  const items = await rodar(client, actorId, buscas);
  console.log(`Recebidos ${items.length} ads brutos.`);

  // Distribuir ads de volta pra concorrente + tipo correto.
  // Estratégia: matchear por page_id no payload do ad.
  const indexPorPageId = new Map();
  for (const c of concorrentes) indexPorPageId.set(String(c.page_id), c);

  const byConcorrente = new Map();
  for (const c of concorrentes) {
    byConcorrente.set(c.page_id, { ...c, ads: { image: [], video: [] } });
  }

  for (const ad of items) {
    // Prioriza page_id do payload; cai pro hint do scrape se faltar
    const pageId = String(
      ad.page_id || ad.snapshot?.page_id || ad.advertiser?.id || ad._scrape_hint?.page_id || ''
    );
    const c = byConcorrente.get(pageId);
    if (!c) continue;
    // Atualiza nome real se o payload trouxer
    const nomeReal = ad.page_name || ad.snapshot?.page_name;
    if (nomeReal && c.nome.startsWith('Concorrente ')) c.nome = nomeReal;
    const fmt = detectarTipo(ad);
    if (fmt === 'image' || fmt === 'video') {
      c.ads[fmt].push(ad);
    }
  }

  // Salvar
  if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const out = {
    meta: {
      ts,
      concorrentes: concorrentes.length,
      total_ads: items.length,
      actor: actorId
    },
    concorrentes: [...byConcorrente.values()]
  };
  const file = path.join(OUTPUTS_DIR, `raw-concorrentes-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`Salvo: ${file}`);
  console.log(file);
}

function detectarTipo(ad) {
  if (ad.video_url || ad.snapshot?.video_url || ad.snapshot?.videos?.length) return 'video';
  if (ad.image_url || ad.snapshot?.image_url || ad.snapshot?.images?.length) return 'image';
  return 'desconhecido';
}

main().catch((e) => {
  console.error('Erro scrape-concorrentes:', e.message);
  process.exit(99);
});
