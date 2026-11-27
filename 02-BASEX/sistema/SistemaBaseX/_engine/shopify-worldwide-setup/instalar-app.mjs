/**
 * Instala app da App Store. O "Instalar" da vitrine abre a tela de permissoes em ABA NOVA;
 * o segundo clique tem de ir NESSA aba. Clicar de novo na vitrine so empilha abas abertas
 * sem confirmar nada — foi assim que Klaviyo e SIHI "sumiram". Caso de uma loja de aluno, 08/11/2026.
 * Uso: CDP_PORT=<p> node instalar-app.mjs <loja> <handle>
 */
const PORTA = process.env.CDP_PORT || '9222';
const [loja, h] = process.argv.slice(2);
const listar = async () => (await (await fetch(`http://localhost:${PORTA}/json`)).json()).filter(t => t.type === 'page');
const conectar = async alvo => {
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0; const pend = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const cmd = (method, params = {}, ms = 25000) => new Promise((res, rej) => {
    const i = ++id; const t = setTimeout(() => { pend.delete(i); rej(new Error(method + ' timeout')); }, ms);
    pend.set(i, d => { clearTimeout(t); res(d); }); ws.send(JSON.stringify({ id: i, method, params })); });
  await cmd('Runtime.enable'); await cmd('Page.enable');
  return { cmd, fechar: () => ws.close() };
};
const acharBotao = async c => {
  const r = await c.cmd('Runtime.evaluate', { expression: `(() => {
    const achados = [];
    const varre = (raiz, prof=0) => { if (prof>10) return;
      for (const el of raiz.querySelectorAll('*')) {
        if (el.shadowRoot) varre(el.shadowRoot, prof+1);
        const t = (el.textContent||'').trim();
        if (/^(instalar|install|adicionar app)$/i.test(t) && el.matches('button,[role="button"]')) {
          const b = el.getBoundingClientRect(); if (b.width>0) achados.push({ x: Math.round(b.left+b.width/2), y: Math.round(b.top+b.height/2) });
        } } };
    varre(document);
    return JSON.stringify(achados[0] || null);
  })()`, returnByValue: true, awaitPromise: false });
  return JSON.parse(r.result?.result?.value || 'null');
};
const clicar = async (c, pos) => { for (const tipo of ['mouseMoved','mousePressed','mouseReleased'])
  await c.cmd('Input.dispatchMouseEvent', { type: tipo, x: pos.x, y: pos.y, button: 'left', clickCount: 1 }); };

// 1. vitrine
let abas = await listar();
const vitrine = await conectar(abas[0]);
await vitrine.cmd('Page.navigate', { url: `https://apps.shopify.com/${h}?shop=${loja}` });
await new Promise(r => setTimeout(r, 11000));
const antes = (await listar()).map(t => t.id);
const b1 = await acharBotao(vitrine);
if (!b1) { console.log(`[${h}] ja instalado (sem botao na vitrine)`); vitrine.fechar(); process.exit(0); }
await clicar(vitrine, b1);
console.log(`[${h}] vitrine: clicado`);
vitrine.fechar();

// 2. a aba nova e a tela de permissoes
let nova = null;
for (let i = 0; i < 16 && !nova; i++) {
  await new Promise(r => setTimeout(r, 1500));
  nova = (await listar()).find(t => !antes.includes(t.id) && /admin\.shopify\.com/.test(t.url));
}
if (!nova) { console.log(`[${h}] a tela de permissoes nao abriu em aba nova`); process.exit(1); }
await new Promise(r => setTimeout(r, 6000));
const perm = await conectar(nova);
const b2 = await acharBotao(perm);
if (!b2) { console.log(`[${h}] aba de permissoes sem botao Instalar`); perm.fechar(); process.exit(1); }
await clicar(perm, b2);
console.log(`[${h}] permissoes: confirmado`);
await new Promise(r => setTimeout(r, 12000));
const fim = await perm.cmd('Runtime.evaluate', { expression: 'location.href.slice(0,80)', returnByValue: true });
console.log(`[${h}] fim: ${fim.result?.result?.value}`);
perm.fechar();
