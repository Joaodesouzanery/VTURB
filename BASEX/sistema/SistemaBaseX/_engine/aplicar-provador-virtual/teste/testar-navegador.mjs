/* Teste ponta a ponta no navegador.
   Monta uma PDP falsa com o seletor de variante do Dawn, sobe a
   section e percorre o fluxo inteiro como um comprador faria:
   abrir, medir, ver o resultado, e mandar aplicar o tamanho.

   Confere no fim se a VARIANTE da pagina realmente mudou, que e a
   unica prova de que o provador fez efeito.

   Rodar: node testar-navegador.mjs                                */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const S = join(AQUI, '..', 'section');
const mod = (f) => readFileSync(join(S, f), 'utf8');

const JS = [
  'bx-fit-dados.js', 'bx-fit-core.js', 'bx-fit-silhueta.js',
  'bx-fit-theme.js', 'bx-fit-ui.js', 'bx-fit-boot.js',
].map(mod).join('\n');
const CSS = mod('bx-fit.css');

/* tabela de peca, medidas de circunferencia em cm */
const TABELA = {
  tipo: 'peca', unidade: 'cm', medicao: 'circunferencia',
  tamanhos: [
    { tamanho: 'P', busto: 96, cintura: 80, quadril: 100 },
    { tamanho: 'M', busto: 102, cintura: 86, quadril: 106 },
    { tamanho: 'G', busto: 108, cintura: 92, quadril: 112 },
    { tamanho: 'GG', busto: 114, cintura: 98, quadril: 118 },
  ],
};

const CONFIG = {
  produto: 'Vestido de Teste', handle: 'vestido-teste',
  textoBotao: 'Descubra o seu tamanho',
  textoTitulo: 'Qual tamanho serve em você',
  perfilId: 'generico', caimento: 'regular', tecido: 'malha',
  sexo: 'f', unidade: 'cm', escalaDetalhada: false, vesteEm: '',
  ancorar: true,
  opcaoTamanho: { nome: 'Tamanho', posicao: 2, valores: ['P', 'M', 'G', 'GG'] },
  disponiveis: ['P', 'M', 'G', 'GG'],
  tabela: TABELA,
};

const PAGINA = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>${CSS}</style></head><body>
<h1>Vestido de Teste</h1>
<variant-selects id="variant-selects-tt">
  <fieldset class="js product-form__input product-form__input--pill">
    <legend class="form__label">Tamanho</legend>
    ${['P', 'M', 'G', 'GG'].map((v, i) => `
      <input type="radio" id="tt-2-${i}" name="Tamanho-2" value="${v}" form="product-form-tt"
             ${v === 'GG' ? 'checked' : ''} data-option-name="Tamanho">
      <label for="tt-2-${i}">${v}</label>`).join('')}
  </fieldset>
</variant-selects>
<form id="product-form-tt" action="/cart/add" method="post">
  <input type="hidden" name="id" value="111">
  <button type="submit">Comprar</button>
</form>
<div data-bx-provador id="bx-provador-tt"
     style="--bxfit-acento:#1B472B;--bxfit-texto:#303030;--bxfit-fundo:#fff;--bxfit-borda:#E8E4DE;--bxfit-raio:8px">
  <div class="bxfit-slot"></div>
  <script type="application/json" data-bx-config>${JSON.stringify(CONFIG)}<\/script>
