---
allowed-tools: Read Glob Grep Bash
argument-hint: ticket=<NotionURL> [test=<URL>]
description: 現在のブランチのDraft PRを作成または更新します。.github/pull_request_template.mdに沿って本文を整え、必要に応じてNotionリンクを反映します。
disable-model-invocation: false
metadata:
    github-path: skills/create-pr
    github-ref: refs/heads/main
    github-repo: https://github.com/contentdata/dxp-github-skills
    github-tree-sha: e6fea16aecee8d9f915473885401272dd96565d3
name: create-pr
---
# PR作成・更新ガイドライン

現在のブランチにPRがなければDraft PRを作成し、既存PRがあればタイトル、本文、担当者を更新します。
本文は`.github/pull_request_template.md`を正として組み立てます。
以下のパスはすべてリポジトリルートからのパスとして解釈します。

## 最初にやること

1. 現在のブランチ名、作業ツリー、既存PR有無を確認する
2. マージ先ブランチを決める
3. 差分とコミット履歴から変更点を整理する
4. `$ARGUMENTS`からNotionや資料URLを拾う
5. PRタイトルと本文を作り、本文をファイルに書く
6. タイトルと本文を検証し、失敗があれば直す
7. ユーザーに確認を取る
8. PRを作成または更新する
9. 担当者を`@me`に設定する
10. 反映結果を確認する

## 最優先ルール

- 現在のブランチ、作業ツリー、既存PR有無を最初に確認する
- 差分とコミット履歴を読まずにPRタイトルや本文を書かない
- 未コミット変更をPR内容として断定しない
- 既存PR本文を空で上書きしない
- 既存PRに手動で追記された有益な文脈や補足は、必要がない限り消さない

## 禁止事項

- ユーザーの確認を取る前に、push、`gh pr create`、`gh pr edit`を実行しない
- force pushしない。pushが拒否されたら、理由を報告して止まる
- 「動作確認」のチェックボックスを`[x]`にするのは、このセッションで実行して結果を見たものと、`gh pr checks`で成功を確かめたものだけにする。それ以外は`[ ]`のまま未実施と書く
- チケットやテスト仕様書のURLを推測で埋めない。引数になければ`未指定`と書く
- 検証を通すために、テンプレートのトップレベル見出しを書き換えたり削ったりしない
- このスキルではファイルを編集しない。書き出すのは、`/tmp`に置く本文ファイルだけである

## 前提確認

以下を確認する:

```bash
git branch --show-current
git status --short
gh pr view --json number,title,body,state,isDraft,baseRefName,headRefName,url 2>/dev/null
```

- デフォルトブランチ上にいる場合はPRを作らず、ユーザーに確認する
- 未コミット変更がある場合は「PRに含まれない差分」であることを明示する
- 既存PRが通常PRでも、そのまま更新してよい。
  勝手にDraftへ戻さない

## マージ先ブランチの決め方

以下の優先順で決める:

1. `git reflog show "$(git branch --show-current)" --format='%gs'`から`Created from`を探す
2. 抽出したブランチが`origin`に存在するか`git ls-remote --heads origin <branch>`で確認する
3. 存在すればそのブランチをbaseにする
4. 検出できない、またはremoteに存在しない場合は`gh repo view --json defaultBranchRef -q .defaultBranchRef.name`で取得したデフォルトブランチをbaseにする

## 変更内容の把握

以下を確認する:

```bash
git diff <base>...HEAD --stat
git diff <base>...HEAD
git log <base>..HEAD --oneline
```

以下も読む:

- `.github/pull_request_template.md`
- 変更ファイルと関連テスト
- 既存PR本文

確認する観点:

- 何を直したか、追加したか
- なぜその変更が必要か
- 影響範囲はどこか
- テスト、schema更新、翻訳更新の有無
- ログ追加やログレベル変更の有無

## 引数の扱い

`$ARGUMENTS`から以下を受け取る:

- `ticket=<NotionURL>`: チケットや要件Notion
- `test=<URL>`: テスト仕様書や検証資料

補足ルール:

- 引数に`ticket=`があればPR本文の「チケット」に反映する
- 引数に`test=`があればPR本文の「テスト仕様書」に反映する
- 生URLが複数だけ渡された場合は、先頭を`チケット`、2件目を`テスト仕様書`として扱う
- URLしか分からない場合は、リンク欄だけ埋めて本文の背景説明は差分とコミットからまとめる
- Notion本文を読めない場合でも処理を止めない

## PRタイトルルール

PRタイトルはConventional Commits形式にする。

形式:

`type: 日本語の要約`

typeの選び方:

- `feat`: 新機能追加
- `fix`: 不具合修正
- `docs`: ドキュメントのみ
- `refactor`: 挙動を変えない整理
- `test`: テスト追加・修正
- `chore`: 補助的変更

ルール:

- 変更の主目的を表すtypeを1つ選ぶ
- タイトルは簡潔な日本語にする
- 複数変更が混ざる場合でも、PRの主目的で要約する
- 既存PRタイトルが差分とズレている場合は更新する
- typeが判定しづらい場合だけユーザーに確認する

## PR本文ルール

`.github/pull_request_template.md`のトップレベル見出し順を維持しつつ、差分に関係する内容だけを埋める。

本文全体のルール:

