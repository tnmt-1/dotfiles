# 管理コマンド

本番では、`src/batch/management/commands/` の管理コマンドがECSのタスクやStep Functionsのバッチとして動く。`src/api/management/commands/` には、インデックスの作成やダミー会員の作成など、開発と運用のためのコマンドがある。手元では、`$V manage` を使って同じ設定で実行し、出力と終了コードを確かめる。

## Sub-features

- `batch-help`: コマンドの引数を表示する（読み取りだけ）
- `batch-run`: コマンドを実行する（データベースや外部サービスに書き込む）

## How to get to it (user POV)

- 利用者が画面から操作するものではない。運用者がバッチを定期実行するか、手で実行する。
- コマンドの引数は `--help` とコマンドのdocstringで確かめる。

## Driving it with verify.sh

Preconditions:

- `$V start` が成功している（`manage` は `start` が記録したチェックアウトで動く）。
- 実行するコマンドが、対象のチェックアウトの `src/*/management/commands/` にある。

- **引数の確認.** `$V manage <コマンド> --help` を実行する。`exit=0` が出て、`manage-*-<コマンド>.out` に引数の一覧が残る。`internal_authlete_reflect_internal_redirect_uris` では、`--user_pool_id` と `--user_pool_child_id` が出る。
- **実行.** 実行する前に、コマンドが書き込む先（`dxp_id_dev` のテーブル、MongoDB、Authlete、S3、BigQuery）をコードから書き出し、ユーザーに確認する。確認を得たら `$V manage <コマンド> <引数...>` を実行する。`exit=` の値と `.out`、`.err` を確かめ、書き込んだものを別の経路（`$V get`、MySQL、MongoDB）で読み直す。

## Gotchas

- `manage` は共有の `dxp_id_dev` とMongoDBに接続する。テストと違い、テスト用のデータベースは作られない。
- `internal_authlete_reflect_internal_redirect_uris` は、失敗してもログを出すだけで終わる。Authleteのクライアントの値を読み直して確かめる（dxp-environment-setupの `seed/id_backend/auth_hub_login.py` が同じ確かめ方をしている）。
- Step Functionsから動くバッチ（`state_*`、`*_parallel*`）は、AWSの入出力を前提にする。手元で動かせるかは、コマンドごとに確かめる。
