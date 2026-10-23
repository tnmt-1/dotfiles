---
name: cdm-notion
description: ~/dev/cdm/ 配下のリポジトリについて、Notionに書かれたチケット、設計、要件、議事録、不具合の報告を ~/dev/cdm/cdm-docs/content/ から探して引用する。Notion MCPとSlack MCPが使えないため、その代わりに使う。pstackのwhy、recall、how で長文ドキュメント、課題管理、チャットのカテゴリーを調べるとき、「仕様を確認して」「要件はどうなっている」「なぜこうなっている」「Notionに書いてあったはず」と言われたときに使う。
---

# cdm-notion

CDMのチケット、設計、要件、議事録はNotionにある。Notion MCPとSlack MCPは使えないため、必要なページはユーザーがNotionからコピーし、`~/dev/cdm/cdm-docs/content/records/` に置いている。取り込みはcdm-docsの `import-notion-page` スキルで行う。

pstackの `why` では、このスキルを長文ドキュメント（Notion）のカテゴリーの調査手順として使う。課題管理とチャットのカテゴリーには対応するMCPがない。この2つは、`content/records/` のチケットと議事録に残っている範囲だけを調べられる。

## 置いてあるもの

| 場所 | 中身 |
|---|---|
| `content/records/` | ある時点の記録。Notionから取り込んだページの写し（本文は取り込んだときのまま）、調査報告、動作確認の計画 |
| `content/usecases/` | コードから書いた、今の動きのユースケース |
| `content/implementation/` | コードから書いた、今の動きの実装の詳細 |
| `content/business/` | 業務マニュアル、業務整理、業務フロー |
| `content/runbooks/` | 手順 |
| `content/glossary/` | 用語の説明 |

`content/records/` のNotionの写しは、frontmatterに `source` がある。Notionの写しのfrontmatterには、次の項目がある。

- `tags`: 文書の種類（`要件`、`設計`、`議事録`、`不具合`、`ガイド`）と機能名
- `source`: `notion`（Notionから貼り付けた）か `agent-log`（エージェントのログから写した）
- `log_session`: `agent-log` のとき、写したセッション
- `notion_url`: 取り込み元のNotionページ
- `notion_updated`: Notionでの最終更新日
- `date`: 取り込んだ日時
- `status`: `確定`、`草案`、`不明` のどれか

## 手順

1. 次の語で `content/` を検索する。`content/records/` のNotionの写しを先に読む。
    - 機能名、画面名、画面に出る文言
    - 対象コードのクラス名、関数名、定数名
    - エラーメッセージ
    - `glossary/` にある用語の正式名称

    ```bash
    rtk grep -rn "<語>" ~/dev/cdm/cdm-docs/content
    ```

2. 当たったファイルは、プレビューではなく全文を読む。理由は文書の途中に書かれていることが多い。
3. `[[ ]]` のリンク先も読む。
4. 同じ話題の文書が複数あれば、`status` と `notion_updated` を比べ、確定版で新しいものを優先する。`source` が `notion` のものを `agent-log` のものより優先する。

## 根拠になる記述

- 「背景」「目的」「課題」の節が、対象コードの目的と一致している
- 検討した案、採用しなかった案が書かれている
- 議事録に「Xにした。理由はY」と書かれている

## 注意すること

- `content/records/` の文書は、ある時点の検討や判断の記録である。今の動きを定めた仕様として引用しない。今の動きは、コード、各リポジトリの `docs/specs/`、`content/usecases/`、`content/implementation/` で確かめる。`usecases/` と `implementation/` は、frontmatterの `review` が `reviewed` でなければ人が確かめていない。
- `source: agent-log` の文書は、ユーザーが貼り付けたときに省略したり書き足したりしている可能性がある。引用するときは「Notionの原文ではなく、ログの写し」と書く。
- 取り込んだ時点の写しである。Notion側がその後に更新されている可能性がある。`date` と `notion_updated` を必ず報告に含める。
- 文書は実装前に書かれる。文書とコードが食い違っていたら、両方を引用して食い違いとして報告する。どちらが正しいかは決めない。
- 取り込まれていないページは調べられない。見つからなかったときに「文書がない」と書かない。「`content/records/` に該当するページが取り込まれていない」と書き、Notionで探すべきページ名や語をユーザーに伝える。

## 返すもの

文書ごとに次を返す。

- ファイルのパスとタイトル
- `source`、`notion_url`、`notion_updated`、`date`、`status`
- 根拠になる記述の引用（原文のまま）と、その見出し
- 関連するリンク先のファイル

見つからなかったときは、検索した語と範囲を返す。
