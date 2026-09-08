---
description: Pythonバックエンド実装の唯一の入口スキル。Django/DRFおよびFlaskプロジェクトのコーディング、モデル設計、API実装、クエリ最適化、テスト追加、構造化ログ設定、例外ハンドリング、セキュリティ設定をカバーする。ユーザーが「実装して」「API作って」「モデル設計」「クエリ改善」「テスト追加」などと言ったときに使う。
metadata:
    github-path: skills/preview/python
    github-ref: refs/heads/main
    github-repo: https://github.com/contentdata/dxp-github-skills
    github-tree-sha: 39e275d23d46d56cdf40f4cc362ddf63f6afd2d2
name: python
---
# Python実装

このスキルはPythonバックエンド実装の唯一の入口である。
このファイルには実装の進め方と参照先だけを書く。
コーディング規約や確認観点などの知識は同梱の`references/`配下にフレームワークごとに分冊している。

## 役割

- 実装タスクの進行順序を決める
- フレームワークごとにreferenceを読み分ける
- 論点ごとに読むreferenceを切り替える

## フレームワーク判定

以下の基準で該当するフレームワークのreferenceを読む。

| フレームワーク | 発言の特徴 | 参照先 |
| --- | --- | --- |
| Django / DRF | `Django`, `DRF`, `モデル`, `ViewSet`, `Serializer`, `ORM`, `マイグレーション`, `QuerySet` に言及 | `references/django/` |
| Flask | `Flask`, `Blueprint`, `ルーティング`, `app.route`, `flask` に言及 | `references/flask/`（準備中。整備されるまでは`references/common/`のみを読む） |
| フレームワーク未確定 | プロジェクトの既存ファイルやAGENTS.mdから判断。判断できない場合は`references/common/`のみを読む | `references/common/` |

## 最初に読む順番

1. `references/common/api-design.md`を読む
2. フレームワークを判定し、該当するreferenceを読む
3. クエリやORM、N+1が絡むなら各フレームワークのORM referenceを読む
4. ログや例外、セキュリティ、レート制限、ページネーションが絡むなら各フレームワークのNFR referenceを読む
5. テストを書くときは必ず`references/common/testing.md`を読んだあと、各フレームワークのTesting referenceを読む

## 実装フロー

以下の順で進める。各フェーズの具体的な規約や判断基準は参照先のreferenceに従う。

| フェーズ | やること | 参照先 |
| --- | --- | --- |
| 1. 仕様確認 | エンドポイント、入出力、ステータスコード、認証認可要件を確認する。必須と任意の境界をAPI仕様と一致させる | `references/common/api-design.md` |
| 2. モデル設計 | 必要なフィールドとリレーション、DB制約、クエリの入口（ManagerやQuerySet）を決める | 各フレームワークのORM reference |
| 3. 入出力定義 | リクエストとレスポンスの型（SerializerやTypedDictなど）をAPI仕様と一致させる | 各フレームワークの実装reference |
| 4. 認証認可 | エンドポイントごとの権限とレート制限を決める | 各フレームワークのNFR reference |
| 5. ハンドラ実装 | ViewやViewSet、ルート関数を実装する。ビジネスロジックはServiceへ寄せる | 各フレームワークの実装reference |
| 6. ルーティング | URLパターンをAPI仕様と一致させる | 各フレームワークの実装reference |
| 7. テスト | 正常系、未認証、権限なし、不正データを最低限カバーする | `references/common/testing.md`、各フレームワークのTesting reference |
| 8. パフォーマンス | N+1、ページネーション、検索、フィルタを確認する | 各フレームワークのORM referenceとNFR reference |
| 9. レビュー | 各referenceのレビュー観点とチェックリストで確認する | 「論点ごとの参照先」のレビュー観点の行 |

## 論点ごとの参照先

| 論点 | 参照先 |
| --- | --- |
| 共通原則：型設計、契約プログラミング、API設計 | `references/common/api-design.md` |
| テスト共通原則：AAA、factory_boy基本、命名規則 | `references/common/testing.md` |
| Django/DRF実装原則、層の責務と依存方向、ViewとSerializerの境界、フェーズ別の固有事項 | `references/django/implementation.md` |
| Django ORM、Manager、QuerySet、N+1、トランザクション | `references/django/orm.md` |
| Flask実装原則、ルーティング、Blueprint | `references/flask/`（準備中） |
| ログ、例外、セキュリティ、ページネーション、設定（Django） | `references/django/nfr.md` |
| Django固有テスト：TestCase、APITestCase、クエリ数テスト、実行方法 | `references/django/testing.md` |
| レビュー観点とチェックリスト | `references/django/implementation.md`の「レビュー観点」、`references/django/nfr.md`の「確認チェックリスト」 |

## 運用ルール

- `SKILL.md`だけで完結させず、該当論点のreferenceまで読む
- 規約や確認観点は`SKILL.md`に直接書かず、reference側に集約する
- `references`は知識整理のために使い、入口スキルは増やさない
