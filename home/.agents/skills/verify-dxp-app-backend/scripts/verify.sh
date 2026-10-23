#!/bin/sh
# dxp-app-backend のチェックアウトを別ポートで起動し、UEC の API を画面と同じ方法で呼んで、証跡を残す。
# 使い方は ../SKILL.md を参照する。
set -u

ENV_DIR=${DXP_ENV_DIR:-$HOME/dev/cdm/dxp-environment-setup}
PORT=${VERIFY_PORT:-8100}
STATE=/tmp/verify-dxp-app-backend-$PORT
BASE=http://127.0.0.1:$PORT
ARTIFACT_ROOT=${VERIFY_ARTIFACT_ROOT:-$HOME/.cache/verify-dxp-app-backend}

die() { echo "NG: $*" >&2; exit 1; }

# カレントディレクトリから上へたどり、src/manage.py があるディレクトリをチェックアウトのルートとする
find_root() {
  dir=$(pwd)
  while [ "$dir" != / ]; do
    [ -f "$dir/src/manage.py" ] && { echo "$dir"; return 0; }
    dir=$(dirname "$dir")
  done
  die "dxp-app-backend のチェックアウトの中で実行する（src/manage.py が見つからない）"
}

need_state() {
  [ -f "$STATE/pid" ] || die "$PORT 番のサーバは verify.sh で起動していない。先に start を実行する"
  ROOT=$(cat "$STATE/root")
  ART=$(cat "$STATE/artifacts")
}

# app_backend_local_settings は、メールを dxp-environment-setup の mails/ に書き出す設定
django() {
  (cd "$ROOT/src" && PYTHONPATH="$ENV_DIR/settings" DJANGO_SETTINGS_MODULE=app_backend_local_settings ../.venv/bin/python manage.py "$@")
}

