#!/usr/bin/env node
// Pre-flight de auditar-pixel. Roda ANTES de abrir o navegador e já adianta
// metade do diagnóstico: a loja responde, é Shopify, tem pixel no HTML e
// tem banner de consentimento. O que só o navegador prova (disparo de evento
// e parâmetros) fica para a skill.
import { exigir, node20, encerrar, falhas } from "../_shared/preflight-util.mjs";

node20();

const alvo = process.argv[2];
exigir(alvo, "url da loja não informada", "node preflight.mjs <url-da-loja> [pixel-id-esperado]");
if (falhas.length) encerrar("auditar-pixel");

const url = /^https?:\/\//i.test(alvo) ? alvo : `https://${alvo}`;
const esperado = process.argv[3] || null;
const log = (m) => process.stderr.write(`  · ${m}\n`);

let html = "";
try {
  const r = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36" },
    signal: AbortSignal.timeout(20000),
  });
  exigir(r.ok, `a loja respondeu ${r.status}`, "conferir se o domínio está no ar e é o público");
  html = await r.text();
} catch (e) {
  exigir(false, `não foi possível abrir ${url}: ${e.message}`, "conferir o domínio, ou rodar de novo se for instabilidade");
}
if (falhas.length) encerrar("auditar-pixel");

// Shopify? Não bloqueia, mas muda o que a skill consegue percorrer.
const shopify = /cdn\.shopify\.com|Shopify\.theme|shopifycloud/i.test(html);
log(shopify ? "plataforma: Shopify" : "plataforma: não parece Shopify, os passos de carrinho podem falhar");

// Pixel no HTML. Presença aqui é indício, não prova de disparo.
const ids = [...new Set([
  ...[...html.matchAll(/fbq\(\s*['"]init['"]\s*,\s*['"](\d{8,20})['"]/g)].map(m => m[1]),
  ...[...html.matchAll(/connect\.facebook\.net\/signals\/config\/(\d{8,20})/g)].map(m => m[1]),
  ...[...html.matchAll(/facebook\.com\/tr\?id=(\d{8,20})/g)].map(m => m[1]),
])];

if (ids.length === 0) {
  log("nenhum pixel no HTML inicial. Pode ser injeção via app, consentimento ou envio pelo servidor: só o navegador conclui");
  if (/web-pixels-manager/i.test(html)) {
    log("a loja usa Web Pixels da Shopify: o pixel roda em sandbox, então `fbq` não aparece no HTML nem em window. Isso é o normal, não é pixel ausente. A prova é a rede (facebook.com/tr)");
  }
} else {
  log(`pixel no HTML: ${ids.join(", ")}`);
  if (ids.length > 1) log(`ATENÇÃO: ${ids.length} pixels diferentes. Contaminação de público é candidata a achado`);
  if (esperado && !ids.includes(String(esperado))) {
    log(`ATENÇÃO: o esperado ${esperado} não está no HTML. Confirmar no navegador antes de concluir`);
  }
}

// Consentimento muda o resultado: a skill terá que auditar nos dois estados.
if (/pandectes|cookieyes|cookiebot|osano|termly|consentmo|gdpr/i.test(html)) {
  log("banner de consentimento detectado: auditar aceitando e sem aceitar");
}

// Conversions API server-side: sem isso a ausência de evento no navegador não é veredito.
if (/getelevar|elevardatalayer|triplewhale|facebookCapiEnabled"?\s*:\s*"?true|conversions[_ -]?api/i.test(html)) {
  log("indício de rastreamento server-side: ausência de evento no navegador NÃO conclui nada sozinha");
}

encerrar("auditar-pixel");
