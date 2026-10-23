# 外部RP向けOIDC IdP

外部のサービス（RP）は、ユーザープールをOpenID ConnectのIdPとして使う。RPはまずDiscoveryのメタデータを読み、そこに書かれたエンドポイントで認可を受け、公開鍵でトークンを検証する。Discoveryと公開鍵のAPIは認証なしで呼べる。

## Sub-features

- `idp-discovery`: `/v1/idp/<プールID>/.well-known/openid-configuration` でメタデータを返す
- `idp-jwks`: `/v1/idp/<プールID>/jwks` でIDトークンの検証に使う公開鍵を返す
- `idp-token`: トークン、UserInfo、Introspection、Revocationのエンドポイント（RPのクライアント認証が必要）

## How to get to it (user POV)

- 外部RPの開発者が、ユーザープールのDiscoveryのURLをRPに設定する。会員はRPのログインボタンから、Auth Hubの認可画面に進む。

## Driving it with verify.sh

Preconditions:

- `$V start` と `$V ids` が成功している。

- **Discovery.** `$V get v1/idp/<プールID>/.well-known/openid-configuration idp-discovery` を実行する。`200` が出る。`issuer` は `https://localhost:8001/v1/idp/<プールID>` である。`token_endpoint` は `https://localhost:8001/v1/idp/<プールID>/token` である。`grant_types_supported` は `authorization_code` と `refresh_token` である。
- **公開鍵.** `$V get v1/idp/<プールID>/jwks idp-jwks` を実行する。`200` が出て、`keys` に `kid: uniikey-idp-<プールID>`、`kty: RSA`、`alg: PS256` の鍵が1つある。秘密鍵の項目（`d`、`p`、`q`）はない。
- **トークンのエンドポイント.** RPのクライアントIDとシークレット、Auth Hubでの認可が必要になる。この手順はまだ書いていない。

## Gotchas

- IdPのURLは末尾に `/` を付けない。`.../jwks/` のように付けると、HTMLの404が返る（`src/api/public/urls.py` のコメントにある決まり）。
- `issuer` などのURLは、`.env` の `UNIIKEY_APP_HOST`（`localhost:8001`）から作られる。1444番で起動しても、応答のURLは8001番を指す。
