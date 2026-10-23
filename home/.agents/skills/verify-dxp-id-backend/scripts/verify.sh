#!/bin/sh
# dxp-id-backend のチェックアウトを別ポートで起動し、dxp-app-backend と Auth Hub が呼ぶ API を同じ方法で呼んで、証跡を残す。
# 使い方は ../SKILL.md を参照する。
set -u

ENV_DIR=${DXP_ENV_DIR:-$HOME/dev/cdm/dxp-environment-setup}
PORT=${VERIFY_PORT:-1444}
STATE=/tmp/verify-dxp-id-backend-$PORT
BASE=http://127.0.0.1:$PORT
ARTIFACT_ROOT=${VERIFY_ARTIFACT_ROOT:-$HOME/.cache/verify-dxp-id-backend}

die() { echo "NG: $*" >&2; exit 1; }

# カレントディレクトリから上へたどり、src/manage.py と src/api/admin/ があるディレクトリをチェックアウトのルートとする
find_root() {
  dir=$(pwd)
  while [ "$dir" != / ]; do
    [ -f "$dir/src/manage.py" ] && [ -d "$dir/src/api/admin" ] && { echo "$dir"; return 0; }
    dir=$(dirname "$dir")
  done
  die "dxp-id-backend のチェックアウトの中で実行する（src/manage.py が見つからない）"
}

need_state() {
  [ -f "$STATE/pid" ] || die "$PORT 番のサーバは verify.sh で起動していない。先に start を実行する"
  ROOT=$(cat "$STATE/root")
  ART=$(cat "$STATE/artifacts")
}

# 設定は、チェックアウトの .env を config/settings.py が読む
django() {
  (cd "$ROOT/src" && ../.venv/bin/python manage.py "$@")
}

# JSON のうち、トークン、キー、パスワードの値を伏せる。JSON でなければそのまま出す
# キー名の末尾で判定する。token_endpoint などの公開値は伏せない
redact() {
  python3 -c '
import json, re, sys
raw = sys.stdin.read()
pattern = re.compile(r"(token|secret|password|passwd|api_key|access_key|secret_key)$", re.I)
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

# dxp-app-backend と同じ特権ユーザーのトークンを、curl のヘッダーファイルにする。値は表示しない
write_su_header() {
  umask 077
  python3 - "$ROOT/.env" > "$STATE/su-header" <<'EOF' || { rm -f "$STATE/su-header"; die ".env に UNIIKEY_SUPERUSER_ACCESS_TOKEN がない"; }
import sys
for line in open(sys.argv[1], encoding="utf-8"):
    key, sep, value = line.strip().partition("=")
    if key == "UNIIKEY_SUPERUSER_ACCESS_TOKEN" and value:
        print(f"UNIIKEY-SU-ACCESS-TOKEN: {value.strip().strip(chr(34)).strip(chr(39))}")
        sys.exit(0)
sys.exit(1)
EOF
}

cmd_start() {
  case $PORT in 1443 | 8000 | 8001) die "$PORT 番は mise の daemon か Caddy が使う。VERIFY_PORT に別の番号を指定する" ;; esac
  [ ! -e "$STATE/pid" ] || die "$PORT 番はすでに verify.sh で起動している。stop してから start する"
  ROOT=$(find_root) || exit 1
  [ -x "$ROOT/.venv/bin/python" ] || die "$ROOT/.venv がない。チェックアウトで poetry install を実行する"
  [ -f "$ROOT/.env" ] || die "$ROOT/.env がない。repos/dxp-id-backend/.env をコピーする"
  ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 || die "$PORT 番はほかのプロセスが使っている"

  run_id=$(date +%Y%m%d-%H%M%S)-$PORT
  ART=$ARTIFACT_ROOT/$run_id
  mkdir -p "$STATE" "$ART"
  echo "$ROOT" > "$STATE/root"
  echo "$ART" > "$STATE/artifacts"
  write_su_header

  # サブシェルを挟まずに起動して、$! を python 自身の PID にする
  cd "$ROOT/src" || exit 1
  nohup ../.venv/bin/python manage.py runserver "127.0.0.1:$PORT" --noreload > "$STATE/server.log" 2>&1 &
  echo $! > "$STATE/pid"

  i=0
  while [ $i -lt 60 ]; do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/healthcheck/")" = 200 ] && {
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
  nc -z 127.0.0.1 16379 2>/dev/null && ok "Redis（127.0.0.1:16379）" || ng "Redis（127.0.0.1:16379）が応答しない。dxp-environment-setup で mise run up を実行する"
  nc -z 127.0.0.1 27018 2>/dev/null && ok "MongoDB（127.0.0.1:27018）" || ng "MongoDB（127.0.0.1:27018）が応答しない。会員の API に必要"

  [ -f "$STATE/pid" ] || { ng "$PORT 番のサーバは verify.sh で起動していない"; return $fail; }
  ROOT=$(cat "$STATE/root")
  pid=$(cat "$STATE/pid")
  if kill -0 "$pid" 2>/dev/null; then ok "PID $pid が動いている"; else ng "PID $pid が止まっている。stop してから start する"; fi
  lsof -nP -a -p "$pid" -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && ok "$PORT 番は PID $pid が使っている" || ng "$PORT 番を PID $pid が使っていない"
  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
  [ "$cwd" = "$ROOT/src" ] && ok "起動したコード: $ROOT" || ng "起動したディレクトリが $ROOT/src ではない（${cwd}）"
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/healthcheck/")" = 200 ] && ok "$BASE/healthcheck/ が 200" || ng "$BASE/healthcheck/ が 200 でない"
  [ -s "$STATE/su-header" ] && ok "特権ユーザーのトークンを読んだ" || ng "特権ユーザーのトークンがない。stop してから start する"

  # dxp_id_dev は mise の id-backend と共有している。このチェックアウトにだけあるマイグレーションは適用しない
  unapplied=$(django showmigrations --plan 2>/dev/null | grep '^\[ \]')
  if [ -z "$unapplied" ]; then ok "未適用のマイグレーションはない"; else ng "dxp_id_dev に未適用のマイグレーションがある。適用するかはユーザーに確認する"; echo "$unapplied"; fi
  return $fail
}