</div>
<script>${JS}<\/script></body></html>`;

let ok = 0; const falhas = [];
const t = (nome, cond, obtido) => {
  if (cond) { ok++; console.log('  OK    ' + nome); }
  else { falhas.push(nome); console.log('  FALHA ' + nome + '  obtido: ' + JSON.stringify(obtido)); }
};

// Servidor local: com setContent a pagina fica em about:blank e o
// localStorage lanca SecurityError. Precisamos de uma origem de verdade
// pra testar a memoria entre produtos.
let corpoAtual = PAGINA;
const srv = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(corpoAtual);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;

const nav = await chromium.launch();
const pag = await nav.newPage({ viewport: { width: 900, height: 900 } });
const erros = [];
pag.on('pageerror', (e) => erros.push(String(e)));
pag.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });

await pag.goto(BASE, { waitUntil: 'domcontentloaded' });
await pag.waitForTimeout(400);

console.log('\n== montagem ==');
t('sem erro de JS na pagina', erros.length === 0, erros.slice(0, 3));
t('botao do provador existe', await pag.locator('.bxfit-abrir').count() === 1);
t('botao ancorou junto do seletor de tamanho',
  await pag.evaluate(() => {
    const b = document.querySelector('[data-bx-provador]');
    const f = document.querySelector('fieldset.product-form__input');
    return !!(b && f && f.parentNode === b.parentNode);
  }));

console.log('\n== fluxo: medir ==');
await pag.click('.bxfit-abrir');
await pag.waitForTimeout(200);
t('janela abriu', await pag.locator('.bxfit-modal:not([hidden])').count() === 1);

await pag.click('[data-ir="medir"]');
await pag.waitForTimeout(150);
const campos = await pag.locator('.bxfit-campo input').count();
t('tela de medidas tem os campos do perfil', campos === 3, campos);

await pag.fill('input[name="busto"]', '90');
await pag.fill('input[name="cintura"]', '74');
await pag.fill('input[name="quadril"]', '98');
await pag.click('[data-calcular]');
await pag.waitForTimeout(250);

console.log('\n== resultado ==');
const tam = (await pag.locator('.bxfit-res-tam').textContent().catch(() => '')).trim();
t('mostrou um tamanho', ['P', 'M', 'G', 'GG'].includes(tam), tam);
t('desenhou a silhueta', await pag.locator('.bxfit-svg').count() === 1);
const linhas = await pag.locator('.bxfit-linha').count();
t('listou o caimento por regiao', linhas === 3, linhas);
t('mostrou a folga em centimetro junto da cor',
  await pag.locator('.bxfit-num').count() === 3);

console.log('\n== aplicar na pagina ==');
const antes = await pag.evaluate(() => document.querySelector('input[name="Tamanho-2"]:checked').value);
await pag.click('[data-aplicar]');
await pag.waitForTimeout(250);
const depois = await pag.evaluate(() => document.querySelector('input[name="Tamanho-2"]:checked').value);
t('a variante da pagina mudou de fato', depois === tam && depois !== antes, { antes, depois, tam });
t('a janela fechou depois de aplicar',
  await pag.locator('.bxfit-modal:not([hidden])').count() === 0);

console.log('\n== memoria entre produtos ==');
const salvo = await pag.evaluate(() => localStorage.getItem('bx-provador-perfil'));
t('guardou o perfil pra proxima PDP', !!salvo && JSON.parse(salvo).busto === 90, salvo);

await pag.goto(BASE, { waitUntil: 'domcontentloaded' });
await pag.waitForTimeout(300);
await pag.click('.bxfit-abrir');
await pag.waitForTimeout(250);
t('quem ja respondeu cai direto no resultado',
  await pag.locator('.bxfit-res-tam').count() === 1);

console.log('\n== acessibilidade basica ==');
t('a janela se declara como dialogo',
  await pag.evaluate(() => {
    const m = document.querySelector('.bxfit-modal');
    return m.getAttribute('role') === 'dialog' && m.getAttribute('aria-modal') === 'true';
  }));
await pag.keyboard.press('Escape');
await pag.waitForTimeout(150);
t('Escape fecha', await pag.locator('.bxfit-modal:not([hidden])').count() === 0);

console.log('\n== sem tabela, sem provador ==');
corpoAtual = PAGINA.replace(JSON.stringify(CONFIG), JSON.stringify({ ...CONFIG, tabela: null }));
await pag.goto(BASE, { waitUntil: 'domcontentloaded' });
await pag.waitForTimeout(300);
t('sem tabela de medidas o botao nem aparece',
  await pag.locator('.bxfit-abrir').count() === 0);

await nav.close();
srv.close();
console.log('\n' + '-'.repeat(62));
console.log(falhas.length === 0 ? `TODOS OS ${ok} TESTES PASSARAM` : `${falhas.length} FALHA(S) de ${ok + falhas.length}`);
process.exit(falhas.length ? 1 : 0);
