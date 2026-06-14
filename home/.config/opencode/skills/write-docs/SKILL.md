---
name: write-docs
description: コードリーディング・仕様調査・設計調査の結果をObsidianへ保存する
---

# write-docs

コードリーディング、仕様調査、設計調査、障害調査など、調査系タスクの成果物は必ずMarkdownとして保存する。

調査結果はチャット上へ回答するだけでなく、永続的なナレッジとしてObsidian Vaultへ記録すること。

## 発動条件

以下の作業を行った場合は本スキルを適用する。

* ソースコードを調査した
* システムの挙動を調査した
* 仕様を確認した
* 設計内容を整理した
* 不具合原因を分析した
* 技術調査を実施した
* ユーザーから調査レポート作成を依頼された

## 保存先

Vault Root 配下の以下へ保存する。調査対象に応じて適切なサブディレクトリを作成・利用すること。

Vault Root は `obsidian` を利用して取得する。

```bash
VAULT_ROOT="$(obsidian --no-sandbox vault info=path)"
```

## ファイル命名規則

```text
YYYYMMDD-<topic>.md
```

例:

```text
20260326-transaction-mail-research.md
20260326-user-auth-flow.md
20260326-login-sequence.md
```

命名ルール:

* kebab-case を使用する
* 内容が推測できる名前にする
* 汎用的すぎる名前は避ける

## Frontmatter

必ず Obsidian 互換の Frontmatter を付与する。

```yaml
---
tags:
  - <topic>
  - <technology>
---
```

ルール:

* 内容に応じたタグを2〜6個付与する
* 抽象的なタグより具体的なタグを優先する
* 既存ファイルを更新する場合は Frontmatter を破壊しない

例:

```yaml
---
tags:
  - django
  - authentication
  - login
---
```

## ドキュメント構成

原則として以下の構成を使用する。

```md
# タイトル

## 概要

## 調査内容

## 判明事項

## 関連ファイル

## 結論
```

必要に応じて以下を追加する。

* 調査方法
* シーケンス図
* データフロー
* 参考資料
* 未解決事項
* 次のアクション

## 作成方法

新規作成時:

```bash
VAULT_ROOT="$(obsidian --no-sandbox vault info=path)"
FILENAME="$(date +%Y%m%d)-<topic>.md"

CONTENT=$'---\ntags:\n  - research\n---\n\n# タイトル\n'

obsidian --no-sandbox create \
  path="research/$FILENAME" \
  content="$CONTENT" \
  overwrite
```

## 品質基準

ドキュメントは単なる調査メモではなく、後から第三者が読んでも理解できる状態を目指す。

以下を含めること。

* 調査対象
* 調査結果
* 根拠
* 関連コードやファイル
* 結論

コード断片だけを貼り付けて終わらせないこと。

## エラーハンドリング

保存に失敗した場合:

1. 調査結果の生成は継続する
2. ユーザーへの回答も継続する
3. 保存失敗を明示する
4. 可能であれば失敗理由を記録する

## 重要

* 調査結果は必ずファイルへ保存する
* チャット出力のみで完了してはならない
* 後から検索できる品質で記録する
* 調査の結論を必ず記載する
* タグは内容に応じて適切に付与する
