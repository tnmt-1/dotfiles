---
name: verify-dxp-id-backend
description: dxp-id-backend（Uniikey ID管理バックエンド、Django REST framework）のチェックアウトやworktreeを別ポートで起動し、dxp-app-backendとAuth Hubが呼ぶのと同じ方法（特権ユーザーのトークン、内部APIのポート）でAPIを呼んで、変更が動くことを証跡付きで確かめる。dxp-id-backendの変更を「動かして確かめて」「APIを叩いて確認して」「検証して」と言われたとき、実装を終えて完了と言う前、管理コマンド（バッチ）を手元で動かすときに使う。
---

# dxp-id-backend を動かして確かめる

対象は、dxp-environment-setupの `repos/` にあるdxp-id-backendのチェックアウトとworktreeである。dxp-environment-setupの場所は `~/dev/cdm/dxp-environment-setup` で、`DXP_ENV_DIR` で変えられる。操作は `scripts/verify.sh` で行う。以下では `V=~/.pi/agent/skills/verify-dxp-id-backend/scripts/verify.sh` とする。

機能ごとの手順は [features/README.md](features/README.md) にある。

dxp-id-backendに画面はない。利用者が触るのは、次の呼び出し元を経由したAPIである。

| 呼び出し元 | パス | 認証 |
| --- | --- | --- |
| dxp-app-backend（UEC管理画面） | `/admin/` | `UNIIKEY-SU-ACCESS-TOKEN` ヘッダーに特権ユーザーのトークン |
| Auth Hub（dxp-central-login-server） | `/internal/` | ポートが1443、8000、8001のどれかであること |
| 会員のサービス、外部RP | `/v1/` | APIによって、なし、Basic認証、アクセストークン |

## 守ること

- 1443番のid-backend（miseのdaemon、`repos/dxp-id-backend` のコード）と、8001番のCaddyは操作しない。止めない、再起動しない。検証では、対象のチェックアウトを `verify.sh` で別のポートに起動する。
- データベース `dxp_id_dev`、Redis、MongoDBは、1443番のid-backendと共有している。データを分ける方法はない。
  - `migrate` は実行しない。doctorが未適用のマイグレーションを出したら、適用するかをユーザーに確認する。
  - データを書き換えるAPI（POST、PATCH、PUT、DELETE）と管理コマンドは、実行する前にユーザーの確認を得る。
- 外部サービスへの書き込みも、実行する前にユーザーの確認を得る。対象は、開発用のAuthlete、SendGrid、Infobip、AWS（S3、Step Functions）、GCP（Pub/Sub、Identity Platform）である。GETでもAuthleteを読むAPIがある（`/internal/discovery/`、`/admin/<ユーザープールID>/service/security_settings/` など）。読み取りなので、確認は不要である。
- `.env` の中身は表示しない。特権ユーザーのトークンは `verify.sh start` が `.env` から読み、`/tmp` のヘッダーファイルに置く。
- 自分が起動したものだけを止める。プロセス名でkillしない。

## 起動する（Launch）

前提： dxp-environment-setupで `mise run up` と `mise run seed` が済んでいる。対象のチェックアウトに `.venv`（`poetry install` で作る）と `.env` がある。worktreeには `.env` がないので、`repos/dxp-id-backend/.env` をコピーする。

```bash
cd <対象のチェックアウト>     # 例: ~/dev/cdm/dxp-environment-setup/repos/dxp-id-backend
$V start                       # 1444番で起動する。別の番号は VERIFY_PORT=1445 $V start
$V ids                         # seedのユーザープールグループ、ユーザープール、ユーザープールチャイルドのIDを出す
```

- `start` は `/healthcheck/` が200を返すまで待ち、`OK: http://127.0.0.1:1444 で起動した` と証跡のディレクトリーを出す。返らなければ、サーバーのログの末尾を出して終了コード1で終わる。
- 設定は、チェックアウトの `.env` を `src/config/settings.py` が読む。dxp-environment-setupの設定ファイルは使わない。
- 起動するのはコードだけである。データベースは共有の `dxp_id_dev` を使うので、seedのデータがそのまま使える。
- `--noreload` で起動する。コードを直したら `$V stop` と `$V start` をやり直す。

## 確かめる（Doctor）

```bash
$V doctor
```

何かがおかしいときは、最初にこれを実行する。読み取りだけを行い、すべて `OK` なら終了コード0で終わる。

