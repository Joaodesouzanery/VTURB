// Utilitário de pré-flight: gates que falham cedo, alto e com a correção junto.
// Mensagem de gate que não diz como consertar só transfere o problema.
import { existsSync, statSync } from "node:fs";

export const falhas = [];
export const exigir = (cond, msg, correcao = "") => {
  if (!cond) falhas.push(correcao ? `${msg}\n     → ${correcao}` : msg);
  return cond;
};
export const arquivo = (p, correcao) => exigir(existsSync(p) && statSync(p).size > 0, `ausente ou vazio: ${p}`, correcao);
export const node20 = () => exigir(Number(process.versions.node.split(".")[0]) >= 20,
  `Node 20+ necessário (atual ${process.version})`, "nvm use 20");

export function encerrar(nome) {
  if (falhas.length) {
    process.stderr.write(`\n[pre-flight ${nome}] ${falhas.length} bloqueio(s):\n`);
    falhas.forEach(f => process.stderr.write(`  ✗ ${f}\n`));
    process.exit(1);
  }
  process.stderr.write(`[pre-flight ${nome}] OK\n`);
  process.exit(0);
}
