"""Build the bundled English dictionary (dev-time only, never runs in CI/build).

Converts Open English WordNet (https://en-word.net, CC BY 4.0) from its WNDB
release into a StarDict fileset at src-tauri/resources/dictionaries/wordnet/,
which the app loads through the same pipeline as user-imported dictionaries.

Zero dependencies — run with any Python 3.9+:

    python scripts/build-dictionary.py

Downloads the WNDB zip on first run (cached next to this script). Entry
bodies are HTML (sametypesequence=h) with the classes the translate popup
styles: d-pos (part of speech), d-syn (synonyms), d-ex (usage example).

Note: dict.dict.dz is plain gzip, not true dictzip (no random-access extra
field). TutorAI decompresses the whole file on load so it never seeks; the
fileset is not meant for other StarDict readers.
"""

from __future__ import annotations

import gzip
import io
import re
import struct
import urllib.request
import zipfile
from collections import defaultdict
from html import escape
from pathlib import Path

RELEASE_URL = "https://en-word.net/static/english-wordnet-2025.zip"
BOOKNAME = "Open English WordNet"
DESCRIPTION = (
    "Open English WordNet 2025 - CC BY 4.0 - https://en-word.net<br>"
    "Derived from Princeton WordNet; see the bundled LICENSE file."
)

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / "english-wordnet-2025.zip"
OUT_DIR = ROOT / "src-tauri" / "resources" / "dictionaries" / "wordnet"

POS_NAMES = {"n": "noun", "v": "verb", "a": "adjective", "s": "adjective", "r": "adverb"}
POS_FILES = ["noun", "verb", "adj", "adv"]


def download() -> None:
    if CACHE.exists():
        return
    print(f"downloading {RELEASE_URL} ...")
    with urllib.request.urlopen(RELEASE_URL) as resp:
        CACHE.write_bytes(resp.read())
    print(f"  {CACHE.stat().st_size / 1e6:.1f} MB")


def read_wndb(zf: zipfile.ZipFile, name: str) -> list[str]:
    """Lines of a WNDB file, wherever the zip nests it."""
    path = next(n for n in zf.namelist() if n.endswith(f"/{name}") or n == name)
    with zf.open(path) as f:
        return io.TextIOWrapper(f, encoding="utf-8").read().splitlines()


def parse_gloss(gloss: str) -> tuple[str, list[str]]:
    """WNDB gloss = 'definition; "example"; "example2"'."""
    examples, keep = [], []
    for part in (p.strip() for p in gloss.split("; ")):
        if part.startswith('"') and part.endswith('"'):
            examples.append(part[1:-1])
        else:
            keep.append(part)
    return "; ".join(keep).strip(), examples


def load_synsets(
    zf: zipfile.ZipFile,
) -> dict[tuple[str, str], tuple[list[str], str, str, list[str]]]:
    """(pos_file, offset) -> (synset words, pos name, definition, examples)."""
    synsets = {}
    for pos in POS_FILES:
        for line in read_wndb(zf, f"data.{pos}"):
            if line.startswith("  ") or not line.strip():
                continue
            head, _, gloss = line.partition(" | ")
            fields = head.split()
            offset, ss_type, w_cnt = fields[0], fields[2], int(fields[3], 16)
            # Strip WordNet's adjective position markers: running(a), akin(p).
            words = [
                re.sub(r"\((a|p|ip)\)$", "", fields[4 + i * 2]).replace("_", " ")
                for i in range(w_cnt)
            ]
            definition, examples = parse_gloss(gloss.strip())
            synsets[(pos, offset)] = (words, POS_NAMES[ss_type], definition, examples)
    return synsets


def load_index(zf: zipfile.ZipFile) -> dict[str, list[tuple[str, str]]]:
    """lemma -> [(pos_file, synset_offset)] in WordNet's sense order."""
    index: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for pos in POS_FILES:
        for line in read_wndb(zf, f"index.{pos}"):
            if line.startswith("  ") or not line.strip():
                continue
            fields = line.split()
            lemma = fields[0].replace("_", " ")
            synset_cnt = int(fields[2])
            p_cnt = int(fields[3])
            offsets = fields[4 + p_cnt + 2 :]
            assert len(offsets) == synset_cnt, line
            index[lemma].extend((pos, off) for off in offsets)
    return index


def entry_html(lemma: str, senses, synsets) -> str:
    """One headword's entry: senses grouped by part of speech, in order."""
    by_pos: dict[str, list[str]] = defaultdict(list)
    for key in senses:
        words, pos_name, definition, examples = synsets[key]
        others = [w for w in words if w.lower() != lemma.lower()]
        li = escape(definition)
        if others:
            li += f' <span class="d-syn">{escape(", ".join(others))}</span>'
        for ex in examples[:1]:
            li += f' <span class="d-ex">&#8220;{escape(ex)}&#8221;</span>'
        by_pos[pos_name].append(f"<li>{li}</li>")
    parts = []
    for pos_name, items in by_pos.items():
        parts.append(f'<div class="d-pos">{pos_name}</div><ol>{"".join(items)}</ol>')
    return "".join(parts)


def stardict_sort_key(word: str) -> tuple[bytes, bytes]:
    """g_ascii_strcasecmp order, ties broken by strcmp — per the spec.
    TutorAI ignores .idx order, but keep the fileset well-formed."""
    b = word.encode("utf-8")
    return (bytes(c + 32 if 65 <= c <= 90 else c for c in b), b)


def write_stardict(entries: dict[str, str]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    data = bytearray()
    idx = bytearray()
    for word in sorted(entries, key=stardict_sort_key):
        body = entries[word].encode("utf-8")
        idx += word.encode("utf-8") + b"\0" + struct.pack(">II", len(data), len(body))
        data += body
    (OUT_DIR / "dict.idx").write_bytes(idx)
    # mtime=0 keeps the gzip output byte-identical across rebuilds.
    with open(OUT_DIR / "dict.dict.dz", "wb") as f:
        with gzip.GzipFile(fileobj=f, mode="wb", mtime=0) as gz:
            gz.write(bytes(data))
    (OUT_DIR / "dict.ifo").write_text(
        "StarDict's dict ifo file\n"
        "version=3.0.0\n"
        f"bookname={BOOKNAME}\n"
        f"wordcount={len(entries)}\n"
        f"idxfilesize={len(idx)}\n"
        "sametypesequence=h\n"
        f"description={DESCRIPTION}\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"wrote {len(entries)} entries")
    print(f"  dict.idx      {len(idx) / 1e6:.1f} MB")
    print(f"  dict.dict.dz  {(OUT_DIR / 'dict.dict.dz').stat().st_size / 1e6:.1f} MB")


def write_license(zf: zipfile.ZipFile) -> None:
    try:
        text = "\n".join(read_wndb(zf, "LICENSE"))
    except StopIteration:
        text = (
            "Open English WordNet - https://en-word.net\n"
            "Licensed under Creative Commons Attribution 4.0 International (CC BY 4.0)\n"
            "https://creativecommons.org/licenses/by/4.0/\n"
        )
    (OUT_DIR / "LICENSE").write_text(text, encoding="utf-8", newline="\n")


def main() -> None:
    download()
    with zipfile.ZipFile(CACHE) as zf:
        synsets = load_synsets(zf)
        index = load_index(zf)
        entries = {
            lemma: entry_html(lemma, senses, synsets) for lemma, senses in index.items()
        }
        write_stardict(entries)
        write_license(zf)


if __name__ == "__main__":
    main()