- テンプレートのトップレベル見出しは維持する
- 条件付きのチェックリストや補足は、差分に関係する場合だけ残す
- 非該当の条件付きチェックリストを機械的に残さない
- 非該当だが見出し自体は必要な場合は、`対象なし`や理由を1行で書く
- 既存PRに手動で追記された有益な文脈や補足は消さずに残す
- tenmaru スキルで文体を整え、最後に bunfmt スキルで表記を検査する
- ユーザーとモデルでやり取りして決めた経緯は書かなくてよい。結果だけ書くこと。

### 概要

- 目的
- 背景
- バグ修正なら原因

### 資料のリンク

- `- チケット: <NotionURLまたは未指定>`
- `- テスト仕様書: <URLまたは未指定>`

### 技術的な変更点・バグの原因に対して実装したこと

- 実装した内容を変更の単位（論理的なまとまり）で自然言語で書く
- ファイル名やファイル単位の列挙は避け、変更の目的と手段が伝わるように書く
- 読み手がコンテキストを知らなくても理解できるようにする
  - つまり実装の詳細はコードを見ればわかるので、その概略を中心に記載する

### ログの確認

- 追加・変更したログがあれば、どこで何を追えるかを書く
- このセクション自体は残す
- ログを変更していない場合は、その理由や既存ログで追跡可能かを1〜2文で簡潔に書く
- WARNING/ERRORを返す経路に関わる変更では、調査に必要な情報が残るかを明記する

### 動作確認

- 実行したテストや確認内容を、何を確認したか分かる自然言語でチェックボックスに書く
- 未実施なら未実施と明記する

### 補足

- レビュアーに見てほしい点
- 懸念点
- 未完了項目
- 既存テンプレート末尾の条件付きチェックリストは、関係する場合だけ残して更新する
- 差分に無関係な長いチェックリストは残さない

## 送信前の検証

本文は`/tmp/pr-body-$(git branch --show-current | tr / -).md`に書く。送るときも、検証したこのファイルをそのまま`--body-file`で渡す。
`<skill>`はこのSKILL.mdがあるディレクトリの絶対パスに置き換える。

```bash
BODY=/tmp/pr-body-$(git branch --show-current | tr / -).md
<skill>/scripts/check_pr.sh .github/pull_request_template.md "<title>" "$BODY"
node ~/.pi/agent/skills/bunfmt/scripts/check.js --style desu "$BODY"
```

- `check_pr.sh`は、タイトルの形、本文が空でないこと、トップレベル見出しの並びがテンプレートと同じこと、`<チケットURL>`のような置き場所が残っていないことを検査する
- `check.js`の指摘のうち、テンプレートから写した行への指摘は直さない。その行番号を最後の報告に書く

どちらかが失敗したら、出力を読んで本文ファイルかタイトルを直し、同じコマンドを再実行する。
修正は3回までにする。3回で通らなければ、PRを作らずに残った指摘をそのまま報告する。

## ユーザーへの確認

検証が通ったら、次を示してユーザーの確認を取る。確認が取れるまで、pushもPRの作成・更新もしない。

- 実行する操作（pushの有無、新規作成と更新の別）
- baseとhead
- タイトル
- 本文ファイルのパスと全文

## PR作成または更新

### PRがない場合

1. リモート未作成なら現在ブランチをpushする
2. Draft PRを作成する
3. 作成後に「反映結果の確認」を行う

例:

```bash
git push -u origin <current-branch>

gh pr create \
  --draft \
  --base <base-branch> \
  --title "<title>" \
  --body-file "$BODY"
```

### PRがある場合

- 既存PRの本文とタイトルを確認し、必要な部分だけ更新する
- ユーザーが追記した文脈や補足が有益なら消さずに残す
- 差分が増えて本文が古くなっている場合は更新する

例:

```bash
gh pr edit <pr-number> --title "<title>"

gh pr edit <pr-number> --body-file "$BODY"
```

## 担当者設定

PR作成後または更新後に、担当者を`@me`へ設定する。

```bash
gh pr edit <pr-number> --add-assignee "@me"
```

## 反映結果の確認

GitHub上のPRが、確認を取った内容と同じであることを確かめる。

```bash
gh pr view <pr-number> --json body -q .body | diff - "$BODY"   # 出力が空なら合格
gh pr view <pr-number> --json title,isDraft,baseRefName,assignees
```

- 本文の`diff`の出力が空
- `title`が確認を取ったタイトルと一致する
- `baseRefName`が「マージ先ブランチの決め方」で決めたブランチと一致する
- 新規作成なら`isDraft`が`true`。既存PRなら更新前と同じ値
- `assignees`に`gh api user -q .login`のユーザーがいる

一致しない項目は`gh pr edit`で直し、同じ確認を再実行する。修正は2回までにする。それでも一致しなければ、ずれた項目を報告する。

## 完了条件

次をすべて満たしたときだけ完了と報告する。

- [ ] `check_pr.sh`の終了コードが0
- [ ] `check.js`の終了コードが0。または、残った指摘がすべてテンプレートから写した行へのもので、報告に行番号を書いた
- [ ] ユーザーの確認を取ってから、pushとPRの作成・更新をした
- [ ] 「反映結果の確認」の5項目がすべて一致した

## 出力

最後に以下を簡潔に報告する:

- PR番号とURL
- base/head
- Draftかどうか
- 更新したタイトル
- 本文に反映した主要ポイント
- 未コミット差分や未実施テストがあればその注意点

## 注意事項

- 推測でNotion内容を書かない
- 未コミット変更をPR内容として断定しない
- `main`向けの通常修正PRだけでなく、派生ブランチ向けPRも考慮する
- 既存PR本文を空で上書きしない
- 差分を読まずにタイトルや概要を書かない
