#!/bin/bash
# muxy-say、muxy-pane、muxy-dispatchのテスト。
# 偽の`muxy`と`sleep`を`PATH`の先頭に置いて動かす。
# 偽の`muxy`は、セッションの状態と画面をファイルから読み、呼ばれた引数を`log`に書く。
# 実行: bash home/.local/bin/tests/muxy-scripts-test.sh
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
bin=$here/..

pass=0
fail=0
work=

ok() {
  pass=$((pass + 1))
  printf 'ok   %s\n' "$1"
}

ng() {
  fail=$((fail + 1))
  printf 'FAIL %s\n' "$1"
  if [[ -n ${2:-} ]]; then
    printf '     %s\n' "$2"
  fi
}

assert_eq() { # 名前、期待値、実際の値
  if [[ $2 == "$3" ]]; then
    ok "$1"
  else
    ng "$1" "expected=[$2] actual=[$3]"
  fi
}

assert_contains() { # 名前、含むべき文字列、実際の値
  if [[ $3 == *"$2"* ]]; then
    ok "$1"
  else
    ng "$1" "missing=[$2] actual=[$3]"
  fi
}

assert_not_contains() { # 名前、含まないはずの文字列、実際の値
  if [[ $3 != *"$2"* ]]; then
    ok "$1"
  else
    ng "$1" "unexpected=[$2] actual=[$3]"
  fi
}

# 偽の`muxy`が読み書きする、`$FAKE_MUXY`の下のファイル:
#   status/<ID>       `Live`か`Ended`。ファイルがなければ、そのセッションはない
#   screen/<ID>       今の画面
#   queue/<ID>/<連番>  `read-screen`のたびに、先頭の1つを`screen/<ID>`に移してから画面を出す
#   after-enter/<ID>  `send-keys`で`Enter`を押したとき、`screen/<ID>`に移す
#   next-id           `session create`が出すID。`create-fails`があれば失敗する
#   create-screen     `session create`で作ったセッションの最初の画面
#   log               呼ばれた引数を1回1行で書く
write_fake_muxy() {
  mkdir -p "$work/fakebin" "$work/state/status" "$work/state/screen" "$work/state/queue" "$work/state/after-enter"
  cat >"$work/fakebin/muxy" <<'EOF'
#!/bin/bash
d=$FAKE_MUXY
printf '%s\n' "$*" >>"$d/log"
[ "$1" = session ] || { echo "fake muxy: unknown $1" >&2; exit 9; }
sub=$2
shift 2
case $sub in
  create)
    [ -e "$d/create-fails" ] && { echo "muxy: create failed" >&2; exit 1; }
    id=$(cat "$d/next-id")
    echo Live >"$d/status/$id"
    cp "$d/create-screen" "$d/screen/$id" 2>/dev/null || : >"$d/screen/$id"
    echo "$id"
    ;;
  inspect)
    id=$1
    [ -e "$d/status/$id" ] || { echo "muxy: session $id not found" >&2; exit 1; }
    printf '{"id":"%s","status":"%s","name":null}\n' "$id" "$(cat "$d/status/$id")"
    ;;
  read-screen)
    id=$1
    if [ "$(cat "$d/status/$id" 2>/dev/null)" != Live ]; then
      echo "muxy: UnknownSession: session $id does not exist" >&2
      exit 1
    fi
    next=$(ls "$d/queue/$id" 2>/dev/null | sort | head -n 1)
    [ -n "$next" ] && mv "$d/queue/$id/$next" "$d/screen/$id"
    cat "$d/screen/$id"
    ;;
  send-keys)
    id=$1
    if [ "$2" = Enter ] && [ -e "$d/after-enter/$id" ]; then
      mv "$d/after-enter/$id" "$d/screen/$id"
    fi
    echo ok
    ;;
  send | rename | show) echo ok ;;
  end)
    echo Ended >"$d/status/$1"
    echo ok
    ;;
  *) echo "fake muxy: unknown session $sub" >&2; exit 9 ;;
esac
EOF
  printf '#!/bin/bash\nexit 0\n' >"$work/fakebin/sleep"
  chmod +x "$work/fakebin/muxy" "$work/fakebin/sleep"
}

