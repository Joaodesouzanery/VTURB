#!/usr/bin/env python3
"""
transcribe.py - transcricao de audio com faster-whisper (cross-platform, GPU quando disponivel).

Recebe um arquivo de audio (wav/mp3) ja extraido pelo process.mjs e emite JSON no stdout:
  { "language": "es", "language_prob": 0.98, "duration_s": 31.4,
    "text": "...", "segments": [ { "start": 0.0, "end": 2.4, "text": "..." } ] }

Uso:
  python transcribe.py <audio_path> [--model medium] [--language auto] [--device auto]

Estrategia de device (robusta):
  1. tenta CUDA float16 (ideal em GPU NVIDIA)
  2. se falhar (sem CUDA/cuDNN/VRAM), cai pra CPU int8 automaticamente
Progresso vai pro stderr; o stdout carrega SO o JSON.
"""
import sys
import json
import argparse


def eprint(*a):
    print(*a, file=sys.stderr, flush=True)


def load_model(model_size, device_pref):
    """Retorna (model, device_usado, compute_type). Faz fallback CUDA -> CPU."""
    from faster_whisper import WhisperModel

    attempts = []
    if device_pref in ("auto", "cuda"):
        attempts.append(("cuda", "float16"))
    if device_pref in ("auto", "cpu"):
        attempts.append(("cpu", "int8"))
    if not attempts:
        attempts = [("cpu", "int8")]

    last_err = None
    for device, compute_type in attempts:
        try:
            eprint(f"[whisper] carregando {model_size} em {device}/{compute_type}...")
            model = WhisperModel(model_size, device=device, compute_type=compute_type)
            return model, device, compute_type
        except Exception as e:  # noqa: BLE001
            last_err = e
            eprint(f"[whisper] {device}/{compute_type} indisponivel: {e}")
            continue
    raise RuntimeError(f"Nenhum device disponivel. Ultimo erro: {last_err}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--model", default="medium")
    ap.add_argument("--language", default="auto")
    ap.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    ap.add_argument("--words", action="store_true", help="inclui timestamps por palavra (corte cirurgico do hook)")
    args = ap.parse_args()

    language = None if args.language in ("auto", "", None) else args.language

    model, device, compute_type = load_model(args.model, args.device)

    eprint("[whisper] transcrevendo...")
    try:
        segments_gen, info = model.transcribe(
            args.audio,
            language=language,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 300},
            beam_size=5,
            word_timestamps=args.words,
        )
    except Exception as e:  # noqa: BLE001
        # se a GPU explodir na hora de transcrever, recarrega em CPU e tenta de novo
        eprint(f"[whisper] falha em {device} durante transcribe: {e}. Retentando em CPU...")
        model, device, compute_type = load_model(args.model, "cpu")
        segments_gen, info = model.transcribe(
            args.audio, language=language, vad_filter=True, beam_size=5,
            word_timestamps=args.words,
        )

    segments = []
    full_text = []
    for s in segments_gen:
        seg = {"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()}
        if args.words and getattr(s, "words", None):
            seg["words"] = [
                {"start": round(w.start, 2), "end": round(w.end, 2), "word": w.word}
                for w in s.words
            ]
        segments.append(seg)
        full_text.append(s.text.strip())
        eprint(f"  [{seg['start']:>6.1f}-{seg['end']:>6.1f}] {seg['text']}")

    out = {
        "language": info.language,
        "language_prob": round(float(info.language_probability), 3),
        "duration_s": round(float(info.duration), 2),
        "device_used": device,
        "compute_type": compute_type,
        "model": args.model,
        "text": " ".join(full_text).strip(),
        "segments": segments,
    }
    sys.stdout.write(json.dumps(out, ensure_ascii=False))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
