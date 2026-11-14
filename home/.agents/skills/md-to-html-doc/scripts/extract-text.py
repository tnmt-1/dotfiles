#!/usr/bin/env python3
"""HTMLから画面に出る文字列を取り出し、1ブロック1段落のテキストにして標準出力へ書く。

script、style、code の中身は出さない。同じ文字列は最初の1回だけ出す。
使い方: extract-text.py page.html > text.md
"""
import sys
from html.parser import HTMLParser

SKIP = {"script", "style", "code"}
BLOCK = {
    "p", "li", "h1", "h2", "h3", "h4", "h5", "span", "td", "th", "text",
    "div", "summary", "figcaption", "label", "button", "dt", "dd", "caption",
}


class Extractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip = 0
        self.buf = []
        self.out = []

    def handle_starttag(self, tag, _attrs):
        if tag in SKIP:
            self.skip += 1
        elif tag in BLOCK:
            self.flush()

    def handle_endtag(self, tag):
        if tag in SKIP:
            self.skip -= 1
        elif tag in BLOCK:
            self.flush()

    def handle_data(self, data):
        if not self.skip:
            self.buf.append(data)

    def flush(self):
        text = "".join(self.buf).strip()
        self.buf = []
        if text and text not in self.out:
            self.out.append(text)


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: extract-text.py page.html")
    with open(sys.argv[1], encoding="utf-8") as f:
        parser = Extractor()
        parser.feed(f.read())
        parser.flush()
    print("\n\n".join(parser.out))


if __name__ == "__main__":
    main()
