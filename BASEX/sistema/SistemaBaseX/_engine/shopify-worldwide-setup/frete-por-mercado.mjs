/**
 * Liga o frete DENTRO de cada mercado (modelo novo "frete gerenciado por Mercados").
 *
 * Existe porque: lojas migradas para esse modelo ignoram as zonas do perfil de entrega.
 * Mercado sem opcao de frete deixa TODO produto fisico como "esgotado" na vitrine
 * (o digital continua vendendo), com o Admin 100% verde. Caso de uma loja de aluno, 07/11/2026.
 *
 * Uso: node frete-por-mercado.mjs <loja> [--aplicar]
 */
// marketUpdate.delivery so existe de 2026-07 em diante; o import e dinamico porque
// a lib le a versao do ambiente no momento em que e carregada.
process.env.SHOPIFY_API_VERSION ||= '2026-07';
const { tokenDaLoja, criaGql } = await import('./lib.mjs');
const loja = process.argv[2], aplicar = process.argv.includes('--aplicar');
const gql = criaGql(await tokenDaLoja(loja));

const GENERICO = ['Standard Tracked Delivery', 'Priority Express Delivery'];
const PADRAO = 0, EXPRESSO = 7.9;

const MOEDA = (await gql(`{ shop{ currencyCode } }`)).shop.currencyCode;
// locais so no --aplicar: token sem read_locations (07/11/2026) quebrava ate o diagnostico
let locais = [];
if (aplicar) {
  const L = await gql(`{ locations(first:10){ nodes{ id isActive fulfillsOnlineOrders } } }`);
  locais = L.locations.nodes.filter(l => l.isActive && l.fulfillsOnlineOrders).map(l => l.id);
  if (!locais.length) { console.error('[frete-mkt] nenhum local ativo que cumpra pedido online'); process.exit(1); }
}

// nomes de transportadora que ja existem nas zonas do perfil, por pais
const perfil = await gql(`{ deliveryProfiles(first:5){ nodes{ default profileLocationGroups{
  locationGroupZones(first:60){ nodes{ zone{ countries{ code{ countryCode restOfWorld } } }
    methodDefinitions(first:5){ nodes{ name rateProvider{ ... on DeliveryRateDefinition { price{amount} } } } } } } } } } }`);
const porPais = {};
for (const g of perfil.deliveryProfiles.nodes.find(p => p.default)?.profileLocationGroups || [])
  for (const z of g.locationGroupZones.nodes) {
    const nomes = z.methodDefinitions.nodes.sort((a,b) => (+a.rateProvider?.price?.amount||0) - (+b.rateProvider?.price?.amount||0)).map(m => m.name);
    for (const c of z.zone.countries) if (!c.code.restOfWorld && nomes.length === 2) porPais[c.code.countryCode] = nomes;
  }

const mk = await gql(`{ markets(first:50){ nodes{ id name status
  conditions{ regionsCondition{ regions(first:250){ nodes{ ... on MarketRegionCountry { code } } } } }
  delivery{ shipping{ isEnabled optionDefinitions(first:10){ nodes{ id isActive includedLocations(first:1){ nodes{ id } } } } } } } } }`);

let mudados = 0;
for (const m of mk.markets.nodes) {
  const paises = m.conditions?.regionsCondition?.regions?.nodes?.map(r => r.code) || [];
  const opcs = m.delivery?.shipping?.optionDefinitions?.nodes || [];
  const jaTem = m.delivery?.shipping?.isEnabled && opcs.some(o => o.isActive && o.includedLocations?.nodes?.length);
  const nomes = (paises.length === 1 && porPais[paises[0]]) || GENERICO;
  if (jaTem) { console.log(`[frete-mkt] ${m.name}: ja tem frete, pulo`); continue; }
  console.log(`[frete-mkt] ${m.name} (${paises.length} paises) -> ${nomes[0]} ${MOEDA}${PADRAO} | ${nomes[1]} ${MOEDA}${EXPRESSO}`);
  mudados++;
  if (!aplicar) continue;
  const opc = (nome, preco) => ({ flatRate: { name: nome, isActive: true, currency: MOEDA,
    rateGroups: [{ rate: { price: { amount: preco, currencyCode: MOEDA } }, conditions: { originLocationsToAdd: locais } }] } });
  const r = await gql(`mutation($id:ID!,$i:MarketUpdateInput!){ marketUpdate(id:$id, input:$i){ userErrors{ field message } } }`, {
    id: m.id, i: { delivery: { shipping: { isEnabled: true,
      optionDefinitionsToDelete: m.delivery?.shipping?.optionDefinitions?.nodes?.map(o => o.id) || [],
      optionDefinitionsToCreate: [opc(nomes[0], PADRAO), opc(nomes[1], EXPRESSO)] } } } });
  if (r.marketUpdate.userErrors.length) console.log(`[frete-mkt]   ERRO: ${JSON.stringify(r.marketUpdate.userErrors)}`);
}
console.log(`[frete-mkt] ${mudados} mercados ${aplicar ? 'configurados' : 'a configurar (dry-run)'} de ${mk.markets.nodes.length}`);