# JSON のうち、トークン、キー、パスワードの値を伏せる。JSON でなければそのまま出す
redact() {
  python3 -c '
import json, re, sys
raw = sys.stdin.read()
pattern = re.compile(r"(token|secret|pass|api_key|access_key)", re.I)
def walk(value):
    if isinstance(value, dict):
        return {k: ("***" if pattern.search(k) and v not in (None, "") else walk(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [walk(v) for v in value]
    return value
try:
    print(json.dumps(walk(json.loads(raw)), ensure_ascii=False, indent=2))
except ValueError:
    sys.stdout.write(raw)
'
}

log_request() { echo "$(date '+%Y-%m-%dT%H:%M:%S') $1 /$2 $3" >> "$ART/requests.log"; }

cmd_start() {
  [ "$PORT" != 8000 ] || die "8000 番は mise の app-backend が使う。VERIFY_PORT に別の番号を指定する"
  [ ! -e "$STATE/pid" ] || die "$PORT 番はすでに verify.sh で起動している。stop してから start する"
  ROOT=$(find_root) || exit 1
  [ -x "$ROOT/.venv/bin/python" ] || die "$ROOT/.venv がない。チェックアウトで依存をインストールする（uv sync または poetry install）"
  [ -f "$ROOT/.env" ] || die "$ROOT/.env がない"
  ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 || die "$PORT 番はほかのプロセスが使っている"

  run_id=$(date +%Y%m%d-%H%M%S)-$PORT
  ART=$ARTIFACT_ROOT/$run_id
  mkdir -p "$STATE" "$ART"
  echo "$ROOT" > "$STATE/root"
  echo "$ART" > "$STATE/artifacts"

  # サブシェルを挟まずに起動して、$! を python 自身の PID にする
  cd "$ROOT/src" || exit 1
  PYTHONPATH="$ENV_DIR/settings" DJANGO_SETTINGS_MODULE=app_backend_local_settings \
    nohup ../.venv/bin/python manage.py runserver "127.0.0.1:$PORT" --noreload > "$STATE/server.log" 2>&1 &
  echo $! > "$STATE/pid"

  i=0
  while [ $i -lt 60 ]; do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/version/")" = 200 ] && {
      echo "OK: $BASE で起動した（checkout=${ROOT}）"
      echo "証跡: $ART"
      return 0
    }
    kill -0 "$(cat "$STATE/pid")" 2>/dev/null || break
    sleep 1
    i=$((i + 1))
  done
  tail -20 "$STATE/server.log" >&2
  die "起動しなかった。上のログを見て直し、stop を実行してからやり直す"
}

cmd_doctor() {
  fail=0
  ok() { echo "OK: $*"; }
  ng() { echo "NG: $*"; fail=1; }

  nc -z 127.0.0.1 3307 2>/dev/null && ok "MySQL（127.0.0.1:3307）" || ng "MySQL（127.0.0.1:3307）が応答しない。dxp-environment-setup で mise run up を実行する"
  nc -z 127.0.0.1 26379 2>/dev/null && ok "Redis（127.0.0.1:26379）" || ng "Redis（127.0.0.1:26379）が応答しない。ログインに必要"
  [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:1443/healthcheck/)" = 200 ] && ok "dxp-id-backend（1443）" || ng "dxp-id-backend（1443）が応答しない。ユーザープールや会員の API に必要"

  [ -f "$STATE/pid" ] || { ng "$PORT 番のサーバは verify.sh で起動していない"; return $fail; }
  ROOT=$(cat "$STATE/root")
  pid=$(cat "$STATE/pid")
  if kill -0 "$pid" 2>/dev/null; then ok "PID $pid が動いている"; else ng "PID $pid が止まっている。stop してから start する"; fi
  lsof -nP -a -p "$pid" -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && ok "$PORT 番は PID $pid が使っている" || ng "$PORT 番を PID $pid が使っていない"
  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
  [ "$cwd" = "$ROOT/src" ] && ok "起動したコード: $ROOT" || ng "起動したディレクトリが $ROOT/src ではない（${cwd}）"
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/version/")" = 200 ] && ok "$BASE/version/ が 200" || ng "$BASE/version/ が 200 でない"

  # dxp_app_dev は mise の app-backend と共有している。このチェックアウトにだけあるマイグレーションは適用しない
  unapplied=$(django showmigrations --plan 2>/dev/null | grep '^\[ \]')
  if [ -z "$unapplied" ]; then ok "未適用のマイグレーションはない"; else ng "dxp_app_dev に未適用のマイグレーションがある。適用するかはユーザーに確認する"; echo "$unapplied"; fi

  if [ -f "$STATE/cookies" ]; then
    [ "$(curl -s -b "$STATE/cookies" -o /dev/null -w '%{http_code}' "$BASE/user/is_login/")" = 200 ] && ok "ログインしている" || ng "セッションが切れている。login を実行する"
  else
    echo "--: まだログインしていない（login を実行する）"
  fi
  return $fail
}

cmd_login() {
  need_state
  umask 077
  # SEED_EMAIL と SEED_PASSWORD は dxp-environment-setup の mise.local.toml にある。値は表示しない
  (cd "$ENV_DIR" && mise env --json 2>/dev/null) | python3 -c '
import json, sys
env = json.load(sys.stdin)
if not env.get("SEED_EMAIL") or not env.get("SEED_PASSWORD"):
    sys.exit("SEED_EMAIL か SEED_PASSWORD が mise.local.toml にない")
print(json.dumps({"email": env["SEED_EMAIL"], "password": env["SEED_PASSWORD"]}))
' > "$STATE/login-body.json" || { rm -f "$STATE/login-body.json"; die "認証情報を読めなかった"; }

  # ログイン済みのセッションで POST すると CSRF で 403 になるので、Cookie を捨ててから送る
  rm -f "$STATE/cookies"
  code=$(curl -s -c "$STATE/cookies" -o "$STATE/login.out" -w '%{http_code}' \
    -H 'Content-Type: application/json' --data @"$STATE/login-body.json" "$BASE/user/login_gidp/")
  rm -f "$STATE/login-body.json"
  redact < "$STATE/login.out" > "$ART/login.json"
  rm -f "$STATE/login.out"
  log_request POST user/login_gidp/ "$code"
  [ "$code" = 200 ] || { cat "$ART/login.json" >&2; die "ログインできなかった（${code}）"; }
  python3 - "$ART/login.json" <<'EOF'
import json, sys
data = json.load(open(sys.argv[1]))
if data.get("requireOtp"):
    sys.exit("NG: 2要素認証が有効な法人のユーザーなので、この手順ではログインできない")
print(f"OK: {data['email']} でログインした")
for tenant in data.get("tenant", []):
    print(f"tenant {tenant['id']} {tenant['name']}")
for corporation in data.get("corporations", []):
    print(f"corporation {corporation['id']} {corporation['name']}")
EOF
}

# GET だけを送る。POST、PATCH、DELETE は外部への書き込みがあるか確かめてから、ユーザーの確認を得て curl で送る
cmd_get() {
  need_state
  [ $# -ge 1 ] || die "使い方: verify.sh get <パス> [証跡の名前]"
  path=${1#/}
  name=${2:-$(echo "$path" | sed 's#[/?=&]#_#g; s#_*$##')}
  code=$(curl -s -b "$STATE/cookies" -o "$STATE/body" -w '%{http_code}' "$BASE/$path")
  redact < "$STATE/body" > "$ART/$name.json"
  rm -f "$STATE/body"
  log_request GET "$path" "$code"
  echo "$code GET /$path -> $ART/$name.json"
  head -c 800 "$ART/$name.json"
  echo
  case $code in 2*) return 0 ;; *) return 1 ;; esac
}

# 管理コマンドを、サーバと同じ設定で実行する。標準出力、標準エラー、終了コードを証跡に残す
cmd_manage() {
  need_state
  [ $# -ge 1 ] || die "使い方: verify.sh manage <コマンド> [引数...]"
  name=manage-$(date +%H%M%S)-$1
  echo "manage.py $*" > "$ART/$name.cmd"
  django "$@" > "$ART/$name.out" 2> "$ART/$name.err"
  rc=$?
  echo "$rc" > "$ART/$name.rc"
  echo "exit=$rc -> $ART/$name.{cmd,out,err,rc}"
  tail -20 "$ART/$name.out"
  [ $rc = 0 ] || tail -20 "$ART/$name.err" >&2
  return $rc
}

cmd_stop() {
  [ -d "$STATE" ] || { echo "$PORT 番は verify.sh で起動していない"; return 0; }
  ART=$(cat "$STATE/artifacts" 2>/dev/null || true)
  pid=$(cat "$STATE/pid" 2>/dev/null || true)
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    # プロセス名では止めない。start が記録した PID が、このポートの runserver のときだけ止める
    case $(ps -o command= -p "$pid") in
      *"runserver 127.0.0.1:$PORT"*) kill "$pid" ;;
      *) die "PID $pid は verify.sh が起動した runserver ではない。止めずに終わる" ;;
    esac
    i=0
    while kill -0 "$pid" 2>/dev/null && [ $i -lt 10 ]; do sleep 1; i=$((i + 1)); done
    kill -0 "$pid" 2>/dev/null && die "PID $pid が止まらない"
  fi
  [ -n "$ART" ] && [ -f "$STATE/server.log" ] && cp "$STATE/server.log" "$ART/server.log"
  rm -rf "$STATE"
  echo "OK: 停止した。証跡は残した: $ART"
}

case ${1:-} in
  start | doctor | login | get | manage | stop)
    cmd=$1
    shift
    "cmd_$cmd" "$@"
    ;;
  *) die "使い方: verify.sh start|doctor|login|get <パス>|manage <コマンド>|stop（ポートは VERIFY_PORT、既定は 8100）" ;;
esac
