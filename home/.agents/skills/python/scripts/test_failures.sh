#!/bin/sh
# 使い方: test_failures.sh <出力ファイル> <テストコマンド...>
# テストを実行し、失敗・エラーになったテストのIDを並べ替えて出力ファイルに書く。
# 実装前と実装後に同じコマンドで実行し、comm -13 before.txt after.txt で新しい失敗だけを取りだす。
set -u
[ $# -ge 2 ] || { echo "使い方: $0 <出力ファイル> <テストコマンド...>" >&2; exit 2; }
out=$1; shift
log=$(mktemp "${TMPDIR:-/tmp}/test_failures.XXXXXX")
start=$(date +%s)
root=$(git rev-parse --show-toplevel 2>/dev/null || jj root 2>/dev/null || pwd)
# テストを実行したときの .py の中身のハッシュ。Pi の test-regression-guard 拡張が同じコマンドで計算して照合する
code_hash=$(cd "$root" && git ls-files -z --cached --others --exclude-standard -- '*.py' | xargs -0 shasum 2>/dev/null | shasum | cut -d' ' -f1)
"$@" >"$log" 2>&1
code=$?
# pytest: FAILED/ERROR <id> - <理由>、unittest（manage.py test）: FAIL:/ERROR: <id>。unittestの集計行 FAILED (failures=N) は除く
grep -E '^(FAILED|ERROR|FAIL:|ERROR:) ' "$log" | grep -v '^FAILED (' | sed 's/ - .*$//' | sort -u >"$out"
count=$(wc -l <"$out" | tr -d ' ')
# 終了コード0と1以外は、テストが完走していない（中断、使い方の誤り、テスト0件など）
case $code in
  0|1) ;;
  *) echo "テストが完走していません（終了コード ${code}）。収集エラーで止まった場合は --continue-on-collection-errors を付けて前後とも実行し直してください。ログ: ${log}" >&2; exit 2 ;;
esac
if [ "$code" -eq 1 ] && [ "$count" -eq 0 ]; then
  echo "終了コード1ですが失敗テストを読み取れません。コマンド自体の失敗を疑ってください。ログ: ${log}" >&2
  exit 2
fi
# 完走した実行を記録する。Pi の test-regression-guard 拡張が、実装前と実装後の比較に使う
runs=/tmp/test-failures-runs
mkdir -p "$runs"
snap="$runs/$start-$$.txt"
cp "$out" "$snap"
printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$start" "$(date +%s)" "$root" "$code_hash" "$snap" "$(printf '%s' "$*" | tr '\t\n' '  ')" >>"$runs/runs.tsv"
echo "失敗 ${count} 件 -> ${out}（ログ: ${log}）"
