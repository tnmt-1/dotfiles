#!/bin/sh
# 使い方: check_pr.sh <テンプレート> <タイトル> <本文ファイル>
# PRのタイトルと本文を、gh pr create / gh pr edit に渡す前に検査する。問題があれば一覧を出して終了コード1。
set -u
[ $# -eq 3 ] || { echo "使い方: $0 <テンプレート> <タイトル> <本文ファイル>" >&2; exit 2; }
template=$1; title=$2; body=$3
[ -f "$template" ] || { echo "テンプレートがありません: ${template}" >&2; exit 2; }
[ -f "$body" ] || { echo "本文ファイルがありません: ${body}" >&2; exit 2; }
ng=0

if ! printf '%s\n' "$title" | grep -qE '^(feat|fix|docs|refactor|test|chore): [^ ]'; then
  echo "タイトルが「type: 日本語の要約」の形ではありません: ${title}"; ng=1
fi

if ! grep -q '[^[:space:]]' "$body"; then
  echo "本文が空です"; ng=1
fi

# テンプレートで最も浅い見出しの階層を、トップレベルとみなす
level=$(grep -E '^#{1,6} ' "$template" | sed -E 's/^(#+).*/\1/' | awk '{print length}' | sort -n | head -1)
if [ -n "$level" ]; then
  headings() {
    grep -E "^#{${level}} " "$1" | sed -E 's/<!--.*-->//; s/[[:space:]]+$//'
  }
  expected=$(headings "$template"); actual=$(headings "$body")
  if [ "$expected" != "$actual" ]; then
    echo "トップレベルの見出しがテンプレートと一致しません"
    printf '%s\n' "$expected" >"${TMPDIR:-/tmp}/check_pr.expected"
    printf '%s\n' "$actual" >"${TMPDIR:-/tmp}/check_pr.actual"
    diff "${TMPDIR:-/tmp}/check_pr.expected" "${TMPDIR:-/tmp}/check_pr.actual" | sed 's/^/  /'
    ng=1
  fi
fi

# <テンプレートに沿った本文> のような、日本語を含む山かっこの置き場所が残っていないか。HTMLコメントは除く
left=$(perl -CSD -ne 'print "  $.: $_" if /<(?!!--)[^>]*[^\x00-\x7f][^>]*>/' "$body")
if [ -n "$left" ]; then
  echo "埋めていない置き場所が残っています"; printf '%s\n' "$left"; ng=1
fi

exit $ng
