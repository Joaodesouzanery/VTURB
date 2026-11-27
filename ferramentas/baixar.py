#!/usr/bin/env python3
"""Baixa transcrições (legendas) dos vídeos do canal @vturb (2022-2026), em paralelo."""
import argparse
import html
import re
import subprocess
import sys
import random
import tempfile
import threading
import time
import unicodedata
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


PAUSE = {"until": 0.0, "nivel": 0}
LOCK = threading.Lock()
ESPERAS = [60, 120, 300, 600]


def esperar_pausa():
    while True:
        falta = PAUSE["until"] - time.time()
        if falta <= 0:
            return
        time.sleep(min(falta, 5))


def registrar_429():
    with LOCK:
        if PAUSE["until"] < time.time():
            espera = ESPERAS[min(PAUSE["nivel"], len(ESPERAS) - 1)]
            PAUSE["nivel"] += 1
            PAUSE["until"] = time.time() + espera
            print(f"  >> YouTube limitou (429). Pausando {espera}s...", flush=True)


def rodar(vid, args, tmp, cookies, langs):
    cmd = YTDLP + [
        "--skip-download", "--no-simulate", "--write-subs", "--write-auto-subs",
        "--sub-langs", langs, "--sub-format", "vtt", "--no-warnings",
        "--write-description", "--sleep-requests", "1.5", "--sleep-subtitles", "2",
        "--dateafter", args.depois, "--datebefore", args.antes,
        "--print", "%(upload_date)s|%(title)s",
        "-o", str(tmp / "%(id)s"), f"https://www.youtube.com/watch?v={vid}",
    ] + cookies
    ultimo = ""
    for _ in range(6):
        esperar_pausa()
        time.sleep(random.uniform(3, 6))
        r = subprocess.run(cmd, capture_output=True, text=True)
        err = r.stderr
        if "429" in err:
            registrar_429()
            ultimo = "429 Too Many Requests"
            continue
        if "needs to be reloaded" in err:
            time.sleep(10)
            ultimo = "page needs to be reloaded"
            continue
        if r.returncode == 0:
            with LOCK:
                PAUSE["nivel"] = 0
            return r, None
        ultimo = (err.strip().splitlines() or [""])[-1]
    return None, ultimo


def process(vid, args, tmp, cookies):
    """Retorna (id, status, extra). status: ok | sem_legenda | fora | erro"""
    r, erro = rodar(vid, args, tmp, cookies, "pt,pt-BR,pt-PT,pt-orig")
    if r is None:
        return vid, "erro", erro
    if r.stdout.strip() and not list(tmp.glob(f"{vid}*.vtt")):
        r2, erro = rodar(vid, args, tmp, cookies, "en,en-orig")
        if r2 is None:
            return vid, "erro", erro
        r = r2
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
    slug = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()).strip("-")[:70]
    pasta = args.saida / date[:4] / f"{d}_{slug}_{vid}"
    pasta.mkdir(parents=True, exist_ok=True)
    dest = pasta / f"{pasta.name}.md"
    desc_file = tmp / f"{vid}.description"
    descricao = desc_file.read_text(encoding="utf-8", errors="ignore").strip() if desc_file.exists() else ""
    if desc_file.exists():
        desc_file.unlink()
    paras = re.sub(r"((?:[^.!?]+[.!?]\s*){5})", r"\1\n\n", text)
    safe_title = title.replace('"', "'")
    dest.write_text(
        f'---\ntitulo: "{safe_title}"\nurl: https://www.youtube.com/watch?v={vid}\n'
        f"data: {d}\nid: {vid}\ncanal: VTURB\n---\n\n# {title}\n\n{paras.strip()}\n"
        + (f"\n## Descrição do vídeo\n\n{descricao}\n" if descricao else ""),
        encoding="utf-8")
    return vid, "ok", str(pasta.name)


def preencher_descricoes(args, cookies):
    """Adiciona a descrição do YouTube (links, capítulos) às transcrições já baixadas."""
    arquivos = [f for f in sorted(args.saida.glob("*/*/*.md"))
                if not f.name.endswith("-resumo.md") and "## Descrição do vídeo" not in f.read_text(encoding="utf-8")]
    print(f"{len(arquivos)} transcrições sem descrição.")
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        for n, f in enumerate(arquivos, 1):
            vid = re.search(r"^id: (\S+)", f.read_text(encoding="utf-8"), re.M).group(1)
            cmd = YTDLP + ["--skip-download", "--write-description", "--no-warnings", "--sleep-requests", "1.5",
                           "-o", str(tmp / "%(id)s"), f"https://www.youtube.com/watch?v={vid}"] + cookies
            for _ in range(6):
                esperar_pausa()
                time.sleep(random.uniform(2, 4))
                r = subprocess.run(cmd, capture_output=True, text=True)
                if "429" in r.stderr:
                    registrar_429()
                    continue
                if "needs to be reloaded" in r.stderr:
                    time.sleep(10)
                    continue
                break
            d = tmp / f"{vid}.description"
            if d.exists():
                with f.open("a", encoding="utf-8") as fh:
                    fh.write(f"\n## Descrição do vídeo\n\n{d.read_text(encoding='utf-8', errors='ignore').strip()}\n")
                d.unlink()
                print(f"[{n}/{len(arquivos)}] ok {f.name}", flush=True)
            else:
                print(f"[{n}/{len(arquivos)}] sem descrição {vid}", flush=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--descricoes", action="store_true", help="só preencher descrições nas transcrições existentes")
    p.add_argument("--limit", type=int, default=0, help="só os N primeiros (teste)")
    p.add_argument("--workers", type=int, default=2)
    p.add_argument("--depois", default="20220101")
    p.add_argument("--antes", default="20261231")
    p.add_argument("--saida", type=Path, default=Path("01-VTURB/transcricoes"))
    p.add_argument("--cookies-from-browser", dest="cookies", default="")
    args = p.parse_args()
    cookies = ["--cookies-from-browser", args.cookies] if args.cookies else []
    args.saida.mkdir(exist_ok=True)
    if args.descricoes:
        preencher_descricoes(args, cookies)
        return

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
    with tempfile.TemporaryDirectory() as t:
        for passe in (1, 2):
            if not todo:
                break
            if passe == 2:
                print(f"\nSegundo passe: {len(todo)} vídeos com erro (aguardando 60s)...")
                time.sleep(60)
            cont["erro"] = 0
            falhas = []
            with ThreadPoolExecutor(args.workers) as ex:
                futs = [ex.submit(process, v, args, Path(t), cookies) for v in todo]
                for n, f in enumerate(as_completed(futs), 1):
                    vid, st, extra = f.result()
                    cont[st] += 1
                    if st == "erro":
                        falhas.append(vid)
                    else:
                        with estado.open("a") as fh:
                            fh.write(vid + "\n")
                    if st == "sem_legenda":
                        with open("01-VTURB/sem_legenda.txt", "a") as fh:
                            fh.write(f"{vid} {extra}\n")
                    print(f"[{n}/{len(todo)}] {st}: {extra if st != 'fora' else vid}", flush=True)
            todo = falhas
    print("Resumo:", cont)
    if cont["erro"]:
        print("Ainda há erros: espere ~30-60 min e rode o mesmo comando (retoma de onde parou).")


if __name__ == "__main__":
    main()
