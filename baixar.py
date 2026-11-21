#!/usr/bin/env python3
"""Baixa transcrições (legendas) dos vídeos do canal @vturb (2022-2026), em paralelo."""
import argparse
import html
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

CHANNEL = "https://www.youtube.com/@vturb"
TABS = ["videos", "streams"]
YTDLP = [sys.executable, "-m", "yt_dlp"]

TS = re.compile(r"^\d{1,2}:\d\d(:\d\d)?[.,]\d{3}\s+-->")
TAG = re.compile(r"<[^>]+>")


def vtt_to_text(vtt: str) -> str:
    out, prev = [], ""
    for line in vtt.splitlines():
        line = line.strip()
        if (not line or line.startswith(("WEBVTT", "Kind:", "Language:", "NOTE"))
                or TS.match(line) or line.isdigit()):
            continue
        line = html.unescape(TAG.sub("", line)).strip()
        if line and line != prev:
            out.append(line)
            prev = line
    return " ".join(out)


def list_ids(cookies):
    ids = []
    for tab in TABS:
        cmd = YTDLP + ["--flat-playlist", "--print", "%(id)s", f"{CHANNEL}/{tab}"]
        cmd += cookies
        r = subprocess.run(cmd, capture_output=True, text=True)
        ids += [x.strip() for x in r.stdout.splitlines() if re.fullmatch(r"[\w-]{11}", x.strip())]
    return list(dict.fromkeys(ids))


def sub_rank(path: Path):
    n = path.name
    return (0 if ".pt" in n else 1, 0 if "orig" not in n else 1, n)


def process(vid, args, tmp, cookies):
    """Retorna (id, status, extra). status: ok | sem_legenda | fora | erro"""
    cmd = YTDLP + [
        "--skip-download", "--no-simulate", "--write-subs", "--write-auto-subs",
        "--sub-langs", "pt.*,en.*", "--sub-format", "vtt", "--no-warnings",
        "--dateafter", args.depois, "--datebefore", args.antes,
        "--print", "%(upload_date)s|%(title)s",
        "-o", str(tmp / "%(id)s"), f"https://www.youtube.com/watch?v={vid}",
    ] + cookies
    for _ in range(3):
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0:
            break
    else:
        return vid, "erro", r.stderr.strip().splitlines()[-1:] or [""]
    info = r.stdout.strip().splitlines()
    if not info:
        return vid, "fora", ""
    date, _, title = info[-1].partition("|")
    subs = sorted(tmp.glob(f"{vid}*.vtt"), key=sub_rank)
    if not subs:
        return vid, "sem_legenda", title
    text = vtt_to_text(subs[0].read_text(encoding="utf-8", errors="ignore"))
    for s in subs:
        s.unlink()
    d = f"{date[:4]}-{date[4:6]}-{date[6:]}"
    safe = re.sub(r'[\\/:*?"<>|]+', "", title).strip()[:90]
    dest = args.saida / f"{d} - {safe} [{vid}].txt"
    dest.write_text(f"{title}\nhttps://www.youtube.com/watch?v={vid}\n{d}\n\n{text}\n", encoding="utf-8")
    return vid, "ok", dest.name


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=0, help="só os N primeiros (teste)")
    p.add_argument("--workers", type=int, default=8)
    p.add_argument("--depois", default="20220101")
    p.add_argument("--antes", default="20261231")
    p.add_argument("--saida", type=Path, default=Path("transcricoes"))
    p.add_argument("--cookies-from-browser", dest="cookies", default="")
    args = p.parse_args()
    cookies = ["--cookies-from-browser", args.cookies] if args.cookies else []
    args.saida.mkdir(exist_ok=True)

    estado = Path("processados.txt")
    feitos = set(estado.read_text().split()) if estado.exists() else set()
    print("Listando vídeos do canal...")
    ids = list_ids(cookies)
    print(f"{len(ids)} vídeos encontrados.")
    todo = [i for i in ids if i not in feitos]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(todo)} a processar com {args.workers} em paralelo.")

    cont = {"ok": 0, "sem_legenda": 0, "fora": 0, "erro": 0}
    with tempfile.TemporaryDirectory() as t, ThreadPoolExecutor(args.workers) as ex:
        futs = [ex.submit(process, v, args, Path(t), cookies) for v in todo]
        for n, f in enumerate(as_completed(futs), 1):
            vid, st, extra = f.result()
            cont[st] += 1
            if st != "erro":
                with estado.open("a") as fh:
                    fh.write(vid + "\n")
            if st == "sem_legenda":
                with open("sem_legenda.txt", "a") as fh:
                    fh.write(f"{vid} {extra}\n")
            print(f"[{n}/{len(todo)}] {st}: {extra if st != 'fora' else vid}")
    print("Resumo:", cont)
    if cont["erro"]:
        print("Houve erros: rode de novo (retoma de onde parou) ou use --workers 3 / --cookies-from-browser chrome")


if __name__ == "__main__":
    main()
