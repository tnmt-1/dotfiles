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

## 作業範囲

- 変更してよいのは、タスクで指定されたファイルと、その変更で壊れる呼び出し側・テスト・fixtureだけにする。それ以外に変更が要ると分かったら、変更せず最終報告で提案する。
- 関数やクラスのシグネチャを変える前に、`grep -rn "<名前>" src/`で呼び出し側をすべて洗い出す。
- 新しいヘルパー、Manager、factoryを書く前に、同じ役割のものを`grep -rn`で探す。あればそれを使う。
- 検証には同梱の`scripts/test_failures.sh`、`scripts/diff_guard.sh`、`scripts/design_hints.py`を使う。同じ役割のスクリプトを作らない。

## 禁止事項

次の手段で検証を通さない。通らないときは「検証と自己修復」の上限まで直し、それでも通らなければ報告して止まる。

- 不完全さを言い訳するコメントを書かない。「暫定」「一時的」「とりあえず」「仮対応」「workaround」「FIXME」の類である。既知の制約は、コードではなく最終報告に書く。
- 警告を黙らせない。`# noqa`、`# type: ignore`、`# pragma: no cover`を足さない。
- テストを弱めない。skipやxfailの追加、assertの削除や緩和、期待値を実装の出力に合わせる書き換えをしない。期待値を変えるのは仕様が変わったときだけで、その場合は最終報告に書く。
- 例外を握りつぶさない。`except Exception: pass`や、ログだけ出して処理を続ける`except`を書かない。
- 実装前と実装後で、テストの実行範囲やコマンドを変えない。
- AGENTS.mdで更新を禁じられたファイル（schema.yml、poファイルなど）を変更しない。

## 実装フロー

以下の順で進める。各フェーズの具体的な規約や判断基準は参照先のreferenceに従う。

| フェーズ | やること | 参照先 |
| --- | --- | --- |
| 0. ベースライン | コードに触る前に、テストの失敗一覧を記録する | 「検証と自己修復」の手順1 |
| 1. 仕様確認 | エンドポイント、入出力、ステータスコード、認証認可要件を確認する。必須と任意の境界をAPI仕様と一致させる | `references/common/api-design.md` |
| 2. モデル設計 | 必要なフィールドとリレーション、DB制約、クエリの入口（ManagerやQuerySet）を決める | 各フレームワークのORM reference |
| 3. 入出力定義 | リクエストとレスポンスの型（SerializerやTypedDictなど）をAPI仕様と一致させる | 各フレームワークの実装reference |
| 4. 認証認可 | エンドポイントごとの権限とレート制限を決める | 各フレームワークのNFR reference |
| 5. ハンドラ実装 | ViewやViewSet、ルート関数を実装する。ビジネスロジックはServiceへ寄せる | 各フレームワークの実装reference |
| 6. ルーティング | URLパターンをAPI仕様と一致させる | 各フレームワークの実装reference |
| 7. テスト | 正常系、未認証、権限なし、不正データを最低限カバーする | `references/common/testing.md`、各フレームワークのTesting reference |
| 8. パフォーマンス | N+1、ページネーション、検索、フィルタを確認する | 各フレームワークのORM referenceとNFR reference |
| 9. レビュー | 各referenceのレビュー観点とチェックリストで確認する | 「論点ごとの参照先」のレビュー観点の行 |
| 10. 検証 | 検証コマンドをすべて通す | 「検証と自己修復」の手順2以降 |

## 検証と自己修復

`<skill>`はこのSKILL.mdがあるディレクトリの絶対パスに置き換える。

1. 実装前に、テストの失敗一覧を記録する。
   ```bash
   <skill>/scripts/test_failures.sh /tmp/$(basename "$PWD")-before.txt <テストコマンド>
   ```
   - テストコマンドは`references/django/testing.md`の「実行方法」で決める。全体テストを実行してよいかはAGENTS.mdに従い、実行できないリポジトリでは変更するアプリのテストディレクトリを対象にする。タスク指示書（conductorなど）が実行範囲を決めているときは、それに従う。
   - ハングするテストは`--deselect`で外す。実装後も同じコマンドを使う。
   - 終了コード2はテストが完走していない。表示に従ってコマンドを直し、記録をやり直す。
2. 変更したファイルに関係するテストを実行し、終了コード0を確認する（例：`poetry run pytest <テストファイル> -v`）。
3. 手順1と同じコマンドで失敗一覧を取り、新しい失敗が0件であることを確認する。
   ```bash
   <skill>/scripts/test_failures.sh /tmp/$(basename "$PWD")-after.txt <手順1と同じテストコマンド>
   comm -13 /tmp/$(basename "$PWD")-before.txt /tmp/$(basename "$PWD")-after.txt   # 出力が空なら合格
   ```
