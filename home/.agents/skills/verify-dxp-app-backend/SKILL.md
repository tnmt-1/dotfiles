---
name: verify-dxp-app-backend
description: dxp-app-backend（UEC管理画面のバックエンドAPI、Django REST framework）のチェックアウトやworktreeを別ポートで起動し、画面と同じログイン（user/login_gidp/）でAPIを呼んで、変更が動くことを証跡付きで確かめる。dxp-app-backendの変更を「動かして確かめて」「APIを叩いて確認して」「検証して」と言われたとき、実装を終えて完了と言う前、管理コマンド（Cloud Run Jobのバッチ）を手元で動かすときに使う。
---

# dxp-app-backend を動かして確かめる

対象は、dxp-environment-setupの `repos/` にあるdxp-app-backendのチェックアウトとworktreeである。dxp-environment-setupの場所は `~/dev/cdm/dxp-environment-setup` で、`DXP_ENV_DIR` で変えられる。操作は `scripts/verify.sh` で行う。以下では `V=~/.pi/agent/skills/verify-dxp-app-backend/scripts/verify.sh` とする。

機能ごとの手順は [features/README.md](features/README.md) にある。

## 守ること

- 8000番のapp-backend（miseのdaemon、`repos/dxp-app-backend` のコード）は操作しない。止めない、再起動しない。検証では、対象のチェックアウトを `verify.sh` で別のポートに起動する。
- データベース `dxp_app_dev`、Redis、MongoDB、mails/ は、8000番のapp-backendと共有している。データを分ける方法はない。
  - `migrate` は実行しない。doctorが未適用のマイグレーションを出したら、適用するかをユーザーに確認する。
  - データを書き換えるAPI（POST、PATCH、PUT、DELETE）と管理コマンドは、実行する前にユーザーの確認を得る。
- 外部サービスへの書き込みも、実行する前にユーザーの確認を得る。ユーザーの許可なしに実行してよいのは、ログインとGETだけである。
  - ログインは、開発用のGoogle Identity Platformを呼ぶ。これは許可されている。
  - 次の操作は確認が必要である。
    - 開発用GCP（GCS、BigQuery、Pub/Sub、Cloud Tasks）への書き込み
    - dxp-id-backend経由のAuthleteとInfobip
    - GMOのテスト環境
    - `user/logout/`（Google Identity Platformのリフレッシュトークンを取り消すので、ブラウザのセッションも切れる）
- `.env` と `mise.local.toml` は読まない。認証情報は `verify.sh login` が環境変数から読み、表示しない。
- 自分が起動したものだけを止める。プロセス名でkillしない。

## 起動する（Launch）

前提： dxp-environment-setupで `mise run up` と `mise run seed` が済んでいる。対象のチェックアウトに `.venv`（`uv sync` か `poetry install` で作る）と `.env` がある。

```bash
cd <対象のチェックアウト>     # 例: ~/dev/cdm/dxp-environment-setup/repos/dxp-app-backend-yanmaga-mail-wf
$V start                       # 8100番で起動する。別の番号は VERIFY_PORT=8101 $V start
$V login                       # SEED_EMAIL と SEED_PASSWORD でログインし、テナントIDと法人IDを出す
```

- `start` は `/version/` が200を返すまで待ち、`OK: http://127.0.0.1:8100 で起動した` と証跡のディレクトリを出す。返らなければ、サーバのログの末尾を出して終了コード1で終わる。
- 設定はdxp-environment-setupの `settings/app_backend_local_settings.py` を使う。メールは送信されず、dxp-environment-setupの `mails/` に1通1ファイルで書き出される。
- 起動するのはコードだけである。データベースは共有の `dxp_app_dev` を使うので、seedのデータ（seed法人、seedテナント）がそのまま使える。
- `--noreload` で起動する。コードを直したら `$V stop` と `$V start` をやり直す。

## 確かめる（Doctor）

```bash
$V doctor
```

何かがおかしいときは、最初にこれを実行する。読み取りだけを行い、すべて `OK` なら終了コード0で終わる。

