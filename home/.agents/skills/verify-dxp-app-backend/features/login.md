# ログインとセッション

UEC管理画面のユーザーは、メールアドレスとパスワードでログインする。dxp-app-backendは開発用のGoogle Identity Platformで認証し、セッションCookieを返す。以後のAPIは、このセッションで呼ぶ。

## Sub-features

- `login-password`: メールアドレスとパスワードでログインし、所属するテナントと法人を受け取る
- `login-is-login`: ログイン中なら200、ログインしていなければ401を返す
- `login-2fa`: 2要素認証が有効な法人では、ワンタイムコードの入力を求める
- `login-logout`: ログアウトする。Google Identity Platformのリフレッシュトークンを取り消す

## How to get to it (user POV)

- UEC管理画面（<http://localhost:3000/>）のログイン画面で、メールアドレスとパスワードを入力する。
- UEC管理画面で、ログアウトを選ぶ。

## Driving it with verify.sh

Preconditions:

- `$V start` が成功し、`$V doctor` のMySQL、Redis、dxp-id-backendが `OK` である。
- dxp-environment-setupの `mise.local.toml` に `SEED_EMAIL` と `SEED_PASSWORD` がある。

- **ログイン.** `$V login` を実行する。`OK: <メールアドレス> でログインした` と、`tenant tnt_... seedテナント`、`corporation crp_... seed法人` が出る。`requests.log` に `POST /user/login_gidp/ 200` が残る。`login.json` の `access_token` と `refresh_token` は `***` になっている。
- **ログイン中の判定.** `$V get user/is_login/ is-login` を実行する。`200 GET /user/is_login/` が出る。
- **未ログインとの区別.** `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8100/user/is_login/` をCookieなしで実行する。`401` が出る。
- **2要素認証.** 法人の `is_two_factor_auth_enabled` を変える必要があるので、ユーザーに確認してから行う。`$V login` は `NG: 2要素認証が有効な法人のユーザー` で止まる。コードはdxp-environment-setupの `mails/` に書き出される。
- **ログアウト.** Google Identity Platformに書き込むので、ユーザーに確認してから行う。`$V get user/logout/ logout` を実行する。`{"message": "ログアウトしました"}` が返り、そのあとの `$V get user/is_login/` が200でなくなる（401か403かは確かめていない）。

## Gotchas

- ログイン済みのCookieを付けて `login_gidp` にPOSTすると、CSRFの検査で403になる。`$V login` はCookieを捨ててから送る。
- ログアウトは同じアカウントのリフレッシュトークンを取り消すので、ブラウザで開いているUEC管理画面のセッションも切れる。片付けでは呼ばない。
- ログインのたびに、`user_operation_log` の行が増え、Redisにトークンが入る。共有のデータベースなので、件数を数える検証ではこの行を除く。
- seedのアカウントのパスワードをGoogle Identity Platformで変えると、`$V login` は400になる。`SEED_PASSWORD` をいまのパスワードにする。
