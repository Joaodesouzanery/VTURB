// Prévia do site de cada referência para a Central: a home no computador e no celular e a página do produto principal no celular.
//
//   node _engine/concorrente/previa.mjs "<pasta da operação>" [domínio ...]
//
// Sem domínio, faz todas as pastas de 02 Raio-X. O produto principal sai do loja.json (pdp.link), que o raio-x grava.
// Grava 02 Raio-X/<domínio>/previa/{home,home_celular,pdp_celular}.jpg. Navegador próprio, sem tela e sem login.
// Depois, rode o central.py de novo.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

// cópia de adlib-pw-paginar.mjs: o mesmo Playwright e o mesmo navegador de coleta que o pre-voo instala
function carregarPlaywright() {
  const bases = [process.env.PLAYWRIGHT_DIR, `${process.env.HOME}/.npm-global/node_modules/`, import.meta.url].filter(Boolean);
  for (const b of bases) {
    try { return createRequire(b.startsWith('file:') || b.endsWith('/') ? b : b + '/')('playwright'); } catch {}
  }
  console.log('playwright nao encontrado em: ' + bases.join(' | ') + ' (rode python3 _engine/concorrente/preflight.py --instalar)');
  process.exit(3);
}
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

const args = process.argv.slice(2);
const mercado = args.includes('--mercado');          // só a home no celular das lojas do Mercado, para escolher Usar ou Descartar
const [op, ...pedidos] = args.filter(a => a !== '--mercado');
if (!op) { console.log('uso: node previa.mjs "<pasta da operação>" [domínio ...] [--mercado]'); process.exit(1); }
const raiz = mercado ? path.join(path.resolve(op), '01 Mineração') : path.join(path.resolve(op), '02 Raio-X');
let doms;
if (mercado) {
  const mn = JSON.parse(fs.readFileSync(path.join(raiz, 'concorrentes.json'), 'utf8'));
  doms = pedidos.length ? pedidos : (mn.lojas || []).map(l => l.dominio);
} else doms = pedidos.length ? pedidos : fs.readdirSync(raiz).filter(d => fs.statSync(path.join(raiz, d)).isDirectory());
const CEL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };
const PC = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };

const { chromium } = carregarPlaywright();
const navegador = await chromium.launch({ headless: true, executablePath: acharChromium() });
let falhas = 0, tentadas = 0;
for (const dom of doms) {
  const pasta = mercado ? raiz : path.join(raiz, dom);
  let loja = {};
  try { loja = JSON.parse(fs.readFileSync(path.join(pasta, 'loja.json'), 'utf8')); } catch {}
  const fotos = mercado ? [[dom, `https://${dom}/`, CEL, 1800]]
    : [['home', `https://${dom}/`, PC, 2600], ['home_celular', `https://${dom}/`, CEL, 2600],
      ['pdp_celular', (loja.pdp || {}).link, CEL, 3400]].filter(f => f[1]);
  fs.mkdirSync(path.join(pasta, 'previa'), { recursive: true });
  for (const [nome, url, perfil, altura] of fotos) {
    tentadas++;
    const ctx = await navegador.newContext({ ...perfil, locale: 'en-US' });
    const pg = await ctx.newPage();
    try {
      const resp = await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      // 429 da loja (limite de leitura) renderiza uma página de erro: print dela não é prévia (05/11/2026)
      if (resp && resp.status() >= 400) throw new Error(`HTTP ${resp.status()}`);
      await pg.waitForTimeout(3000);
      // loja que barra visitante automático redireciona (byepoch.com foi parar no Google, 03/11/2026): prévia de outro site não serve
      const host = new URL(pg.url()).hostname.replace(/^www\./, ''), alvo = dom.replace(/^www\./, '');
      if (!host.endsWith(alvo) && !alvo.endsWith(host)) {
        fs.rmSync(path.join(pasta, 'previa', `${nome}.jpg`), { force: true });
        throw new Error(`redirecionou para ${host}; prévia descartada`);
      }
      // aviso de cookie e popup de cupom cobriam a primeira dobra (loja de relógios do ensaio, 03/11/2026), e o popup só nasce depois
      // de alguns segundos ou da rolagem: a limpeza roda ao carregar, depois de rolar e logo antes do print
      const limpar = async () => {
        await pg.keyboard.press('Escape').catch(() => {});
        // o aviso de cookie da Shopify vive em shadow DOM, que o querySelectorAll não vê; o getByRole do Playwright atravessa
        for (const nome of [/^(accept|accept all|allow all|agree|ok|aceitar|akzeptieren|alle akzeptieren|accepter)$/i, /^no,? thanks/i]) {
          const b = pg.getByRole('button', { name: nome });
          const n = await b.count().catch(() => 0);
          for (let i = 0; i < Math.min(n, 3); i++) await b.nth(i).click({ timeout: 1500 }).catch(() => {});
        }
        await pg.evaluate(() => {
          const rx = /^(accept( all)?|agree|ok|got it|allow all|aceitar|aceito|accepter|akzeptieren|alle akzeptieren|no,? thanks.*|close|fechar|×|✕)$/i;
          for (const el of document.querySelectorAll('button,[role=button],a')) {
            const t = (el.innerText || el.getAttribute('aria-label') || '').trim();
            if (t.length < 45 && rx.test(t)) try { el.click(); } catch {}
          }
          for (const el of document.querySelectorAll('[aria-label*="close" i],[aria-label*="fechar" i],.klaviyo-close-form')) try { el.click(); } catch {}
        }).catch(() => {});
        await pg.waitForTimeout(600);
        // o que é fixo e ocupa mais de 20% da tela é janela por cima da loja; cabeçalho fixo e barra de compra ficam abaixo disso
        await pg.evaluate(() => {
          for (const el of document.querySelectorAll('body *')) {
            const s = getComputedStyle(el);
            if (s.position === 'fixed' || s.position === 'sticky') {
              const r = el.getBoundingClientRect(), t = el.innerText || '';
              if (r.width * r.height > innerWidth * innerHeight * 0.2 || (t.length < 500 && /cookie|privacy|privacidade|datenschutz/i.test(t))) el.remove();
            }
          }
          document.documentElement.style.overflow = 'auto'; document.body.style.overflow = 'auto';
        }).catch(() => {});
      };
      await limpar();
      // imagem com carregamento tardio só aparece depois de rolar
      for (let y = 0; y < altura; y += 700) { await pg.evaluate(v => window.scrollTo(0, v), y); await pg.waitForTimeout(250); }
      await pg.waitForTimeout(1500);
      await limpar();
      await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(800);
      await limpar();
      const alto = await pg.evaluate(() => document.documentElement.scrollHeight);
      await pg.screenshot({ path: path.join(pasta, 'previa', `${nome}.jpg`), type: 'jpeg', quality: 66, fullPage: true,
        clip: { x: 0, y: 0, width: perfil.viewport.width, height: Math.min(alto, altura) } });
      console.log(`${dom}: ${nome} ok`);
    } catch (e) {
      falhas++;
      console.log(`${dom}: ${nome} falhou (${String(e.message || e).split('\n')[0]}); as outras seguem`);
    } finally { await ctx.close(); }
  }
}
await navegador.close();
process.exit(tentadas && falhas === tentadas ? 1 : 0);
