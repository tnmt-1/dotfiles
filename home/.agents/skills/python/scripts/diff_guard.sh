#!/bin/sh
# 使い方: jj diff --git | diff_guard.sh
# 追加行のうち、逃げ道の印（暫定対応のコメント、警告の抑止、テストのスキップ）を含む行を出す。
# 同じ内容の行が削除側にもあれば、移動とみなして出さない。見つかれば終了コード1。
# 差分が空なら終了コード2。diffコマンドの失敗を合格と取り違えないため。
awk '
BEGIN {
  pat = "暫定|一時的|とりあえず|仮対応|応急|workaround|fixme|noqa|type: *ignore|pragma: *no *cover|pytest\\.mark\\.(skip|xfail)|unittest\\.skip|@skip"
}
/^\+\+\+ / { file = substr($0, 7); next }
/^--- / { next }
/^-/ { s = substr($0, 2); gsub(/^[ \t]+|[ \t]+$/, "", s); removed[s] = 1; next }
/^\+/ {
  s = substr($0, 2)
  if (tolower(s) ~ pat) {
    t = s; gsub(/^[ \t]+|[ \t]+$/, "", t)
    n++; key[n] = t; line[n] = file ": " t
  }
}
END {
  if (NR == 0) { print "差分が空です。diffコマンドの失敗か、変更なしです" > "/dev/stderr"; exit 2 }
  bad = 0
  for (i = 1; i <= n; i++) if (!(key[i] in removed)) { print line[i]; bad = 1 }
  exit bad
}'
