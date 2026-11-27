#!/usr/bin/env node
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url"; import { homedir } from "node:os"; import { existsSync } from "node:fs";
import { arquivo, exigir, node20, encerrar } from "../_shared/preflight-util.mjs";
const D = dirname(fileURLToPath(import.meta.url));   // pathname escaparia espaço em nome de pasta
node20();
for (const f of ["varrer.mjs", "detectar.mjs", "corrigir.mjs"]) arquivo(join(D, f), "motor incompleto; restaurar do git");
arquivo(join(D, "..", "_shared", "loop.mjs"), "motor de loop ausente");
// Aviso, não bloqueio: a pasta de catálogos só é necessária no modo --cofre.
// Quem vai rodar --loja não pode ser barrado por não ter catálogo local.
const catalogos = process.env.CATALOGOS_DIR || join(homedir(), "catalogos-lojas");
if (!existsSync(catalogos))
  process.stderr.write(`[aviso] sem pasta de catálogos em ${catalogos}; o modo --cofre não vai achar nada. Use --loja <handle> com a loja autenticada, ou defina CATALOGOS_DIR\n`);
encerrar("varredura-idioma");
