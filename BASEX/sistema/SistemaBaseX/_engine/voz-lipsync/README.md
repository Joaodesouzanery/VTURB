# Motor da squad Voz e Lipsync

Voz nova na ElevenLabs, boca sincronizada no sync.so e legenda trocada, com as chaves do próprio aluno. Sem dependência de npm: precisa só de Node 22 e ffmpeg (com libass para escrever a legenda).

| Arquivo | O que faz |
|---|---|
| `preflight.mjs` | Confere Node, ffmpeg (e os filtros de legenda e de apagar), chaves, Shopify CLI e o acesso aos Files da loja. Não gasta crédito |
| `voz.mjs` | `vozes`, `clonar`, `falar` (copy nova no tempo do vídeo, com a legenda `.srt` da voz nova) e `dublar` (API de projeto de dublagem, com `--trocar` para o nome falado de outra marca e retomada sem pagar de novo) |
| `lipsync.mjs` | `quadros` (para achar os trechos com rosto falando e a legenda antiga) e o lipsync dos trechos, com a remontagem. Apaga a marca d'água do sync.so medida pela diferença entre o trecho enviado e o que voltou |
| `legenda.mjs` | Apaga a faixa da legenda antiga queimada, só nos segundos em que ela aparece, e escreve a legenda nova por cima |
| `lib.mjs` | Chaves, ffmpeg, envio aos Files da loja, as contas de tempo e custo, a caixa da marca d'água, a legenda pelo tempo de cada letra e a troca de nome. `node lib.mjs --teste` roda o autoteste |

Chaves em `_engine/.env`, uma por linha:

```
ELEVENLABS_API_KEY=...
SYNC_API_KEY=...
```

Toda chamada que gasta crédito tem `--simular`, que roda o caminho inteiro sem chamar a ElevenLabs nem o sync.so. A `legenda.mjs` não gasta nada: roda no computador. O passo a passo para o aluno está na squad `03. Skills/141. Voz e Lipsync.md`, e as armadilhas em `05. Guias/Voz e Lipsync.md`.
