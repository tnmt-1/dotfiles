#!/usr/bin/env bash
# HTMLを幅1280pxと幅375pxで描画し、スクリーンショットとはみ出しの検査結果を出す。
#
# 使い方: render.sh page.html outdir
# 出力:
#   outdir/desktop-NN.png  幅1280pxの画面を縦1400pxごとに分けたもの
#   outdir/phone-NN.png    幅375pxの画面を縦1500pxごとに分けたもの
#   標準出力               幅1280pxと幅500pxでの「表示幅 文書幅 はみ出した要素」
#
# ヘッドレスのChromeは幅500px未満のウィンドウを作れない。幅375pxは iframe に入れて描画する。
# 文書の骨組み（<!doctype>）がないHTMLは、骨組みを付けてから描画する。
set -euo pipefail

src=${1:?usage: render.sh page.html outdir}
out=${2:?usage: render.sh page.html outdir}
mkdir -p "$out"
src_abs=$(cd "$(dirname "$src")" && pwd)/$(basename "$src")
out_abs=$(cd "$out" && pwd)

chrome=""
for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" google-chrome chromium chromium-browser; do
  if command -v "$c" >/dev/null 2>&1 || [ -x "$c" ]; then chrome=$c; break; fi
done
[ -n "$chrome" ] || { echo "Chrome が見つからない" >&2; exit 1; }
command -v magick >/dev/null || { echo "ImageMagick（magick）が見つからない" >&2; exit 1; }

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# 骨組みを付けたページと、はみ出しを調べるスクリプトを足したページを作る
python3 - "$src_abs" "$work" <<'EOF'
import sys, pathlib
src, work = sys.argv[1], pathlib.Path(sys.argv[2])
html = pathlib.Path(src).read_text(encoding="utf-8")
if "<!doctype" not in html.lower():
    html = ('<!doctype html><html lang="ja"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'
            + html + "</body></html>")
probe = ('<script>(()=>{const d=document.documentElement;'
         'const wide=[...document.querySelectorAll("body *")]'
         '.filter(e=>e.getBoundingClientRect().right>d.clientWidth+1'
         '&&!e.closest("[style*=overflow],.scroll,.fig-box,.tbl-box"))'
         '.filter(e=>getComputedStyle(e.parentElement).overflowX==="visible")'
         '.slice(0,10).map(e=>e.tagName.toLowerCase()+"."+(e.getAttribute("class")||""));'
         'document.body.setAttribute("data-probe",d.clientWidth+" "+d.scrollWidth+" "+wide.join(" | "))})()</script>')
(work / "page.html").write_text(html, encoding="utf-8")
(work / "probe.html").write_text(html.replace("</body>", probe + "</body>"), encoding="utf-8")
(work / "phone.html").write_text(
    '<!doctype html><body style="margin:0"><iframe src="page.html" '
    'style="width:375px;height:30000px;border:0"></iframe></body>', encoding="utf-8")
EOF

run() { "$chrome" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --virtual-time-budget=5000 "$@" 2>/dev/null; }

for w in 1280 500; do
  printf '幅%spx: ' "$w"
  run --window-size=$w,900 --dump-dom "file://$work/probe.html" | grep -o 'data-probe="[^"]*"' | sed 's/data-probe="//; s/"$//' || echo "検査できなかった"
done

run --window-size=1280,30000 --screenshot="$work/desktop.png" "file://$work/page.html"
run --window-size=600,30000 --screenshot="$work/phone.png" "file://$work/phone.html"

rm -f "$out_abs"/desktop-*.png "$out_abs"/phone-*.png
magick "$work/desktop.png" -trim +repage -crop x1400 +repage "$out_abs/desktop-%02d.png"
magick "$work/phone.png" -crop 375x30000+0+0 +repage -trim +repage -crop x1500 +repage "$out_abs/phone-%02d.png"
ls "$out_abs"
