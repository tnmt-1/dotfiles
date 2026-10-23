# メール配信

UEC管理画面の「メール配信」で、ユーザーはテナントのメールの一覧と、1通ごとの詳細を見る。メールの作成、テスト送信、本配信はエンバーポイントと開発用GCPを使う。

## Sub-features

- `mail-list`: メールの一覧をページ単位で返す
- `mail-detail`: 1通の詳細を返す
- `mail-create`: メールを作成して保存する（外部への書き込みがある）

## How to get to it (user POV)

- UEC管理画面で、メール配信の一覧を開く。
- 一覧からメールを選び、詳細を開く。
- 一覧から新規作成を選び、保存する。

## Driving it with verify.sh

Preconditions:

- `$V login` が成功し、`<テナントID>` が分かっている。

- **一覧.** `$V get mail/<テナントID>/ mail-list` を実行する。`200` が出て、`mail-list.json` に `count`、`page_count`、`results` がある。
- **詳細.** `mail-list.json` の `results` から `id`（`ml-...`）を1つ選び、`$V get mail/<テナントID>/<メールID>/ mail-detail` を実行する。`200` が出て、`mail-detail.json` の `id` が選んだIDと同じである。
- **作成.** エンバーポイントの設定（テナントの `emb_siteid`、`emb_login_id`、`emb_password`）と開発用GCPが必要で、seedは設定しない。ユーザーに確認し、設定を受け取ってから行う。作成した `id` を `$V get mail/<テナントID>/<メールID>/` で読み直す。

## Gotchas

- 一覧の件数は、共有のデータベースにあるメールの数である。ほかの作業で作ったメールも含まれるので、件数ではなくIDで確かめる。
- メールのレコードを削除する機能は管理画面にない。作成を試したら、残ったメールのIDを報告する。
- `mail/<テナントID>/test/` のテスト送信は、エンバーポイント経由で実際に送られる（dxp-environment-setupの `docs/seed-feature-status.md`）。
