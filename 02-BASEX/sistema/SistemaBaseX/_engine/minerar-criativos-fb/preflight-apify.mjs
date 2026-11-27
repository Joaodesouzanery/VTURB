#!/usr/bin/env node
/**
 * Preflight da skill minerar-criativos-fb.
 * Valida APIFY_API_TOKEN, conectividade do Apify, presença de actor.
 * Sai com código != 0 se algo crítico estiver faltando.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { ApifyClient } from 'apify-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const ACTOR_PRIMARIO = 'curious_coder/facebook-ads-library-scraper';
const ACTOR_FALLBACK = 'apify/facebook-ads-library-scraper';

function log(level, msg) {
  const tag = { ok: '✓', warn: '⚠', err: '✗', info: 'ℹ' }[level] || '·';
  console.log(`${tag} ${msg}`);
}

async function main() {
  log('info', 'Preflight: minerar-criativos-fb');

  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    log('err', 'APIFY_API_TOKEN ausente em _engine/.env');
    console.log('');
    console.log('Como resolver:');
    console.log('  1. Criar conta em https://apify.com (free tier dá $5/mês)');
    console.log(`  2. Ir no actor https://apify.com/${ACTOR_PRIMARIO}`);
    console.log('  3. Clicar "Try for free" para vincular à sua conta');
    console.log('  4. Settings → Integrations → API tokens → copiar o token');
    console.log('  5. Colar em _engine/.env como: APIFY_API_TOKEN=apify_api_xxx');
    console.log('');
    process.exit(1);
  }
  log('ok', `APIFY_API_TOKEN encontrado (${token.slice(0, 12)}...)`);

  const client = new ApifyClient({ token });

  try {
    const user = await client.user().get();
    log('ok', `Apify conectado: ${user.username} (plan: ${user.plan || 'free'})`);
  } catch (e) {
    log('err', `Token inválido ou rede indisponível: ${e.message}`);
    process.exit(2);
  }

  let actorEscolhido = null;
  for (const actorId of [ACTOR_PRIMARIO, ACTOR_FALLBACK]) {
    try {
      const actor = await client.actor(actorId).get();
      if (actor) {
        actorEscolhido = actorId;
        log('ok', `Actor disponível: ${actorId}`);
        break;
      }
    } catch (e) {
      log('warn', `Actor ${actorId} não disponível: ${e.message}`);
    }
  }

  if (!actorEscolhido) {
    log('err', 'Nenhum actor de FB Ads Library acessível.');
    console.log('');
    console.log('Como resolver: acessar um destes e clicar em "Try for free":');
    console.log(`  - https://apify.com/${ACTOR_PRIMARIO}`);
    console.log(`  - https://apify.com/${ACTOR_FALLBACK}`);
    process.exit(3);
  }

  log('info', 'Pre-flight OK. Pode rodar scrape.mjs.');
  console.log('');
  console.log(`Actor que será usado: ${actorEscolhido}`);
}

main().catch((e) => {
  log('err', `Erro inesperado: ${e.message}`);
  process.exit(99);
});
