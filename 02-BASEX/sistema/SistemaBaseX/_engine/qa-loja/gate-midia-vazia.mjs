/**
 * Gate: section LIGADA com a midia vazia, que a vitrine desenha como ilustracao de placeholder
 * (ou como cartao preto, no caso de video).
 *
 * Existe porque o gate-imagens-tema so acha referencia MORTA. Midia em branco nao e referencia
 * nenhuma, e o tema desenha o placeholder do mesmo jeito. Caso uma loja de vestuário, 07/11/2026,
 * tema pronto da casa: topo das 40 colecoes (ec-collection-top sem imagem reserva), "Worn by our
 * customers" com 6 camisetas de placeholder e @nomes do molde, "See it in motion" com 4 cartoes
 * pretos, multicolumn com show_placeholders ligado e Our Story com "Write here..." do molde.
 * Tudo com pagina 200 e zero erro de console.
 *
 * Uso: node gate-midia-vazia.mjs <loja> [--tema=<id>]   (sem --tema: o tema publicado)
 *      node gate-midia-vazia.mjs --dir=<pasta do tema>     (antes do push, sem API)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const flag = (n) => (process.argv.find(a => a.startsWith(`--${n}=`)) || '').split('=')[1];
const MIDIA = new Set(['image_picker', 'video', 'video_url']);
const FONTE = new Set(['collection', 'product']); // bloco que puxa a foto de uma colecao/produto escolhido nao esta vazio
const arq = {}; let t = { name: flag('dir') };
if (flag('dir')) {
  for (const p of ['templates', 'sections', 'snippets']) if (existsSync(`${flag('dir')}/${p}`))
    for (const f of readdirSync(`${flag('dir')}/${p}`)) { try { arq[`${p}/${f}`] = readFileSync(`${flag('dir')}/${p}/${f}`, 'utf8'); } catch {} }
} else {
  const { tokenDaLoja, criaGql } = await import('./lib.mjs');
  const gql = criaGql(await tokenDaLoja(process.argv[2]));
  t = flag('tema') ? { id: `gid://shopify/OnlineStoreTheme/${flag('tema')}`, name: flag('tema') }
    : (await gql(`{ themes(first:5, roles:[MAIN]){ nodes{ id name } } }`)).themes.nodes[0];
  let cur = null;
  do {
    const r = await gql(`query($id:ID!,$c:String){ theme(id:$id){ files(first:250, after:$c){ pageInfo{hasNextPage endCursor} nodes{ filename body{ ... on OnlineStoreThemeFileBodyText { content } } } } } }`, { id: t.id, c: cur });
    for (const f of r.theme.files.nodes) if (f.body?.content != null) arq[f.filename] = f.body.content;
    cur = r.theme.files.pageInfo.hasNextPage ? r.theme.files.pageInfo.endCursor : null;
  } while (cur);
}

const json = (txt) => JSON.parse(txt.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
const schema = (tipo) => {
  const liq = arq[`sections/${tipo}.liquid`]; if (!liq) return null;
  const m = liq.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema/);
  try { return m ? { sc: JSON.parse(m[1]), liq } : null; } catch { return null; }
};
const MOLDE = /Write here|Lorem ipsum|\[[A-ZÁÉÍÓÚÇÃÕ][A-ZÁÉÍÓÚÇÃÕ _,.:%-]{3,}\]/;

const achados = [];
for (const [nome, txt] of Object.entries(arq)) {
  if (!/^(templates\/.*|sections\/.*-group)\.json$/.test(nome)) continue;
  let d; try { d = json(txt); } catch { continue; }
  for (const [sid, s] of Object.entries(d.sections || {})) {
    const st = s.settings || {};
    if (s.disabled || st.enable_section === false) continue;
    const x = schema(s.type); if (!x) continue;
    const snips = [...x.liq.matchAll(/{%-?\s*render\s+'([^']+)'/g)].map(m => arq[`snippets/${m[1]}.liquid`] || '');
    const desenhaPh = [x.liq, ...snips].some(l => /placeholder_svg_tag/.test(l)); // o placeholder pode morar no snippet que a section renderiza
    const chavePh = /show_placeholders/.test(x.liq); // aqui o placeholder so sai com a chave ligada
    const smid = (x.sc.settings || []).filter(o => MIDIA.has(o.type)).map(o => o.id);
    const bmid = Object.fromEntries((x.sc.blocks || []).filter(b => b.type).map(b => [b.type, (b.settings || []).filter(o => MIDIA.has(o.type)).map(o => o.id)]));
    const bfonte = Object.fromEntries((x.sc.blocks || []).filter(b => b.type).map(b => [b.type, (b.settings || []).filter(o => FONTE.has(o.type)).map(o => o.id)]));
    const ativos = Object.values(s.blocks || {}).filter(b => !b.disabled);
    const blocos = ativos.filter(b => bmid[b.type]?.length);
    const bVazios = blocos.filter(b => ![...bmid[b.type], ...(bfonte[b.type] || [])].some(k => b.settings?.[k]));
    const soMidia = blocos.length === ativos.length; // section de midia (cards, slides); main-product e afins tem midia opcional
    const sVazia = smid.length && !smid.some(k => st[k]);
    const temVideo = (x.sc.blocks || []).some(b => (b.settings || []).some(o => o.type === 'video' || o.type === 'video_url'));
    const molde = MOLDE.test(JSON.stringify(s)) ? ' + texto de molde' : '';
    let motivo = '';
    if (chavePh) { if (st.show_placeholders === true && bVazios.length) motivo = `show_placeholders ligado com ${bVazios.length} bloco(s) sem imagem`; }
    else if (soMidia && blocos.length && bVazios.length === blocos.length && (desenhaPh || temVideo)) motivo = `todos os ${blocos.length} blocos de midia vazios${temVideo ? ' (video vazio vira cartao preto)' : ''}`;
    else if (sVazia && !blocos.length && desenhaPh) motivo = `midia da section vazia (${smid.join(', ')})`;
    if (motivo) achados.push(`${nome} [${sid}] ${s.type}: ${motivo}${molde}`);
  }
}
console.log(`[gate-midia] tema ${t.name}: ${Object.keys(arq).length} arquivos lidos`);
if (!achados.length) { console.log('[gate-midia] VERDE: nenhuma section ligada com midia vazia'); process.exit(0); }
console.log(`[gate-midia] VERMELHO: ${achados.length} sections ligadas com midia vazia (placeholder ou cartao preto na vitrine)`);
console.log('  Conserto: imagem reserva da marca, ou enable_section:false / disabled ate ter midia real. Confira na vitrine: svg viewBox 525.5 ou classe *__ph.');
achados.forEach(a => console.log('  ' + a));
process.exit(1);
