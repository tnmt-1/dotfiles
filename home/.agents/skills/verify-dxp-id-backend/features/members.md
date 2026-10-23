# 会員

UEC管理画面のユーザーは、ユーザープールに登録した会員を一覧で見て、詳細を開く。会員のデータはMongoDBにあり、dxp-app-backend経由で `/admin/<プールID>/users/` を呼ぶ。

## Sub-features

- `members-list`: ユーザープールの会員の一覧
- `members-detail`: 会員1人の詳細
- `members-update`: メールアドレスの変更、停止、削除、2要素認証のロック（書き込み）

## How to get to it (user POV)

- UEC管理画面にログインし、会員の一覧を開く。会員を選ぶと詳細が開く。

## Driving it with verify.sh

Preconditions:

- `$V start` と `$V ids` が成功している。
- `mise run seed` が、`SEED_EMAIL` の会員をseedテナントのユーザープールチャイルドに作ってある。

- **会員の一覧.** `$V get admin/<プールID>/users/ users` を実行する。`200` が出て、`results` の各要素に `uid`、`email`、`status`、`user_pool_children` がある。`SEED_EMAIL` の会員の `user_pool_children` に `<チャイルドID>` がある。
- **会員の詳細.** 一覧の `uid` を使い、`$V get admin/<プールID>/users/<uid>/ user-detail` を実行する。`200` が出て、`uid` と `email` が一覧の値と一致する。
- **書き込み.** `users/<uid>/email/`、`suspend/`、`delete/`、`2fa-lock/` は、会員のデータとAuthleteのトークンを書き換える。ユーザーの確認を得てから送り、一覧と詳細で読み直す。

## Gotchas

- 一覧の応答には、会員のメールアドレスと電話番号がそのまま入る。証跡を共有するときは注意する。
- MongoDBは1443番のid-backendと共有している。Auth Hubでログインすると `last_login_at` が変わるので、日時を比べる検証では、検証の前後に読んだ値を比べる。