# seed が作ったユーザープールグループ、ユーザープール、ユーザープールチャイルドの ID を、名前から引く。読み取りだけを行う
cmd_ids() {
  need_state
  env_json=$(cd "$ENV_DIR" && mise env --json 2>/dev/null) || die "dxp-environment-setup で mise env を実行できなかった"
  echo "$env_json" | python3 -c '
import json, sys
env = json.load(sys.stdin)
print("\n".join(f"{k}={env[k]}" for k in ("SEED_USER_POOL_GROUP_NAME", "SEED_USER_POOL_NAME", "SEED_TENANT_NAME")))
' > "$STATE/seed-names"
  django shell > "$ART/ids.txt" 2> "$STATE/ids.err" <<EOF
import pathlib
names = dict(line.split("=", 1) for line in pathlib.Path("$STATE/seed-names").read_text().splitlines())
from api.models import UserPoolGroups, UserPools, UserPoolChildren
group = UserPoolGroups.objects.get(name=names["SEED_USER_POOL_GROUP_NAME"])
pool = UserPools.objects.get(name=names["SEED_USER_POOL_NAME"])
child = UserPoolChildren.objects.exclude(id=pool.account_settings_user_pool_child_id).get(user_pool=pool, name=names["SEED_TENANT_NAME"])
print(f"user_pool_group {group.id} {group.name}")
print(f"user_pool {pool.id} {pool.name}")
print(f"user_pool_child {child.id} {child.name}")
print(f"account_settings_user_pool_child {pool.account_settings_user_pool_child_id}")
EOF
  rc=$?
  rm -f "$STATE/seed-names"
  [ $rc = 0 ] || { tail -5 "$STATE/ids.err" >&2; die "seed の ID を引けなかった。dxp-environment-setup で mise run seed を済ませる"; }
  cat "$ART/ids.txt"
}

# GET だけを送る。呼び出し元と同じヘッダーを、パスの先頭で決めて付ける
#   admin/    : dxp-app-backend と同じ特権ユーザーのトークン（UNIIKEY-SU-ACCESS-TOKEN）
#   internal/ : X-Forwarded-Port: 1443（内部 API は 1443・8000・8001 番だけを受け付ける）
#   それ以外  : 何も付けない
cmd_get() {
  need_state
  [ $# -ge 1 ] || die "使い方: verify.sh get <パス> [証跡の名前]"
  path=${1#/}
  name=${2:-$(echo "$path" | sed 's#[/?=&.]#_#g; s#_*$##')}
  case $path in
    admin/*) set -- -H @"$STATE/su-header" ;;
    internal/*) set -- -H 'X-Forwarded-Port: 1443' ;;
    *) set -- ;;
  esac
  code=$(curl -s "$@" -o "$STATE/body" -w '%{http_code}' "$BASE/$path")
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
  start | doctor | ids | get | manage | stop)
    cmd=$1
    shift
    "cmd_$cmd" "$@"
    ;;
  *) die "使い方: verify.sh start|doctor|ids|get <パス>|manage <コマンド>|stop（ポートは VERIFY_PORT、既定は 1444）" ;;
esac
