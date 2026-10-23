# dxp-id-backend の機能マップ

dxp-id-backendのAPIを、呼び出し元（dxp-app-backend、Auth Hub、会員のサービス、外部RP）と同じ経路で確かめるための手順である。操作の前にこの索引を読み、該当する機能のファイルに従う。

## 共通の前提

- dxp-environment-setupで `mise run up` と `mise run seed` が済んでいる。
- 対象のチェックアウトで `$V start` と `$V ids` を実行し、`$V doctor` の結果を確かめてある（`V` は [SKILL.md](../SKILL.md) を参照）。
- `ids` の出力にあるIDを使う。以下では、次の表の左の列のように書く。

| 書き方 | `ids` の出力の行 |
| --- | --- |
| `<グループID>` | `user_pool_group ugp_... seedグループ` |
| `<プールID>` | `user_pool upl_... seedプール` |
| `<チャイルドID>` | `user_pool_child child_... seedテナント` |

- `verify.sh` で起動していないサーバー（1443番など）は操作しない。

## 操作の決まり

- 読み取りは `$V get <パス> <名前>` で行う。
- データを書き換えるAPI、管理コマンド、外部サービスに書き込む操作は、実行する前にユーザーの確認を得る。
- 書き込んだら、別のGETで読み直して確かめる。作ったものは片付けで戻す。証跡は消さない。

## 証跡と報告

- 各手順の証跡は、`requests.log` と `<名前>.json` である。
- 確かめられなかった手順は、試したコマンドと満たせなかった前提を報告する。別の経路で確かめたものを、その手順を確かめたとは報告しない。

## 機能

- [ユーザープールとユーザープールチャイルド](./user-pool.md): UEC管理画面がdxp-app-backend経由で呼ぶ管理API
- [会員](./members.md): ユーザープールの会員の一覧と詳細
- [Auth Hubが呼ぶ内部API](./internal-client.md): クライアントの検証とDiscovery
- [外部RP向けOIDC IdP](./oidc-idp.md): Discoveryのメタデータと公開鍵
- [管理コマンド](./batch.md): バッチを手元で実行する

## 各ファイルの形

H1の題と、利用者から見た機能の説明を1段落で書く。そのあとに次の4つのH2をこの順に置く。

1. `Sub-features`: 短いIDと、1行の説明
2. `How to get to it (user POV)`: 利用者が、どの画面やサービスから使うか
3. `Driving it with verify.sh`: `Preconditions:` から始め、操作、コマンド、確かめる結果を組にして書く
4. `Gotchas`: 検証を無駄にしたり、結果を誤らせたりするもの
