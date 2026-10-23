#!/usr/bin/env python3
"""HTMLの画面に出る文のうち、元のMarkdownにない文を一覧にして標準出力へ書く。

空白、句読点、かっこ、Markdownの記号を除いてから比べる。
句点で区切った1文ずつ調べ、元の文書に含まれない文だけを「- 」付きで出す。
6文字未満の文字列（見出しやラベル）は出さない。
使い方: diff-from-source.py page.html source.md
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from importlib import import_module

extract = import_module("extract-text")

IGNORED = r"[\s。、，,.「」『』（）()［］\[\]：:・\-|*`>#]"


def normalize(text):
    return re.sub(IGNORED, "", text)


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: diff-from-source.py page.html source.md")
    html_path, md_path = sys.argv[1], sys.argv[2]
    source = normalize(Path(md_path).read_text(encoding="utf-8"))

    parser = extract.Extractor()
    parser.feed(Path(html_path).read_text(encoding="utf-8"))
    parser.flush()

    for block in parser.out:
        for sentence in re.split(r"(?<=。)", block):
            key = normalize(sentence)
            if len(key) >= 6 and key not in source:
                print("-", sentence.strip())


if __name__ == "__main__":
    main()
