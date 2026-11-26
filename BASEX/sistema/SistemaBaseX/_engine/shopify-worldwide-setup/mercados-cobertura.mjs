// Garante cobertura mundial de mercados: cria Brazil e um catch-all Worldwide com todo pais nao coberto.
// Sem isso, visitante de pais sem mercado ve a loja INTEIRA como "esgotado" (07/11/2026).
// Uso: node mercados-cobertura.mjs <loja> [--aplicar]
import { tokenDaLoja, criaGql } from './lib.mjs';
const loja = process.argv[2], aplicar = process.argv.includes('--aplicar');
const gql = criaGql(await tokenDaLoja(loja));

const todos = (await gql(`{ __type(name:"CountryCode"){ enumValues{name} } }`)).__type.enumValues
  .map(e => e.name).filter(c => c !== 'XX' && c.length === 2);

const q = await gql(`{ markets(first:50){ nodes{ id name handle status
  conditions{ regionsCondition{ regions(first:250){ nodes{ ... on MarketRegionCountry { code } } } } } } } }`);
const cobertos = new Set(q.markets.nodes.flatMap(m => m.conditions?.regionsCondition?.regions?.nodes?.map(r => r.code) || []));
const faltam = todos.filter(c => !cobertos.has(c));

console.log(`[mercados] ${q.markets.nodes.length} mercados, ${cobertos.size} paises cobertos de ${todos.length}`);
console.log(`[mercados] SEM mercado: ${faltam.length} paises ${faltam.includes('BR') ? '(Brasil entre eles)' : ''}`);
// a Shopify recusa estes: faltarem nao e defeito, e o teto do que da pra cobrir
const RECUSADOS = ['BV','CU','HM','IR','KP','AN','SY','ZZ'];
const reais = faltam.filter(c => !RECUSADOS.includes(c));
if (!reais.length) {
  console.log(`[mercados] VERDE: cobertura completa${faltam.length ? ` (faltam so os que a Shopify recusa: ${faltam.join(',')})` : ''}`);
  process.exit(0);
}
if (!aplicar) {
  console.log(`[mercados] dry-run. Criaria:${reais.includes('BR') ? ' Brazil (BR) +' : ''} Worldwide (${reais.filter(c => c !== 'BR').length} paises)`);
  process.exit(0);
}

// A Shopify recusa pais sob embargo/territorio sem envio (CU, IR, KP, SY, BV, HM, AN, ZZ...).
// A lista varia com o tempo, entao o criar() tira do lote o que a API apontar e tenta de novo.
const criar = async (nome, handle, paises) => {
  let lote = [...paises];
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    const r = await gql(`mutation($i:MarketCreateInput!){ marketCreate(input:$i){ market{ id name handle status } userErrors{ field message } } }`,
      { i: { name: nome, handle, status: 'ACTIVE', conditions: { regionsCondition: { regions: lote.map(c => ({ countryCode: c })) } } } });
    const e = r.marketCreate.userErrors;
    if (!e.length) { console.log(`[mercados] criado ${r.marketCreate.market.name} (${lote.length} paises${lote.length < paises.length ? `, ${paises.length - lote.length} recusados pela Shopify` : ''})`); return true; }
    const idx = e.map(x => Number(x.field?.[4])).filter(n => Number.isInteger(n));
    if (!idx.length) { console.log(`[mercados] ERRO ${nome}: ${JSON.stringify(e)}`); return false; }
    console.log(`[mercados] ${nome}: Shopify recusou ${idx.map(i => lote[i]).join(',')} - refazendo sem eles`);
    lote = lote.filter((_, i) => !idx.includes(i));
  }
  console.log(`[mercados] ERRO ${nome}: 4 tentativas sem sucesso`); return false;
};

if (reais.includes('BR')) await criar("Brazil", "brazil", ['BR']);
const resto = reais.filter(c => c !== 'BR');
if (resto.length) await criar("Worldwide", "worldwide", resto);
