# Auth Hubが呼ぶ内部API

会員がAuth Hub（<https://localhost:3001/>）でログインするとき、Auth Hubはdxp-id-backendの `/internal/` を呼ぶ。クライアント（ユーザープールチャイルド）が有効かを確かめ、Discoveryの情報を受け取る。内部APIは、リクエストのポートが1443、8000、8001のどれかのときだけ受け付ける。

## Sub-features

- `internal-validation`: クライアントIDが有効なユーザープールチャイルドかを確かめる
- `internal-discovery`: クライアントのissuer、エンドポイント、JWKSのURLを返す
- `internal-port`: 許可していないポートからのリクエストを拒否する

## How to get to it (user POV)

- 会員が、サービスのログインボタンからAuth Hubのログイン画面を開く。Auth Hubが裏で内部APIを呼ぶ。

## Driving it with verify.sh

Preconditions:

- `$V start` と `$V ids` が成功している。

- **クライアントの検証.** `$V get internal/client/<チャイルドID>/validation/ client-validation` を実行する。`200` が出て、本文は空である。
- **存在しないクライアント.** `$V get internal/client/child_nonexist/validation/ client-validation-404` を実行する。`404` が出て、本文は `{"code": 8002, "message": "ユーザープールチャイルドが見つかりません"}` である。終了コードは1になる。
- **Discovery.** `$V get internal/discovery/client/<チャイルドID>/ discovery` を実行する。`200` が出る。`issuer` は `https://localhost:8001` である。`jwks_uri` は `https://localhost:8001/v1/jwks/client/<チャイルドID>/` である。このAPIは開発用のAuthleteを読む。
- **ポートの拒否.** `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:1444/internal/discovery/client/<チャイルドID>/` を実行する。`X-Forwarded-Port` を付けないので、`403` が出る。

## Gotchas

- `verify.sh get` は `X-Forwarded-Port: 1443` を付けて、ポートの検査を通す。本番ではロードバランサーがこのヘッダーを付ける。ポートの検査そのものを確かめるときは、上の `403` の手順を使う。
- Auth Hubは、`.env` に書いたURLのid-backend（1443番か8001番）を呼ぶ。`verify.sh` で起動したサーバーは呼ばない。Auth Hubの画面を操作しても、このチェックアウトのコードは動かない。
