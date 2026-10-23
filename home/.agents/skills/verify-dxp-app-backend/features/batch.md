# 管理コマンド

本番では、`src/*/management/commands/` の管理コマンドがCloud Run Jobのバッチとして動く。手元では、`$V manage` を使って同じ設定で実行し、出力と終了コードを確かめる。

## Sub-features

- `batch-help`: コマンドの引数を表示する（読み取りだけ）
- `batch-run`: コマンドを実行する（データベースや外部サービスに書き込む）

## How to get to it (user POV)

- 利用者が画面から操作するものではない。運用者がCloud Run Jobを定期実行するか、手で実行する。
- ジョブの環境変数は `cloud-run-environments*.txt` にある。コマンドの引数はこのリポジトリにないので、`--help` とコマンドのdocstringで確かめる。

## Driving it with verify.sh

Preconditions:

- `$V start` が成功している（`manage` は `start` が記録したチェックアウトで動く）。
- 実行するコマンドが、対象のチェックアウトの `src/*/management/commands/` にある。

- **引数の確認.** `$V manage <コマンド> --help` を実行する。`exit=0` が出て、`manage-*-<コマンド>.out` に引数の一覧が残る。ブランチ `feat/yanmaga-mail-wf` の `create_yanmaga_favorite_update_mail` では、`--tenant_id` など5つの引数が出る。
- **実行.** 実行する前に、コマンドが書き込む先（`dxp_app_dev` のテーブル、開発用GCPのGCSとBigQuery、外部API）をコードから書き出し、ユーザーに確認する。確認を得たら `$V manage <コマンド> <引数...>` を実行する。`exit=` の値と `.out`、`.err` を確かめ、書き込んだものを別の経路（`$V get`、MySQL、GCS）で読み直す。

## Gotchas

- `manage` は共有の `dxp_app_dev` に接続する。テストと違い、テスト用のデータベースは作られない。
- 開発用GCPのBigQueryとGCSは、ほかの開発者と共有している。バッチの入力にするテーブルやバケットは、ユーザーに名前を確かめる。
- `create_yanmaga_favorite_update_mail` は、予約配信のメールレコードを作る。udb-airflowが開発環境で動いていれば、エンバーポイントへ登録されて配信される。管理画面にメールを削除する機能はない。
