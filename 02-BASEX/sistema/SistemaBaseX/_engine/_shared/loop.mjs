#!/usr/bin/env node
// Motor de loop por objetivo (Ralph Loop) — peça compartilhada.
//
// Diferença para as rotinas agendadas que já existem: aquelas param quando o
// relógio manda. Este para quando o OBJETIVO foi atingido, e não antes. É a
// forma certa para trabalho com critério de pronto objetivo: "zero produto fora
// do idioma", "zero achado na revisão". Não serve para julgamento subjetivo.
//
// Ciclo, em ordem:
//   1. varrer   → mede o estado atual e devolve a lista de pendências
//   2. terminou?→ se a lista está vazia, encerra com sucesso
//   3. agir     → corrige o que dá para corrigir nesta rodada
//   4. registrar→ grava o progresso em disco (é o que permite recomeçar limpo)
//   5. volta ao 1
//
// AS TRÊS TRAVAS (nenhuma é opcional). Um loop sem elas é o que prendeu um
// backfill por 26 horas, tomando erro a cada 60s e queimando cota de API sem
// ninguém perceber:
//
//   maxRodadas    teto absoluto de iterações
//   semProgresso  encerra quando N rodadas seguidas não reduzem a pendência.
//                 É a trava que faltava nele: "funcionava", só não avançava,
//                 e girar em falso é indistinguível de trabalhar
//                 quando ninguém está olhando
//   tetoAcoes     teto de ações executadas no loop inteiro, para erro de
//                 detecção não virar edição em massa
//
// O trail em disco existe para o loop poder ser morto e retomado, e para
// alguém conseguir auditar depois o que ele fez e por quê.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const PARADAS = {
  OBJETIVO: "objetivo atingido",
  MAX_RODADAS: "teto de rodadas",
  SEM_PROGRESSO: "sem progresso",
  TETO_ACOES: "teto de ações",
  ERRO: "erro na rodada",
};

/**
 * @param {object} cfg
 * @param {string} cfg.nome            identificação no log e no trail
 * @param {() => Promise<Array>} cfg.varrer   devolve a lista de pendências (vazia = pronto)
 * @param {(pend:Array, ctx:object) => Promise<number>} [cfg.agir]
 *        corrige e devolve quantas ações executou. Sem isso o loop só mede,
 *        que é o modo de auditoria (útil para rodar sem risco antes de soltar).
 * @param {string} cfg.trail           caminho do arquivo de progresso
 * @param {number} [cfg.maxRodadas=8]
 * @param {number} [cfg.semProgresso=2]
 * @param {number} [cfg.tetoAcoes=500]
 * @param {(m:string)=>void} [cfg.log]
 */
export async function loop(cfg) {
  const {
    nome, varrer, agir = null, trail,
    maxRodadas = 8, semProgresso = 2, tetoAcoes = 500,
    log = (m) => process.stderr.write(`[loop:${nome}] ${m}\n`),
  } = cfg;

  const historico = [];
  let rodada = 0, acoes = 0, travadas = 0, anterior = Infinity, parada = null;

  const gravar = () => {
    if (!trail) return;
    mkdirSync(dirname(trail), { recursive: true });
    writeFileSync(trail, JSON.stringify({
      nome, rodadas: rodada, acoes, parada, historico,
    }, null, 2));
  };

  while (true) {
    if (rodada >= maxRodadas) { parada = PARADAS.MAX_RODADAS; break; }
    rodada++;

    let pend;
    try {
      pend = await varrer({ rodada, acoes });
    } catch (e) {
      parada = PARADAS.ERRO;
      historico.push({ rodada, erro: String(e.message || e) });
      log(`rodada ${rodada}: varredura falhou (${e.message}); encerro`);
      break;
    }

    const n = pend.length;
    log(`rodada ${rodada}: ${n} pendência(s)`);
    historico.push({ rodada, pendencias: n, acoes_ate_aqui: acoes });

    if (n === 0) { parada = PARADAS.OBJETIVO; gravar(); break; }

    // Progresso é a pendência CAINDO. Manter o mesmo número já conta como
    // parado: o loop pode estar corrigindo e quebrando na mesma proporção.
    if (n >= anterior) {
      travadas++;
      log(`  sem avanço (${anterior} → ${n}), ${travadas} de ${semProgresso}`);
      if (travadas >= semProgresso) { parada = PARADAS.SEM_PROGRESSO; gravar(); break; }
    } else {
      travadas = 0;
    }
    anterior = n;

    if (!agir) { parada = "somente auditoria"; gravar(); break; }

    if (acoes >= tetoAcoes) { parada = PARADAS.TETO_ACOES; gravar(); break; }

    let feitas = 0;
    try {
      feitas = (await agir(pend, { rodada, restante: tetoAcoes - acoes })) || 0;
    } catch (e) {
      parada = PARADAS.ERRO;
      historico.push({ rodada, erro_acao: String(e.message || e) });
      log(`rodada ${rodada}: ação falhou (${e.message}); encerro`);
      break;
    }
    acoes += feitas;
    log(`  ${feitas} ação(ões) nesta rodada · ${acoes} no total`);

    // Rodada que não conseguiu agir em nada não vai conseguir na próxima
    // tampouco: o que sobrou exige decisão humana. Insistir é queimar cota.
    if (feitas === 0) { parada = PARADAS.SEM_PROGRESSO; gravar(); break; }
    gravar();
  }

  gravar();
  const ok = parada === PARADAS.OBJETIVO;
  log(`encerrado: ${parada} · ${rodada} rodada(s) · ${acoes} ação(ões)`);
  return { ok, parada, rodadas: rodada, acoes, historico, pendencias_finais: historico.at(-1)?.pendencias ?? null };
}

/** Retoma a contagem de um trail anterior, quando existir. */
export function lerTrail(caminho) {
  if (!caminho || !existsSync(caminho)) return null;
  try { return JSON.parse(readFileSync(caminho, "utf-8")); } catch { return null; }
}
