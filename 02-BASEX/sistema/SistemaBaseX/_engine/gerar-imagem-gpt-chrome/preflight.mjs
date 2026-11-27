#!/usr/bin/env node
/**
 * preflight.mjs — checa os pré-requisitos da geração de imagem
 * (Refazer Criativo com a Sua Marca) antes de iniciar o fluxo.
 *
 * Verifica: (1) chave da API Gemini (opcional, cobrada por imagem), (2) Chrome com
 * a porta de depuracao 9222 no ar (o caminho de graca, que e o padrao), (3) shopify
 * CLI disponivel (necessario so se o destino for Files da Shopify). NAO checa login
 * do ChatGPT: isso so se confere abrindo o chatgpt.com nesse Chrome.
 *
 * Uso: node preflight.mjs
 * Exit 0 = pronto (tem a chave da API OU tem o Chrome na porta). Exit 1 = bloqueio
 * (nenhum dos dois caminhos de geracao disponivel).
 */
import { execSync } from "node:child_process";
import http from "node:http";
import { lerChave } from "./gen-image-api.mjs";

function check(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 2500 }, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

const apiOk = !!lerChave();
console.log(apiOk
  ? "[preflight] API Gemini: chave encontrada (opcional, e cobrada por imagem). Vai usar ela."
  : "[preflight] API Gemini: sem chave, que e o normal. Usa o ChatGPT do seu navegador, de graca.");

const CDP_PORT = process.env.CDP_PORT || "9222";
const chromeOk = await check(`http://localhost:${CDP_PORT}/json/version`);
console.log(chromeOk
  ? `[preflight] Chrome na porta de depuracao ${CDP_PORT}: OK`
  : `[preflight] Chrome na porta de depuracao ${CDP_PORT}: AUSENTE. Suba o Chrome com --remote-debugging-port=${CDP_PORT}`);

let cliOk = false;
try { execSync("shopify version", { stdio: "ignore" }); cliOk = true; } catch {}
console.log(cliOk
  ? "[preflight] Shopify CLI: OK (destino Files disponível)"
  : "[preflight] Shopify CLI: ausente (ok se o destino não for Files da Shopify)");

console.log("[preflight] Login do ChatGPT: abra o chatgpt.com nesse Chrome e confirme que esta logado. Nao da para checar por linha de comando.");

if (!apiOk && !chromeOk) {
  console.log("[preflight] BLOQUEIO: sem chave da API e sem Chrome na porta de depuracao. Nenhum caminho de geracao disponivel.");
  process.exit(1);
}
process.exit(0);
