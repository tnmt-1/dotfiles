---
description: Pythonバックエンド実装の唯一の入口スキル。Django/DRFおよびFlaskプロジェクトのコーディング、モデル設計、API実装、クエリ最適化、テスト追加、構造化ログ設定、例外ハンドリング、セキュリティ設定をカバーする。ユーザーが「実装して」「API作って」「モデル設計」「クエリ改善」「テスト追加」などと言ったときに使う。
metadata:
    github-path: skills/preview/python
    github-ref: refs/heads/main
    github-repo: https://github.com/contentdata/dxp-github-skills
    github-tree-sha: fbbf613446d585b1faac50a37994989b7114feec
name: python
---
# Python実装

このスキルはPythonバックエンド実装の唯一の入口である。
詳細知識は同梱の`references/`配下にフレームワークごとに分冊している。

## 役割

- ViewとSerializerの責務境界を守る
- フレームワークごとにreferenceを読み分ける
- 論点ごとに読むreferenceを切り替える

## フレームワーク判定

以下の基準で該当するフレームワークのreferenceを読む。

| フレームワーク | 発言の特徴 | 参照先 |
| --- | --- | --- |
| Django / DRF | `Django`, `DRF`, `モデル`, `ViewSet`, `Serializer`, `ORM`, `マイグレーション`, `QuerySet` に言及 | `references/django/` |
| Flask | `Flask`, `Blueprint`, `ルーティング`, `app.route`, `flask` に言及 | `references/flask/` |
| フレームワーク未確定 | プロジェクトの既存ファイルやAGENTS.mdから判断。判断できない場合は`references/common/`のみを読む | `references/common/` |

## 最初に読む順番

1. `references/common/api-design.md`を読む
2. フレームワークを判定し、該当するreferenceを読む
3. クエリやORM、N+1が絡むなら各フレームワークのORM referenceを読む
4. ログや例外、セキュリティ、レート制限、ページネーションが絡むなら各フレームワークのNFR referenceを読む
5. テストを書くときは必ず`references/common/testing.md`を読んだあと、各フレームワークのTesting referenceを読む

## 論点ごとの参照先

| 論点 | 参照先 |
| --- | --- |
| 共通原則：型設計、契約プログラミング、API設計 | `references/common/api-design.md` |
| テスト共通原則：AAA、factory_boy基本、命名規則 | `references/common/testing.md` |
| Django/DRF実装原則、ViewとSerializerの境界、進め方 | `references/django/implementation.md` |
| Django ORM、Manager、QuerySet、N+1、トランザクション | `references/django/orm.md` |
| Flask実装原則、ルーティング、Blueprint | `references/flask/` |
| ログ、例外、セキュリティ、ページネーション、設定（Django） | `references/django/nfr.md` |
| Django固有テスト：TestCase、APITestCase、クエリ数テスト | `references/django/testing.md` |

## 共通原則

SKILL.mdに直接書かず、**論点ごとの参照先**テーブルの該当referenceを必ず読むこと。
詳細ルールはreference側に集約している。

## 運用ルール

- 契約で保証される値には過剰防御しない
- ViewはSerializerの公開APIだけを参照する
- 複雑なビジネスロジックはModelまたはServiceへ寄せる
- `references`は知識整理のために使い、入口スキルは増やさない
- `SKILL.md`だけで完結させず、該当論点のreferenceまで読む
