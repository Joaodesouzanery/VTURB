/**
 * Gate: toda referencia de imagem do tema resolve num arquivo que existe na loja?
 *
 * Existe porque o rebrand textual (marca-antiga->marca-nova) renomeia a REFERENCIA
 * (shopify://shop_images/..., cdn.shopify.com/...) sem renomear o arquivo.
 * A referencia morta nao da erro: o Dawn desenha o PLACEHOLDER de ilustracao,
 * ou o <img> fica com icone quebrado. Caso uma loja, 07/11/2026.
 *
 * Uso: node gate-imagens-tema.mjs <loja> [--corrigir]
 */
import { tokenDaLoja, criaGql } from './lib.mjs';
const loja = process.argv[2], corrigir = process.argv.includes('--corrigir');
const gql = criaGql(await tokenDaLoja(loja));

// 1. arquivos que a loja tem
const arquivos = new Map(); let c = null;
do {
  const r = await gql(`query($c:String){ files(first:250, after:$c){ pageInfo{hasNextPage endCursor} nodes{ ... on MediaImage { image{ url } } } } }`, { c });
  for (const f of r.files.nodes) { const u = f.image?.url; if (u) arquivos.set(decodeURIComponent(u.replace(/.*\/files\//, '').split('?')[0]), u); }
  c = r.files.pageInfo.hasNextPage ? r.files.pageInfo.endCursor : null;
} while (c);
const cdnLoja = [...arquivos.values()][0]?.match(/files\/1\/\d+\/\d+\/\d+/)?.[0] || '';

// 2. arquivos do tema
const t = (await gql(`{ themes(first:5, roles:[MAIN]){ nodes{ id name } } }`)).themes.nodes[0];
let cur = null, tema = [];
do {
  const r = await gql(`query($id:ID!,$c:String){ theme(id:$id){ files(first:250, after:$c){ pageInfo{hasNextPage endCursor} nodes{ filename body{ ... on OnlineStoreThemeFileBodyText { content } } } } } }`, { id: t.id, c: cur });
  tema.push(...r.theme.files.nodes); cur = r.theme.files.pageInfo.hasNextPage ? r.theme.files.pageInfo.endCursor : null;
} while (cur);

// 3. confronto
const mortas = [];
for (const f of tema) {
  const txt = f.body?.content; if (!txt) continue;
  for (const m of txt.matchAll(/shopify:\/\/shop_images\/([^"'\s)]+)/g)) {
    const nome = decodeURIComponent(m[1]);
    if (!arquivos.has(nome)) mortas.push({ arquivo: f.filename, tipo: 'shopify://', ref: nome, linha: m[0] });
  }
  for (const m of txt.matchAll(/https?:\/\/cdn\.shopify\.com\/s\/(files\/1\/\d+\/\d+\/\d+)\/files\/([^"'\s)?]+)/g)) {
    const nome = decodeURIComponent(m[2]);
    if (m[1] !== cdnLoja) mortas.push({ arquivo: f.filename, tipo: 'CDN de OUTRA loja', ref: nome, linha: m[0] });
    else if (!arquivos.has(nome)) mortas.push({ arquivo: f.filename, tipo: 'CDN, arquivo sumido', ref: nome, linha: m[0] });
  }
}
console.log(`[gate-img] loja tem ${arquivos.size} arquivos | tema ${t.name}: ${tema.length} arquivos | CDN ${cdnLoja}`);
if (!mortas.length) { console.log('[gate-img] VERDE: toda referencia de imagem resolve'); process.exit(0); }
console.log(`[gate-img] VERMELHO: ${mortas.length} referencias mortas (viram placeholder ou icone quebrado)`);
const sug = n => { // acha arquivo equivalente trocando so o prefixo de marca
  const base = n.replace(/^[a-z0-9]+-/i, '');
  return [...arquivos.keys()].find(k => k === n) || [...arquivos.keys()].find(k => k.replace(/^[a-z0-9]+-/i, '') === base) || null;
};
for (const m of mortas) console.log(`  ${m.arquivo} [${m.tipo}] ${m.ref}  -> existe na loja: ${sug(m.ref) || 'NAO ACHEI EQUIVALENTE'}`);
process.exit(1);
