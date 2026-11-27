// Navegador dos runners do Gate A (qa-sweep --run, sweep-node, idiomas-390). Obs. 0091 (16/10/2026): o --run
// usava o Chromium do proprio Playwright, cravado na versao do pacote (o npx de 1.58 procurava headless_shell-1208 e
// so havia o -1228), e o sweep-node lia o pacote de um caminho do cache do npx com hash, que muda a cada npx novo.
import { createRequire } from 'node:module';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// O pacote playwright: o que o diretorio do engine enxerga e, se nao houver, o do cache do npx mais recente.
export async function carregarPlaywright() {
  try { return await import('playwright'); } catch {}
  const raiz = join(homedir(), '.npm', '_npx');
  const dirs = existsSync(raiz) ? readdirSync(raiz).map((d) => join(raiz, d, 'node_modules')).filter((d) => existsSync(join(d, 'playwright'))) : [];
  dirs.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const d of dirs) { try { return createRequire(d + '/')('playwright'); } catch {} }
  // instalacao global do npm (Windows: %APPDATA%\npm\node_modules), que o import do engine nao enxerga
  const globais = [process.env.APPDATA && join(process.env.APPDATA, 'npm', 'node_modules'), '/usr/local/lib/node_modules', '/opt/homebrew/lib/node_modules'].filter(Boolean);
  for (const d of globais) { if (existsSync(join(d, 'playwright'))) { try { return createRequire(d + '/')('playwright'); } catch {} } }
  return null;
}

// Chrome do sistema primeiro (o que o sweep-node sempre usou e com que o Gate A deu 40/40 sem bloqueio), depois o
// Chromium do pacote se o executavel existir. Sem nenhum, erro que diz o que instalar.
export async function abrirNavegador(chromium, opts = {}) {
  const erros = [];
  try { return await chromium.launch({ ...opts, channel: 'chrome' }); }
  catch (e) { erros.push('Chrome do sistema: ' + String(e.message || e).split('\n')[0]); }
  let exe = '';
  try { exe = chromium.executablePath(); } catch {}
  if (exe && existsSync(exe)) {
    try { return await chromium.launch({ ...opts, executablePath: exe }); }
    catch (e) { erros.push('Chromium do Playwright: ' + String(e.message || e).split('\n')[0]); }
  } else erros.push('Chromium do Playwright ausente em ' + (exe || '(sem caminho)'));
  throw new Error('Nenhum navegador para o Gate A. Instale o Google Chrome, ou rode "npx playwright install chromium" com a mesma versao do pacote. ' + erros.join(' | '));
}