- MySQL（3307）、Redis（26379）、dxp-id-backend（1443）が応答するか
- 記録したPIDが動いていて、そのポートを使っているか
- 起動したディレクトリが対象のチェックアウトか
- 未適用のマイグレーションがないか。あれば一覧を出す
- ログインしたセッションが有効か

## 操作する（Drive）

```bash
$V get tenant/<テナントID>/ tenant-detail      # GET を送り、応答を証跡に残す。2xx なら終了コード0
$V manage <コマンド> [引数...]                 # 管理コマンドを同じ設定で実行する（実行前にユーザーに確認する）
```

- パスは画面と同じAPIのパスで、先頭の `/` は付けても付けなくてもよい。DEBUG=Trueなので `back/` は付けない。
- テナントIDと法人IDは `login` の出力から取る。seedの値（`tnt_...`、`crp_...`）は環境ごとに違う。
- `get` 以外のメソッドは、ユーザーの確認を得てからcurlで送る。Cookieは `/tmp/verify-dxp-app-backend-<ポート>/cookies` にある。POST、PATCH、DELETEはCSRFトークンがないと403になるので、次のように `X-CSRFToken` を付ける。送ったリクエストは証跡の `requests.log` に手で追記する。

  ```bash
  S=/tmp/verify-dxp-app-backend-8100
  curl -s -b $S/cookies -H 'Content-Type: application/json' \
    -H "X-CSRFToken: $(awk '$6=="csrftoken"{print $7}' $S/cookies)" \
    --data '{...}' http://127.0.0.1:8100/<パス>
  ```
- 管理コマンドの一覧は、対象のチェックアウトで `ls src/*/management/commands/` を実行して確かめる。

## 証跡（Evidence）

証跡は `~/.cache/verify-dxp-app-backend/<日時>-<ポート>/` に残る（`VERIFY_ARTIFACT_ROOT` で変えられる）。

| ファイル | 内容 |
| --- | --- |
| `requests.log` | 送ったリクエストの日時、メソッド、パス、ステータス |
| `login.json`、`<名前>.json` | 応答の本文。キー名に token、secret、pass、api_key、access_key を含む値は `***` に置き換える |
| `manage-*.cmd` `.out` `.err` `.rc` | 管理コマンドの引数、標準出力、標準エラー、終了コード |
| `server.log` | `stop` のときにコピーするサーバのログ |

証明の基準は次のとおりである。

- 画面と同じAPIを、画面と同じログインで呼ぶ。テスト用のエンドポイント、`force_login`、shellからのモデル操作で代えない。
- 書き込みを確かめるときは、書き込んだ応答だけでなく、別のGETで保存された値を読み直す。データベースの行、`mails/` のファイル、GCSのオブジェクトなど、副作用も確かめる。
- 外部サービスのモックは使わない。外部に書き込む操作を確かめられないときは、その操作を「確かめていない」と報告する。

## 片付ける（Cleanup）

```bash
$V stop
```

- `start` が記録したPIDのrunserverだけを止め、`/tmp/verify-dxp-app-backend-<ポート>/`（PID、Cookie、ログ）を消す。
- 証跡は消さない。`stop` の出力にある証跡のディレクトリが残っていることを確かめる。
- `start` が途中で失敗したときも、`stop` を実行してからやり直す。
- 確認を得てデータを書き換えたときは、作ったものを画面かAPIで戻す。戻せないもの（メールのレコードなど。管理画面に削除の機能がない）は、残ったことを報告する。

## ヘルパー

`scripts/verify.sh` のサブコマンドは次の6つである。ポートは `VERIFY_PORT`（既定8100、8000は拒否する）で選ぶ。ポートごとに状態を分けるので、2つのチェックアウトを別々のポートで同時に起動できる。

| サブコマンド | すること |
| --- | --- |
| `start` | カレントディレクトリのチェックアウトを起動する |
| `doctor` | 起動したサーバと周りのサービスを確かめる |
| `login` | ログインし、テナントIDと法人IDを出す |
| `get <パス> [名前]` | GET を送り、応答を `<名前>.json` に残す |
| `manage <コマンド> [引数...]` | 管理コマンドを実行し、出力と終了コードを残す |
| `stop` | 起動したサーバを止め、証跡のディレクトリを出す |
