/**
 * Gate: o material que a DESCRICAO declara bate com a colecao/tag de linha?
 * O titulo e nome de cidade (Chania, Varna...), entao so a descricao denuncia.
 * Caso uma loja 07/11/2026: bolsa de poliester acolchoado dentro de "vegan-leather-bags" com tag line-leather.
 * Linho: conjunto de poliester classificado como linho (uma loja 07/11/2026).
 * Uso: node gate-material.mjs <loja>
 */
import { tokenDaLoja, criaGql } from './lib.mjs';
const gql = criaGql(await tokenDaLoja(process.argv[2]));
// PVC/PU sao couro vegano e ficam na mesma prateleira do natural (decisao da casa, 07/11/2026):
// o gate so acusa material que nao e couro de especie nenhuma.
const NAO_COURO = /\b(polyester|poliéster|nylon|puffer|quilted|canvas|straw|raffia|crochet|jelly|acrylic|cotton)\b/i;
const COURO = /\b(leather|couro|suede|camurça|camurca|pvc|pu)\b/i;
let cur = null, ruins = [], n = 0;
do {
  const r = await gql(`query($c:String){ products(first:100, after:$c){ pageInfo{hasNextPage endCursor} nodes{ handle title tags descriptionHtml
    collections(first:20){ nodes{ handle } } } } }`, { c: cur });
  for (const p of r.products.nodes) {
    n++;
    const d = p.descriptionHtml.replace(/<[^>]+>/g, ' ');
    const colCouro = p.collections.nodes.map(c => c.handle).filter(h => /leather|couro|suede|camurca/i.test(h));
    const tagCouro = p.tags.filter(t => /leather|couro|suede/i.test(t));
    const mat = (d.match(NAO_COURO) || [])[0];
    // material nao-couro declarado E classificado como couro, sem couro na descricao
    if (mat && (colCouro.length || tagCouro.length) && !COURO.test(d))
      ruins.push(`${p.handle} | "${p.title}" | material=${mat} | colecoes=${colCouro.join(',')||'-'} | tags=${tagCouro.join(',')||'-'}`);
    // linho (uma loja 07/11/2026): conjunto 100% poliester entrou em 3 colecoes de linho pelo tipo "Linen Sets" do fornecedor;
    // mistura com linho (30% linen, cotton-linen) fica, so acusa quando a descricao nao cita linho nenhum
    const colLinho = p.collections.nodes.map(c => c.handle).filter(h => /linen|linho/i.test(h));
    const tagLinho = p.tags.filter(t => /linen|linho/i.test(t));
    const sint = (d.match(/\b(polyester|poliéster|acrylic|acrílico|nylon)\b/i) || [])[0];
    if (sint && (colLinho.length || tagLinho.length || /linen|linho/i.test(p.title)) && !/\blinen\b|linho/i.test(d))
      ruins.push(`${p.handle} | "${p.title}" | material=${sint} sem linho | colecoes=${colLinho.join(',')||'-'} | tags=${tagLinho.join(',')||'-'}`);
  }
  cur = r.products.pageInfo.hasNextPage ? r.products.pageInfo.endCursor : null;
} while (cur);
console.log(`[gate-material] ${n} produtos conferidos`);
if (!ruins.length) { console.log('[gate-material] VERDE'); process.exit(0); }
console.log(`[gate-material] VERMELHO: ${ruins.length} com material em conflito com a classificacao`);
ruins.forEach(r => console.log('  ' + r));
process.exit(1);