setup() {
  work=$(mktemp -d)
  write_fake_muxy
  : >"$work/state/log"
}

teardown() {
  rm -rf "$work"
}

run() { # コマンドと引数。標準出力を`out`に、標準エラーを`err`に、終了コードを`rc`に入れる
  out=$(PATH="$work/fakebin:$PATH" FAKE_MUXY="$work/state" MUXY_SESSION_ID=1 "$@" 2>"$work/err")
  rc=$?
  err=$(cat "$work/err")
  log=$(cat "$work/state/log")
}

live() { # ID、画面
  echo Live >"$work/state/status/$1"
  printf '%s\n' "$2" >"$work/state/screen/$1"
}

queue_screen() { # ID、連番、画面
  mkdir -p "$work/state/queue/$1"
  printf '%s\n' "$3" >"$work/state/queue/$1/$2"
}

nbsp=$'\xc2\xa0'
rule='────────────────────'
claude_empty="作業の出力
$rule
❯${nbsp}
$rule
  ⏵⏵ auto mode on"
claude_typed="作業の出力
$rule
❯ まだ打っている文
$rule
  ⏵⏵ auto mode on"
omp_empty="作業の出力
╭──────────────╮
│              │
╰──────────────╯"
no_input="起動しています"

# --- muxy-say ---

setup
run "$bin/muxy-say" abc.1 "知らせ"
assert_eq "muxy-say: 数字でないIDは終了コード2" 2 "$rc"
assert_contains "muxy-say: 数字でないIDの理由を出す" "セッションID" "$err"
teardown

setup
live 42 "$claude_empty"
run "$bin/muxy-say" 42 $'1行目\n2行目'
assert_eq "muxy-say: 改行を含む指示は終了コード2" 2 "$rc"
teardown

setup
echo Ended >"$work/state/status/42"
run "$bin/muxy-say" 42 "知らせ"
assert_eq "muxy-say: 終わったセッションには送らず終了コード3" 3 "$rc"
assert_contains "muxy-say: 終わったセッションの状態を出す" "Ended" "$err"
teardown

setup
run "$bin/muxy-say" 42 "知らせ"
assert_eq "muxy-say: ないセッションには送らず終了コード3" 3 "$rc"
teardown

setup
live 42 "$claude_empty"
echo "$claude_empty" >"$work/state/after-enter/42"
run "$bin/muxy-say" 42 "知らせ"
assert_eq "muxy-say: Claude Codeの入力欄が空なら送って終了コード0" 0 "$rc"
assert_eq "muxy-say: 送ったIDを出す" "送りました: 42" "$out"
assert_contains "muxy-say: 文字を送る" "session send 42 知らせ" "$log"
assert_contains "muxy-say: Enterを押す" "session send-keys 42 Enter" "$log"
teardown

setup
live 42 "$omp_empty"
run "$bin/muxy-say" 42 "知らせ"
assert_eq "muxy-say: ompの入力欄が空なら送って終了コード0" 0 "$rc"
teardown

setup
live 42 "$claude_typed"
queue_screen 42 1 "$claude_typed"
queue_screen 42 2 "$claude_empty"
run "$bin/muxy-say" 42 "知らせ"
assert_eq "muxy-say: 入力欄が空になるまで待ってから送る" 0 "$rc"
assert_eq "muxy-say: 空になる前は送らない" "session send 42 知らせ" "$(grep '^session send ' "$work/state/log")"
teardown

setup
live 42 "$claude_typed"
run "$bin/muxy-say" 42 "知らせ"
assert_eq "muxy-say: 10分待っても空にならなければ終了コード4" 4 "$rc"
assert_not_contains "muxy-say: 空にならなければ送らない" "session send 42" "$log"
teardown

setup
live 42 "$claude_empty"
echo "$claude_typed" >"$work/state/after-enter/42"
run "$bin/muxy-say" 42 "知らせ"
assert_eq "muxy-say: Enterのあとも文字が残れば終了コード5" 5 "$rc"
assert_eq "muxy-say: 文字が残ればEnterを押し直す" 3 "$(grep -c '^session send-keys 42 Enter$' "$work/state/log")"
assert_contains "muxy-say: 画面の見方を案内する" "muxy-pane screen 42" "$err"
teardown

