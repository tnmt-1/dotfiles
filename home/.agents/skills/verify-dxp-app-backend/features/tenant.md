# テナント情報

UEC管理画面の「設定」で、ユーザーは所属するテナントの情報とグループを見る。テナントの詳細には、メールの送信元アドレス、ユーザープールチャイルドID、決済代行の設定などが含まれる。

## Sub-features

- `tenant-detail`: テナントの詳細を返す
- `tenant-groups`: テナントのグループの一覧を返す
- `tenant-missing`: 存在しないテナントIDには404を返す

## How to get to it (user POV)

- UEC管理画面で、設定のテナント情報を開く。
- UEC管理画面で、設定のグループを開く。

## Driving it with verify.sh

Preconditions:

- `$V login` が成功し、`<テナントID>` が分かっている。

- **テナントの詳細.** `$V get tenant/<テナントID>/ tenant-detail` を実行する。`200` が出て、`tenant-detail.json` の `name` が `seedテナント`、`id` が `<テナントID>` である。値の入った `uniikey_api_key` と `uniikey_secret_key` は `***` になっている。
- **グループの一覧.** `$V get tenant/<テナントID>/group/ tenant-groups` を実行する。`200` が出て、`tenant-groups.json` に `"name": "最初のグループ"` がある。
- **存在しないテナント.** `$V get tenant/no_such/ tenant-missing` を実行する。`404` が出て、終了コードは1になる。

## Gotchas

- テナントの詳細には、APIキーや決済代行のパスワードが含まれる。証跡は `$V get` で残す。curlで取った本文をそのまま保存しない。
- テナントの更新（PATCH）は、テナントのバケットやデータセットに関わる項目があり、開発用GCPに書き込むことがある。ユーザーに確認してから行う。
