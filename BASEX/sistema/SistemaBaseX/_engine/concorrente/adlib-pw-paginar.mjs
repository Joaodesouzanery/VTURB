// Censo da Ad Library pelo CURSOR do GraphQL, em Chromium proprio (Playwright, sem tela,
// sem login), nunca pela porta 9222 do Chrome do usuario.
//
//   node adlib-pw-paginar.mjs --modo page --id <page_id> --pais IT --status all --saida x.json
//   node adlib-pw-paginar.mjs --modo busca --q <dominio> --tipo keyword_exact_phrase --pais US --saida x.json
//   node adlib-pw-paginar.mjs --url '<url completa da biblioteca>' --pais US --saida x.json
//
// Molde do primeiro pedido de paginacao e laco de cursor dentro da pagina,
// em Playwright isolado (nunca o Chrome do usuario).
// Copia do motor recriar-video-global; mudou la, copiar de novo para ca.
//
// Saida: { url, declarado, coletado_em, anuncios: [...] }. `declarado` e o "~N resultados"
// que a interface escreve (o numero do teste 2 da 119); `anuncios` e a lista de grupos com
// lid (ad_archive_id), ativo, inicio, fim, versoes (collation_count), destino, caption, corpo.
// --tipo: keyword_unordered (padrao) | keyword_exact_phrase (frase ou dominio, entre aspas).
// --url sobrepoe --modo: serve para filtro que o script nao monta e para teste local.
import { createRequire } from 'module';
import fs from 'fs';

function carregarPlaywright() {
  const bases = [process.env.PLAYWRIGHT_DIR, `${process.env.HOME}/.npm-global/node_modules/`, import.meta.url].filter(Boolean);
  for (const b of bases) {
    try { return createRequire(b.startsWith('file:') || b.endsWith('/') ? b : b + '/')('playwright'); } catch {}
  }
  console.log('playwright nao encontrado em: ' + bases.join(' | ') + ' (defina PLAYWRIGHT_DIR)');
  process.exit(3);
}
// headless shell instalado pelo Playwright; sem ele, o Playwright escolhe o navegador dele
function acharChromium() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const cache = `${process.env.HOME}/Library/Caches/ms-playwright`;
  try {
    const dirs = fs.readdirSync(cache).filter(d => /^chromium_headless_shell-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) for (const sub of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64']) {
      const exe = `${cache}/${d}/${sub}/chrome-headless-shell`;
      if (fs.existsSync(exe)) return exe;
    }
  } catch {}
  return undefined;
}

function arg(f, d) { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; }
const modo = arg('--modo', 'page');
const pid = arg('--id', null);
const q = arg('--q', null);
const pais = arg('--pais', 'BR');
const status = arg('--status', 'all');
const ordenar = arg('--ordenar', 'impressoes');
const maxPag = parseInt(arg('--paginas', '400'), 10);
const saida = arg('--saida', 'censo.json');
const tipo = arg('--tipo', 'keyword_unordered');
const urlArg = arg('--url', null);

const USO = 'uso: node adlib-pw-paginar.mjs --modo page --id <page_id> | --modo busca --q <termo> [--tipo keyword_exact_phrase] | --url <url>  [--pais IT] [--status all] [--paginas 400] [--saida x.json]';
if (!urlArg && !['page', 'busca'].includes(modo)) { console.log(`--modo invalido: ${modo}\n${USO}`); process.exit(1); }
if (!urlArg && modo === 'page' && !pid) { console.log(`--modo page exige --id <page_id>\n${USO}`); process.exit(1); }
if (!urlArg && modo === 'busca' && !q) { console.log(`--modo busca exige --q <termo>\n${USO}`); process.exit(1); }
if (!['keyword_unordered', 'keyword_exact_phrase'].includes(tipo)) { console.log(`--tipo invalido: ${tipo}\n${USO}`); process.exit(1); }

