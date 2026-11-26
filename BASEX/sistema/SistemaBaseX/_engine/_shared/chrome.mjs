// Um Chrome so, muitas imagens.
//
// Abrir o Chrome com --screenshot resolve uma imagem por vez e custa cerca de 14
// segundos de partida em cada chamada. Com 18 pecas isso passava de quatro
// minutos. Aqui o navegador abre uma vez e as fotos saem pelo protocolo de
// depuracao, a poucos centesimos cada.

import { spawn } from 'node:child_process';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const FLAGS = [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-sync',
  '--mute-audio',
  '--remote-debugging-port=0',
];

export async function abrirChrome(caminho, { silencioso = true } = {}) {
  const proc = spawn(caminho, [...FLAGS, 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });

  const wsUrl = await new Promise((ok, falha) => {
    let buffer = '';
    const prazo = setTimeout(() => falha(new Error('o Chrome nao anunciou a porta de depuracao em 40s')), 40_000);
    proc.stderr.on('data', (b) => {
      buffer += b.toString();
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(buffer);
      if (m) { clearTimeout(prazo); ok(m[1]); }
    });
    proc.on('exit', (c) => { clearTimeout(prazo); falha(new Error(`o Chrome saiu antes de abrir (codigo ${c})`)); });
    proc.on('error', (e) => { clearTimeout(prazo); falha(new Error(`nao consegui executar o Chrome: ${e.message}`)); });
  });

  if (silencioso) proc.stderr.resume();

  const ws = new WebSocket(wsUrl);
  await new Promise((ok, falha) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => falha(new Error('nao consegui falar com o Chrome pela porta de depuracao')), { once: true });
  });

  let proximoId = 0;
  const esperando = new Map();
  const ouvintes = new Set();

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== undefined && esperando.has(msg.id)) {
      const { ok, falha } = esperando.get(msg.id);
      esperando.delete(msg.id);
      if (msg.error) falha(new Error(`${msg.error.message} (${msg.error.code})`));
      else ok(msg.result);
      return;
    }
    for (const f of ouvintes) f(msg);
  });

  function enviar(method, params = {}, sessionId) {
    const id = ++proximoId;
    return new Promise((ok, falha) => {
      esperando.set(id, { ok, falha });
      ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
  }

  function esperarEvento(nome, sessionId, prazoMs = 20_000) {
    return new Promise((ok, falha) => {
      const t = setTimeout(() => { ouvintes.delete(f); falha(new Error(`o evento ${nome} nao chegou`)); }, prazoMs);
      const f = (msg) => {
        if (msg.method === nome && (!sessionId || msg.sessionId === sessionId)) {
          clearTimeout(t); ouvintes.delete(f); ok(msg.params);
        }
      };
      ouvintes.add(f);
    });
  }

  const { targetId } = await enviar('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await enviar('Target.attachToTarget', { targetId, flatten: true });
  await enviar('Page.enable', {}, sessionId);

  const pastaTmp = join(tmpdir(), `marca-${process.pid}`);
  await mkdir(pastaTmp, { recursive: true });
  let contador = 0;

  return {
    // Desenha o HTML e grava o PNG. Fundo transparente de verdade: sem o override
    // abaixo o Chrome pinta branco por baixo e o logo vira retangulo branco.
    // esperaMs: pagina com animacao de entrada precisa terminar antes da foto,
    // senao o elemento que nasce com opacity 0 sai invisivel.
    async foto(html, destino, largura, altura, { esperaMs = 0 } = {}) {
      const arquivo = join(pastaTmp, `p${++contador}.html`);
      await writeFile(arquivo, html, 'utf8');

      await enviar('Emulation.setDeviceMetricsOverride', {
        width: largura, height: altura, deviceScaleFactor: 1, mobile: false,
      }, sessionId);
      await enviar('Emulation.setDefaultBackgroundColorOverride', {
        color: { r: 0, g: 0, b: 0, a: 0 },
      }, sessionId);

      const carregou = esperarEvento('Page.loadEventFired', sessionId);
      await enviar('Page.navigate', { url: `file://${arquivo}` }, sessionId);
      await carregou;
      // A centragem so pode medir depois que a fonte real chegou. Medir antes
      // devolve as metricas da fonte de sistema e o glifo sai torto.
      await enviar('Runtime.evaluate', {
        expression: `(async()=>{ if(document.fonts) await document.fonts.ready;
                      if(window.__centralizar) window.__centralizar(); return 1; })()`,
        awaitPromise: true,
      }, sessionId).catch(() => {});

      if (esperaMs > 0) {
        await enviar('Runtime.evaluate', {
          expression: `new Promise(r=>setTimeout(r,${esperaMs}))`, awaitPromise: true,
        }, sessionId).catch(() => {});
      }

      const { data } = await enviar('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: false, fromSurface: true,
      }, sessionId);
      const bin = Buffer.from(data, 'base64');
      await writeFile(destino, bin);
      return bin;
    },

    // Util para conferir o que a pagina calculou, sem abrir o navegador na mao.
    async avaliar(expressao) {
      const r = await enviar('Runtime.evaluate', {
        expression: `JSON.stringify(${expressao})`, awaitPromise: true, returnByValue: true,
      }, sessionId);
      const v = r?.result?.value;
      return v === undefined ? undefined : JSON.parse(v);
    },

    async fechar() {
      try { await enviar('Browser.close'); } catch { /* ja saiu */ }
      try { ws.close(); } catch { /* idem */ }
      proc.kill();
      await rm(pastaTmp, { recursive: true, force: true });
    },
  };
}
