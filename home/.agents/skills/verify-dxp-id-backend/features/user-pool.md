# ユーザープールとユーザープールチャイルド

UEC管理画面のユーザーは、ユーザープールと、テナントに割り当てたユーザープールチャイルドを管理する。画面の操作はdxp-app-backendを通り、dxp-app-backendが特権ユーザーのトークンを付けてdxp-id-backendの `/admin/` を呼ぶ。

## Sub-features

- `pool-list`: ユーザープールグループに属するユーザープールの一覧
- `pool-child-list`: ユーザープールに属するユーザープールチャイルドの一覧
- `pool-security`: ユーザープールのセキュリティー設定（Authleteのサービスの設定を含む）
- `pool-auth`: 特権ユーザーのトークンがないリクエストを拒否する

## How to get to it (user POV)

- UEC管理画面（<http://localhost:3000/>）にログインし、ユーザープールの設定を開く。
- テナントの設定から、割り当てたユーザープールチャイルドを開く。

## Driving it with verify.sh

Preconditions:

- `$V start` と `$V ids` が成功している。

- **ユーザープールの一覧.** `$V get admin/<グループID>/user_pool/ user-pool-list` を実行する。`200` が出て、`user-pool-list.json` はユーザープールの配列になる。seedプールの `id` が `<プールID>` と一致する。
- **ユーザープールチャイルドの一覧.** `$V get admin/<プールID>/user_pool_child/ user-pool-child-list` を実行する。`200` が出て、`count`、`results` などを持つページ付きの応答になる。`results` に `<チャイルドID>` と `name: seedテナント` がある。`uniikey_api_key` と `uniikey_secret_key` は `***` になっている。
- **セキュリティー設定.** `$V get admin/<プールID>/service/security_settings/ service-security-settings` を実行する。`200` が出て、`jwt_issuer` が `https://localhost:8001` になっている。このAPIは開発用のAuthleteを読む。
- **認証の拒否.** `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:1444/admin/<グループID>/user_pool/` を実行する。ヘッダーを付けないので、`401` が出る。

## Gotchas

- ユーザープールの一覧は配列で、ユーザープールチャイルドの一覧はページ付きのオブジェクトである。件数を比べるときは形の違いに注意する。
- seedグループには、seedプールのほかに、ほかの開発者が作ったユーザープールも入っていることがある。件数ではなくIDで確かめる。
- 設定を書き換えるAPI（PATCH）は、Authleteのサービスやクライアントも書き換える。ユーザーの確認を得てから送り、Authleteの値をGETで読み直す。