# --- muxy-pane ---

setup
live 42 "$claude_empty"
run "$bin/muxy-pane" status 42
assert_eq "muxy-pane status: 動いていればLive" "Live" "$out"
teardown

setup
echo Ended >"$work/state/status/42"
run "$bin/muxy-pane" status 42
assert_eq "muxy-pane status: 終わっていればEnded" "Ended" "$out"
teardown

setup
run "$bin/muxy-pane" status 42
assert_eq "muxy-pane status: ないセッションはEnded" "Ended" "$out"
assert_eq "muxy-pane status: ないセッションでも終了コード0" 0 "$rc"
teardown

setup
live 42 "1行目
2行目
3行目


"
run "$bin/muxy-pane" screen 42 2
assert_eq "muxy-pane screen: 下の空行を除いて最後の行を出す" "2行目
3行目" "$out"
teardown

setup
live 42 "$claude_empty"
run "$bin/muxy-pane" end 42
assert_eq "muxy-pane end: 閉じたことを出す" "閉じました: 42" "$out"
assert_contains "muxy-pane end: セッションを終える" "session end 42 --yes" "$log"
teardown

setup
echo Ended >"$work/state/status/42"
run "$bin/muxy-pane" end 42
assert_eq "muxy-pane end: 終わっていれば何もせず終了コード0" 0 "$rc"
assert_not_contains "muxy-pane end: 終わっていればendを呼ばない" "session end" "$log"
teardown

setup
run "$bin/muxy-pane" status abc
assert_eq "muxy-pane: 数字でないIDは終了コード2" 2 "$rc"
teardown

# --- muxy-dispatch ---

setup
run "$bin/muxy-dispatch" "$work/nothing" "agent"
assert_eq "muxy-dispatch: 作業ディレクトリがなければ終了コード2" 2 "$rc"
teardown

setup
mkdir "$work/repo"
echo 77 >"$work/state/next-id"
echo "$claude_empty" >"$work/state/create-screen"
run "$bin/muxy-dispatch" --name test-spec "$work/repo/" "agent --model x" "指示書を読んでください"
assert_eq "muxy-dispatch: 起動して1行を送れば終了コード0" 0 "$rc"
assert_eq "muxy-dispatch: 新しいセッションのIDだけを出す" "77" "$out"
assert_contains "muxy-dispatch: 作業ディレクトリで起動コマンドを打つ" "session create --directory $(cd "$work/repo" && pwd) -- agent --model x" "$log"
assert_contains "muxy-dispatch: 名前を付ける" "session rename 77 test-spec" "$log"
assert_contains "muxy-dispatch: 画面を切り替えずにタブで開く" "session show 77 --background" "$log"
assert_contains "muxy-dispatch: 最初の1行を送る" "session send 77 指示書を読んでください" "$log"
teardown

setup
mkdir "$work/repo"
echo 77 >"$work/state/next-id"
echo "$claude_empty" >"$work/state/create-screen"
run "$bin/muxy-dispatch" "$work/repo" "agent"
assert_eq "muxy-dispatch: 最初の1行がなければ入力欄が出たところで終了コード0" 0 "$rc"
assert_not_contains "muxy-dispatch: 名前がなければ付けない" "rename" "$log"
assert_not_contains "muxy-dispatch: 最初の1行がなければ送らない" "session send 77" "$log"
teardown

setup
mkdir "$work/repo"
echo 77 >"$work/state/next-id"
echo "$no_input" >"$work/state/create-screen"
run "$bin/muxy-dispatch" "$work/repo" "agent" "指示"
assert_eq "muxy-dispatch: 入力欄が出なければ終了コード4" 4 "$rc"
assert_eq "muxy-dispatch: 入力欄が出なくてもIDを出す" "77" "$out"
assert_contains "muxy-dispatch: 画面の最後の行を出す" "起動しています" "$err"
teardown

setup
mkdir "$work/repo"
touch "$work/state/create-fails"
run "$bin/muxy-dispatch" "$work/repo" "agent"
assert_eq "muxy-dispatch: 起動できなければ終了コード3" 3 "$rc"
teardown

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
