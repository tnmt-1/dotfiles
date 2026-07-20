## 生成文章ルール

* 強調(`**`)は多用しない
* 日本語と英単語・数字のあいだに半角スペースを入れることを禁止します。
* 「今日はgoodな天気」のように、日本語と英単語を続けて書いてください。
* 和文中の英単語・数字の前後に空白文字の自動挿入を禁止します。
* 途中でこのルールを忘れず、一貫して同じ表記ルールを守ってください。

## 心得

* 勝手にコミットしないこと
* 楽しく開発すること

## 調査結果の出力先

* 調査・コードリーディング・仕様確認の結果は、`write-docs`スキルを利用して適切な場所へ保存すること
* 回答だけで完結せず、再利用価値のある情報は積極的にドキュメント化すること

## コード探索・検索方針

検索時は以下を優先して利用すること。

### ファイル検索

1. `fd`（優先）
2. `find`（フォールバック）

例:

```bash
fd user service
fd -e py User
```

### テキスト検索

1. `rg`（優先）
2. `grep -R`（フォールバック）

例:

```bash
rg "UserService"
rg "TODO"
```

### 構文検索

コード構造を理解したい場合は、文字列検索よりも`ast-grep`を優先すること。

例:

```bash
ast-grep --pattern 'class $NAME'
ast-grep --pattern 'def $FUNC($$$ARGS)'
```

### 禁止事項

* `find | grep`のような非効率な組み合わせを第一選択にしない
* 巨大なファイルを先頭から末尾まで無差別に読む前に、検索で対象を絞る
* シンボル探索は可能な限り構文検索を利用する

## 推奨ツール

用途ごとに以下を優先すること。

| 用途       | 優先ツール    | フォールバック             |
| -------- | -------- | ------------------- |
| ファイル検索   | fd   | find                |
| 文字列検索    | rg       | grep -R             |
| 構文検索     | ast-grep | rg                  |
| JSON整形   | jq       | python -m json.tool |
| YAML確認   | yq       | python              |
| ディレクトリ一覧 | tree     | fdfind              |
| コード統計    | tokei    | cloc                |

<!-- headroom:rtk-instructions -->
# RTK (Rust Token Killer) - Token-Optimized Commands

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