const sort = ordenar === 'impressoes' ? '&sort_data%5Bmode%5D=total_impressions&sort_data%5Bdirection%5D=desc' : '';
const url = urlArg ? urlArg : modo === 'page'
  ? `https://www.facebook.com/ads/library/?active_status=${status}&ad_type=all&country=${pais}&is_targeted_country=false&media_type=all&search_type=page${sort}&view_all_page_id=${pid}`
  : `https://www.facebook.com/ads/library/?active_status=${status}&ad_type=all&country=${pais}&is_targeted_country=false&media_type=all&q=${encodeURIComponent(tipo === 'keyword_exact_phrase' ? '"' + q + '"' : q)}&search_type=${tipo}${sort}`;

const { chromium } = carregarPlaywright();
const EXE = acharChromium();
const browser = await chromium.launch({ headless: true, ...(EXE ? { executablePath: EXE } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 2000 }, locale: 'pt-BR',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36' });
const page = await ctx.newPage();
let molde = null;
const primeiras = [];
page.on('request', r => {
  if (!molde && /\/api\/graphql/.test(r.url()) && /AdLibrarySearchPaginationQuery/.test(r.postData() || '')) molde = r.postData();
});
page.on('response', async r => {
  if (/\/api\/graphql/.test(r.url())) { try { primeiras.push(await r.text()); } catch {} }
});
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(12000);
// a página às vezes ainda não tem corpo aos 12 s (redirecionamento ou carga lenta): espera o body antes de ler
try { await page.waitForSelector('body', { timeout: 20000 }); } catch {}
const declarado = await page.evaluate(() => ((document.body ? document.body.innerText : '').match(/[~\d.,\s>]*\d+\s*(resultados?|results?)/i) || [''])[0]);
const login = await page.evaluate(() => /log in|entrar no facebook|fazer login/i.test((document.body ? document.body.innerText : '').slice(0, 1500)));
console.log('URL', url);
console.log('DECLARADO:', JSON.stringify(declarado), 'login_exigido=', login);
// HTML inicial tambem carrega o primeiro lote (ScheduledServerJS); guardar para varrer
const htmlInicial = await page.content();
for (let i = 0; i < 16 && !molde; i++) { await page.mouse.wheel(0, 2400); await page.waitForTimeout(1200); }

const achados = new Map();
function varrer(o, c) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { for (const x of o) varrer(x, c); return; }
  if (o.ad_archive_id || o.adArchiveID) {
    const snap = o.snapshot || {};
    c = { ...c,
      lid: String(o.ad_archive_id || o.adArchiveID),
      page_id: String(o.page_id || o.pageID || snap.page_id || c.page_id || ''),
      ativo: o.is_active ?? o.isActive ?? c.ativo ?? null,
      inicio: o.start_date || o.startDate || c.inicio || null,
      fim: o.end_date || o.endDate || c.fim || null,
      versoes: o.collation_count || o.collationCount || c.versoes || null,
      grupo: o.collation_id || o.collationID || c.grupo || null,
      plataformas: o.publisher_platform || o.publisherPlatform || c.plataformas || null,
      destino: snap.link_url || c.destino || null,
      caption: snap.caption || c.caption || null,
      corpo: (snap.body && (snap.body.text || (snap.body.markup && snap.body.markup.__html))) || c.corpo || null,
    };
    if (!achados.has(c.lid)) achados.set(c.lid, { ...c, hd: null, sd: null, imgs: [], capa: null,
      titulo: snap.title || null, descricao: snap.link_description || null, cta: snap.cta_text || null,
      formato: snap.display_format || null, pagina: snap.page_name || o.page_name || null,
      cards: Array.isArray(snap.cards) ? snap.cards.length : 0,
      likes: snap.page_like_count ?? null, card_links: Array.isArray(snap.cards) ? snap.cards.map(k => k.link_url).filter(Boolean).slice(0,3) : [], card_titles: Array.isArray(snap.cards) ? snap.cards.map(k => k.title).filter(Boolean).slice(0,3) : [], card_bodies: Array.isArray(snap.cards) ? snap.cards.map(k => k.body).filter(Boolean).slice(0,2) : [] });
  }
  if (c.lid && (o.original_image_url || o.resized_image_url || o.video_preview_image_url)) {
    const reg = achados.get(c.lid);
    if (reg) { const u = o.original_image_url || o.resized_image_url; if (u && !reg.imgs.includes(u)) reg.imgs.push(u);
      if (o.video_preview_image_url && !reg.capa) reg.capa = o.video_preview_image_url; }
  }
  const hd = o.video_hd_url, sd = o.video_sd_url;
  if ((hd || sd) && c.lid) { const reg = achados.get(c.lid); if (reg && !reg.hd && !reg.sd) { reg.hd = hd || null; reg.sd = sd || null; } }
  for (const k of Object.keys(o)) varrer(o[k], c);
}
function varrerTexto(txt) {
  for (const linha of String(txt).split('\n')) { const t = linha.trim(); if (!t.startsWith('{')) continue; try { varrer(JSON.parse(t), {}); } catch {} }
}
for (const t of primeiras) varrerTexto(t);
// primeiro lote embutido no HTML
for (const m of htmlInicial.matchAll(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)) { try { varrer(JSON.parse(m[1]), {}); } catch {} }
console.log('primeiro lote:', achados.size);
if (!molde) { console.log('sem molde de paginacao (acervo cabe na primeira pagina ou bloqueio)'); }

const pedir = async (cursor) => page.evaluate(async ({ corpo, cursor, pais }) => {
  const p = new URLSearchParams(corpo); const v = JSON.parse(p.get('variables'));
  v.cursor = cursor; v.first = 10; v.countries = [pais]; p.set('variables', JSON.stringify(v));
  const r = await fetch('/api/graphql/', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: p.toString() });
  return await r.text();
}, { corpo: molde, cursor, pais });