4. リポジトリに設定済みの静的検査を、変更したファイルに対して実行する。`.pre-commit-config.yaml`があれば`poetry run pre-commit run --files <変更したファイル>`を使う。なければ`pyproject.toml`や`setup.cfg`に設定のあるruff、flake8、mypyだけを使う。設定のないツールは導入しない。
5. Djangoでは次の2つが終了コード0になることを確認する。モデルを変えた場合は、マイグレーションファイルを作ってから実行する。
   ```bash
   poetry run python src/manage.py check
   poetry run python src/manage.py makemigrations --check --dry-run
   ```
6. 差分に逃げ道が入っていないことを確認する。
   ```bash
   jj diff --git --from 'trunk()' | <skill>/scripts/diff_guard.sh   # 終了コード0なら合格
   ```
   分岐元がtrunkでなければ、`trunk()`をその変更IDかbookmark名に置き換える。
   出力された行は削除するか、禁止事項に当たらない書き方へ直す。誤検知（業務用語の「一時的」など）だけは残してよい。残した行と理由は最終報告に書く。
7. 追加・変更した関数に、設計を見直す候補がないか確認する。リポジトリのルートで実行する。
   ```bash
   jj diff --git --from 'trunk()' | python3 -I <skill>/scripts/design_hints.py   # 終了コード0なら合格
   ```
   出力された候補は、次のreferenceに従って直す。
   - `dict型`：`references/common/api-design.md`の型設計に従い、TypedDictにするか、キーごとの引数に分ける。中身のキーを読まずに丸ごと渡すだけのdictは、そのままでよい。
   - `呼び出し1か所以下`：`references/django/implementation.md`の「Serializer設計」に従い、呼び出し元へ展開するか、Serviceへ移す。
   直さずに残した候補は、理由とともに最終報告に書く。

手順2〜7のどれかが失敗したら、次のループで直す。

1. ログの最初のエラーを読み、原因を1つに絞る。
2. その原因だけを直す。禁止事項に当たる直し方はしない。
3. 失敗したコマンドを再実行する。通ったら手順2から全部やり直す。

修正は、同じ検証手順につき3回までにする。2回直しても同じエラーが出たら、コードを直す前に前提（テストデータ、設定、仕様の読み方）を確かめる。3回で通らなければ止まり、失敗したコマンド、エラーの先頭10行、試した修正とその結果を報告する。

## 完了条件

次をすべて満たしたときだけ完了とする。1つでも満たさなければ、完了と報告しない。

- [ ] 手順2の終了コードが0
- [ ] 手順3の`comm -13`の出力が空
- [ ] 手順4の静的検査の終了コードが0。対象ツールがなければ、ないことを報告に書いた
- [ ] Djangoでは手順5の2コマンドの終了コードが0
- [ ] 手順6の`diff_guard.sh`の終了コードが0、または残した行をすべて理由つきで報告に書いた
- [ ] 手順7の`design_hints.py`の終了コードが0、または残した候補をすべて理由つきで報告に書いた
- [ ] 最終報告に、実行した検証コマンドとその結果、実装前後の失敗件数、実行しなかった検証とその理由を書いた

## 論点ごとの参照先

| 論点 | 参照先 |
| --- | --- |
| 共通原則：型設計、契約プログラミング、API設計 | `references/common/api-design.md` |
| テスト共通原則：AAA、factory_boy基本、命名規則 | `references/common/testing.md` |
| Django/DRF実装原則、層の責務と依存方向、ViewとSerializerの境界、判定と応答の分離、処理1回分のクラス、バッチの型の分け方、フェーズ別の固有事項 | `references/django/implementation.md` |
| Django ORM、Manager、QuerySet、N+1、トランザクション | `references/django/orm.md` |
| Flask実装原則、ルーティング、Blueprint | `references/flask/`（準備中） |
| ログ、例外、セキュリティ、ページネーション、設定（Django） | `references/django/nfr.md` |
| Django固有テスト：TestCase、APITestCase、クエリ数テスト、実行方法 | `references/django/testing.md` |
| レビュー観点とチェックリスト | `references/django/implementation.md`の「レビュー観点」、`references/django/nfr.md`の「確認チェックリスト」 |

## 運用ルール

- `SKILL.md`だけで完結させず、該当論点のreferenceまで読む
- 規約や確認観点は`SKILL.md`に直接書かず、reference側に集約する
- `references`は知識整理のために使い、入口スキルは増やさない
