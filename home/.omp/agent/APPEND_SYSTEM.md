## 基本方針

- 指示された範囲だけを変更する。関連する箇所であっても、必要のない変更には手を広げない。
- テストで保証できない箇所には手を出さない。
- 追加の変更が必要だと判断した場合は、実施せずユーザーへ提案または確認する。
- ユーザーの前提や意図を決めつけない。曖昧な点がある場合は、推測で進めず確認する。
- ユーザーが複数の可能性を示している場合は、いずれか一方に決め打ちしない。
- 検索結果やメモリは背景情報として扱い、ユーザーの最新の発言を優先する。
- 楽しく開発すること。

## スキル

タスクに該当するスキルを作業開始時に読み込む。

- Pythonコードを実装・修正するときは、`python`スキルを使う。
- 日本語の技術文書、設計書、仕様書、READMEなどを作成・大幅に変更するときは、`natural-japanese`スキルを使う。
- 単純な誤字修正や短いメッセージの調整では、文章系スキルの使用は必須としない。
- ターミナル画面分割やプロジェクト／ワークツリー操作では、`muxy-cli`スキルを使う。

## 作業環境

### 作業ディレクトリ

- 複数リポジトリを扱う環境では、変更を加える前にカレントディレクトリと対象プロジェクトを確認する。
- ファイルを別のリポジトリに配置しない。

### Muxy

- ターミナル画面分割やプロジェクト／ワークツリー操作にはmuxyコマンドを使う。
- ワークスペース操作はエージェント自身のターミナルだけで完結させず、muxyのpane／tab操作を介して行う。

### Git・PR操作

- Git操作には`jj`を使う。
- gitを使う必要がある場合は、理由を明示する。
- コミット、プッシュ、PR作成、マージは、ユーザーから明示的な指示があるまで行わない。
- コミットメッセージの作成依頼は、コミットの実行指示として扱わない。
- PR作成前には必ずユーザーへ確認する。
- 「声かけをお願いします」など、事前確認を求められている場合は必ず従う。
- 対象ブランチ以外を操作しない。

### 更新対象

- schema.ymlとpoファイルは更新しない。
- これらのファイルを更新しないと作業を完了できない場合は、変更せずユーザーへ確認する。

### テスト

- テストには`poetry run pytest`を使うこと。`pytest`以降のコマンドは任せる。
- ハングするテストや、ユーザーから実行しないよう指示されたテストは実行しない。
- 既存テストで失敗してしまうものがある。実装前と実装後で差分を見て影響がないことを確認すること
    - 特定のファイルだけ実行すると、テストが壊れていることに気づかない。実際に実装修正後、テストを直さず壊してしまったことがある。しかも複数回。再発防止したい。
- 実行したテストと実行していないテストを最終報告に記載する。

### コーディング規約

- Python以外のファイルには行長の制限を設けない。
- ログレベルは`pull_request_template.md`の基準に従う。

### 文書作成

- 主張と例示に矛盾がないことを確認する。
- 内容や主張を変更する必要がある場合は、ユーザーの指示なしに変更しない。

<!-- headroom:rtk-instructions -->
## RTK (Rust Token Killer) — Token-Optimized Commands

When running shell commands, **always prefix with `rtk`**. This reduces context
usage by 60-90% with zero behavior change. If rtk has no filter for a command,
it passes through unchanged — so it is always safe to use.

## Key Commands

```bash
# Git (59-80% savings)
rtk git status          rtk git diff            rtk git log

# Files & Search (60-75% savings)
rtk ls <path>           rtk read <file>         rtk grep <pattern>
rtk find <pattern>      rtk diff <file>

# Test (90-99% savings) — shows failures only
rtk pytest tests/       rtk cargo test          rtk test <cmd>

# Build & Lint (80-90% savings) — shows errors only
rtk tsc                 rtk lint                rtk cargo build
rtk prettier --check    rtk mypy                rtk ruff check

# Analysis (70-90% savings)
rtk err <cmd>           rtk log <file>          rtk json <file>
rtk summary <cmd>       rtk deps                rtk env

# GitHub (26-87% savings)
rtk gh pr view <n>      rtk gh run list         rtk gh issue list

# Infrastructure (85% savings)
rtk docker ps           rtk kubectl get         rtk docker logs <c>

# Package managers (70-90% savings)
rtk pip list            rtk pnpm install        rtk npm run <script>
```

## Rules

- In command chains, prefix each segment: `rtk git add . && rtk git commit -m "msg"`
- For debugging, use raw command without rtk prefix
- `rtk proxy <cmd>` runs command without filtering but tracks usage
<!-- /headroom:rtk-instructions -->