let cursor = null, pag = 0, semNovo = 0, motivo = 'sem molde de paginacao';
if (molde) {
  motivo = `teto de ${maxPag} paginas`;  // obs 0098: parar no teto e censo incompleto, nao teto da biblioteca
  // cursor inicial: o do proprio molde (segunda pagina), para nao repetir a primeira
  try { cursor = JSON.parse(new URLSearchParams(molde).get('variables')).cursor || null; } catch {}
  while (pag < maxPag) {
    let txt; try { txt = await pedir(cursor); } catch (e) { console.log('\nerro', e.message.slice(0,200)); await page.waitForTimeout(4000); try { txt = await pedir(cursor); } catch (e2) { console.log('erro2', e2.message.slice(0,200)); motivo = 'erro na paginacao'; break; } }
    if (typeof txt !== 'string') txt = JSON.stringify(txt || '');
    const antes = achados.size; varrerTexto(txt);
    const m = txt.match(/"end_cursor":"([^"]+)"/); const mais = /"has_next_page":true/.test(txt);
    pag++; process.stdout.write(` ${achados.size}`);
    if (achados.size === antes) semNovo++; else semNovo = 0;
    if (!m || !mais) { console.log(`\nfim (has_next_page=${mais})`); motivo = `has_next_page=${mais}`; break; }
    if (semNovo >= 4) { console.log('\nparou de trazer novo'); motivo = 'parou de trazer novo'; break; }
    cursor = m[1]; await page.waitForTimeout(900);
  }
}
const lista = [...achados.values()];
fs.writeFileSync(saida, JSON.stringify({ url, declarado, coletado_em: new Date().toISOString(), motivo_fim: motivo, anuncios: lista }, null, 1));
const viv = lista.filter(a => a.ativo === true).length;
const pg = {}; for (const a of lista) { const k = `${a.page_id}|${a.pagina}`; pg[k] = (pg[k] || 0) + 1; }
console.log(`\npaginas: ${pag} | grupos: ${lista.length} | vivos: ${viv} | versoes somadas: ${lista.reduce((s, a) => s + (a.versoes || 1), 0)} | com video: ${lista.filter(a => a.hd || a.sd).length}`);
if (/^(teto|erro)/.test(motivo)) console.log(`!!! censo INCOMPLETO (${motivo}): rodar de novo com --paginas maior; contagem abaixo do declarado nao e teto da biblioteca`);
console.log('por pagina:', JSON.stringify(Object.entries(pg).sort((a, b) => b[1] - a[1])));
await browser.close();