- MySQL（3307）、Redis（16379）、MongoDB（27018）が応答するか
- 記録したPIDが動いていて、そのポートを使っているか
- 起動したディレクトリーが対象のチェックアウトか
- `/healthcheck/` が200を返すか、特権ユーザーのトークンを読めたか
- 未適用のマイグレーションがないか。あれば一覧を出す

## 操作する（Drive）

```bash
$V get admin/<ユーザープールID>/user_pool_child/ user-pool-child-list   # GET を送り、応答を証跡に残す。2xx なら終了コード0
$V manage <コマンド> [引数...]                                          # 管理コマンドを同じ設定で実行する（実行前にユーザーに確認する）
```

- `get` は、パスの先頭を見て呼び出し元と同じヘッダーを付ける。`admin/` には特権ユーザーのトークン、`internal/` には `X-Forwarded-Port: 1443` を付ける。`v1/` には何も付けない。
- パスの先頭の `/` は省略できる。IDは `ids` の出力から取る。seedの値（`ugp_...`、`upl_...`、`child_...`）は環境ごとに違う。
- `get` 以外のメソッドは、ユーザーの確認を得てからcurlで送る。ヘッダーは次のように付ける。送ったリクエストは証跡の `requests.log` に手で追記する。

  ```bash
  S=/tmp/verify-dxp-id-backend-1444
  curl -s -X PATCH -H @$S/su-header -H 'Content-Type: application/json' \
    --data '{...}' http://127.0.0.1:1444/admin/<パス>
  ```
- 管理コマンドの一覧は、対象のチェックアウトで `ls src/*/management/commands/` を実行して確かめる。

## 証跡（Evidence）

証跡は `~/.cache/verify-dxp-id-backend/<日時>-<ポート>/` に残る（`VERIFY_ARTIFACT_ROOT` で変えられる）。

| ファイル | 内容 |
| --- | --- |
| `requests.log` | 送ったリクエストの日時、メソッド、パス、ステータス |
| `ids.txt` | `ids` が出したseedのID |
| `<名前>.json` | 応答の本文。キー名の末尾が token、secret、password、api_key、access_key、secret_key の値は `***` に置き換える |
| `manage-*.cmd` `.out` `.err` `.rc` | 管理コマンドの引数、標準出力、標準エラー、終了コード |
| `server.log` | `stop` のときにコピーするサーバーのログ |

証明の基準は次のとおりである。

- 呼び出し元と同じAPIを、同じ認証で呼ぶ。テスト用のエンドポイント、`force_login`、shellからのモデル操作で代えない。`ids` のshellは、IDを引くためだけに使う。
- 書き込みを確かめるときは、書き込んだ応答だけでなく、別のGETで保存された値を読み直す。MySQLの行、MongoDBのドキュメント、Authleteの設定など、副作用も確かめる。
- 外部サービスのモックは使わない。外部に書き込む操作を確かめられないときは、その操作を「確かめていない」と報告する。

## 片付ける（Cleanup）

```bash
$V stop
```

- `start` が記録したPIDのrunserverだけを止め、`/tmp/verify-dxp-id-backend-<ポート>/`（PID、トークンのヘッダーファイル、ログ）を消す。
- 証跡は消さない。`stop` の出力にある証跡のディレクトリーが残っていることを確かめる。
- `start` が途中で失敗したときも、`stop` を実行してからやり直す。
- 確認を得てデータを書き換えたときは、作ったものを管理APIで戻す。戻せないものは、残ったことを報告する。

## ヘルパー

`scripts/verify.sh` のサブコマンドは次の6つである。ポートは `VERIFY_PORT`（既定1444。1443、8000、8001は拒否する）で選ぶ。ポートごとに状態を分けるので、2つのチェックアウトを別々のポートで同時に起動できる。

| サブコマンド | すること |
| --- | --- |
| `start` | カレントディレクトリーのチェックアウトを起動する |
| `doctor` | 起動したサーバーと周りのサービスを確かめる |
| `ids` | seedのユーザープールグループ、ユーザープール、ユーザープールチャイルドのIDを出す |
| `get <パス> [名前]` | GET を送り、応答を `<名前>.json` に残す |
| `manage <コマンド> [引数...]` | 管理コマンドを実行し、出力と終了コードを残す |
| `stop` | 起動したサーバーを止め、証跡のディレクトリーを出す |
