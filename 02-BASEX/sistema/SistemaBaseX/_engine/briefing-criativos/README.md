# Engine: Briefing de Criativos

Prepara criativos minerados pra análise da skill `briefing-criativos`.
Para cada vídeo: extrai áudio + frames e transcreve com timestamps. O Claude consome o JSON pra montar o briefing de produção.

## Arquitetura

```
Node (process.mjs)
  -> ffmpeg          extrai audio 16kHz mono wav
  -> ffmpeg          extrai frames distribuidos (analise visual)
  -> transcribe.py   faster-whisper (GPU CUDA se disponivel, senao CPU) -> segments + idioma
  -> stdout JSON consolidado (+ salva transcripts.json na pasta de trabalho)
```

Cross-platform: usa `faster-whisper`, que roda em Windows, Linux e Mac (Intel ou Apple Silicon).

## Pré-requisitos

| Item | Verifica | Instala |
|------|----------|---------|
| Node 20+ | `node -v` | — |
| ffmpeg | `ffmpeg -version` | `node setup.mjs` (Win: winget · Mac: brew · Linux: apt/dnf) |
| Python 3 | `python --version` | — |
| faster-whisper + av | `python -c "import faster_whisper"` | `pip install faster-whisper` |
| GPU NVIDIA (opcional) | `nvidia-smi` | acelera; sem ela roda em CPU |

**Instalação automática (máquina limpa):** `node setup.mjs` instala ffmpeg + faster-whisper conforme o SO (Windows winget / macOS brew / Linux apt/dnf), idempotente. Rodado automaticamente pela skill quando o pre-flight acusa dependência faltando, então o primeiro colaborador a usar já instala tudo sozinho. O modelo `medium` (~1.4GB) não é baixado aqui: vem no primeiro transcribe.

Rodar o pre-flight antes: `node preflight.mjs`

## Uso

```bash
node process.mjs <arquivo-ou-pasta> [opcoes]

  --out DIR           pasta de trabalho (default: <tmp>/briefing-criativos-<id>)
  --model MODEL       modelo whisper (default: medium; large-v3 só vale a pena com GPU)
  --language LANG     idioma do audio (default: auto-detect; ex: en, es, pt)
  --device D          auto | cuda | cpu (default: auto -> tenta GPU, cai pra CPU)
  --frames-every S    1 frame a cada S segundos (default: 2.5)
  --max-frames N      teto de frames por video (default: 24)
  --words             timestamps por palavra (corte cirurgico do hook no Capcut)
  --dry-run           lista videos + duracao e valida, sem transcrever
```

Aceita **um arquivo** de vídeo ou **uma pasta** (processa todos os vídeos em lote).

### Extras gerados
- **`legenda-original.srt`** por criativo (na workdir): referência de timing pro Capcut e base pra legenda no Vmake.
- **Métricas exportadas (opcional):** se houver `metricas.json` / `metricas.csv` na pasta dos vídeos, o conteúdo é anexado ao JSON (`metricas_externas`) pra o ranking usar performance real (views, GMV, CTR), não só a análise qualitativa.

## Output (stdout JSON)

```json
{
  "engine": "briefing-criativos",
  "out_dir": "/tmp/briefing-criativos-ab12cd",
  "total": 3, "ok": 3, "failed": 0,
  "creatives": [
    {
      "index": 1, "video": "criativo01.mp4", "duration_s": 31.4,
      "workdir": ".../01-criativo01.mp4",
      "frames": [ { "index": 1, "approx_t": 1.25, "path": ".../frames/frame_001.jpg" } ],
      "transcript": {
        "language": "es", "language_prob": 0.98, "device_used": "cuda",
        "text": "transcricao completa",
        "segments": [ { "start": 0.0, "end": 2.4, "text": "frase" } ]
      },
      "error": null
    }
  ]
}
```

O Claude lê os `frames[].path` (análise visual) + `transcript.segments` (áudio com timestamps) de cada criativo.

## Robustez

- **GPU -> CPU automático:** `transcribe.py` tenta CUDA float16; se faltar CUDA/cuDNN/VRAM, cai pra CPU int8 sozinho e loga no stderr.
- **Lote resiliente:** vídeo que falha vira `error` no JSON e não derruba os outros.
- **stdout limpo:** todo progresso vai pro stderr; stdout carrega só o JSON.

## Não-destrutivo / Rollback

Este engine só **lê** vídeos locais e **escreve** artefatos temporários em `--out` (áudio, frames, JSON). Não chama API paga, não modifica o vídeo original nem o vault. "Rollback" = apagar a pasta `--out`:

```bash
rm -rf <out_dir>     # ou Remove-Item -Recurse -Force <out_dir> no Windows
```

## Erros comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `ffmpeg exit ...` / `ENOENT` | ffmpeg fora do PATH da sessão | reabrir shell após `winget install`, ou setar `FFMPEG_BIN` |
| `import faster_whisper` falha | pacote não instalado | `pip install faster-whisper` |
| Transcrição sempre em CPU tendo GPU | falta cuDNN/cuBLAS do CUDA 12 | `pip install nvidia-cudnn-cu12 nvidia-cublas-cu12` |
| Idioma detectado errado | auto-detect falhou em áudio curto/ruidoso | forçar `--language en` (ou es/pt) |
| `out of memory` na GPU | modelo grande + pouca VRAM | `--model small` ou `--device cpu` |
