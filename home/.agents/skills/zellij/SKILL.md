---
name: zellij
description: zellijのペインで別のエージェント（omp、Claude Code）を起動し、1行を送り、状態と画面を確かめ、閉じる。jjのworkspaceで作業用のworktreeを作る・消す。zellijの中で動くエージェントが、ほかのペインを操作するときに使う。
---

# zellijのペインを操作する

zellijの中で動くエージェントが、別のペインでエージェントを動かすための手順です。
ペインの起動、送信、状態の確認、終了は、`~/.local/bin`の`zj-dispatch`、`zj-say`、`zj-pane`で行います。
worktreeは、`~/.local/bin/jj-worktree`でjjのworkspaceとして作ります。

## ペインのID

- ペインは「<zellijのセッション名>.<ペインID>」で指す（例：`loyal-accordion.3`）。
- 自分のIDは`echo "$ZELLIJ_SESSION_NAME.$ZELLIJ_PANE_ID"`の値である。
- IDは推測せず、`zj-dispatch`が返した値を使う。
- zellijのコマンドに直接渡すときは、セッション名を`--session <セッション名>`、ペインを`--pane-id terminal_<ペインID>`にする。

## エージェントを起動する

```bash
ID=$(zj-dispatch --name <タブ名> <作業ディレクトリ> '<起動コマンド>' ["<最初の1行>"])
```

- 今のzellijのセッションに新しいタブを作り、起動コマンドをログインシェル（`$SHELL -lic`）で実行する。使っている人の画面は切り替えない。
- 入力欄が出るまで最長60秒待つ。最初の1行を渡したときは、`zj-say`と同じ方法で送り、受け付けを確かめる。
- 標準出力には新しいペインのIDだけが出る。起動したあとで失敗した場合も、IDは出る。
- 終了コードが2なら引数の誤り、3ならタブを作れなかった、4なら入力欄が出なかった（画面の最後の行が標準エラーに出る）。それ以外は`zj-say`の終了コードである。
- タブは、zellijのセッションにクライアントがつながっていないと作れない（`zellij action new-tab`はIDを返すが、タブはできない）。
- 日本語のタブ名やペインタイトルでzellijは落ちない。ompの`--no-title`は要らない。
- 起動コマンドが終わると、ペインは閉じずに終了の表示を残す。`zj-pane status`は`Ended`になる。

## 1行を送る

```bash
zj-say "$ID" "<1行>"
```

- 入力欄が空になるまで、3秒おきに最長10分待ってから送る。bashツールのタイムアウトは700秒以上にする。
- 送ったあと、入力欄が空になったことで受け付けを確かめる。補完のメニューで文字が残ったときは、Enterを押し直す。
- 改行を含む文は送れない。長い内容はファイルに書き、そのパスを送る。
- 終了コードは、0が受け付けた、2が引数の誤り、3がペインが動いていない、4が10分待っても入力欄が空にならない、5が受け付けを確かめられないである。

## 状態と画面を見る

```bash
zj-pane status "$ID"      # Live（動いている）か Ended（終わった、または見つからない）
zj-pane screen "$ID" 40   # 画面の最後の40行
```

- エージェントの状態（作業中、入力待ち、承認待ち）は、`zellij --session <セッション名> action list-panes --all --json`の`program_status`にある。エージェントがOSC 7501でzellijに知らせた値である。
- ompは、設定`terminal.programStatus`（既定で有効）で状態を知らせる。
- Claude Codeは、環境変数`CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1`のときは状態を知らせない。`program_status`が空になる。
- 作業の終わりは、相手からの知らせで知る。画面や状態をポーリングして待たない。画面を見るのは、待っている知らせが長く届かないときだけにする。

## 閉じる

```bash
zj-pane end "$ID"
```

- ペインを閉じる。タブにほかのペインがなければ、タブも閉じる。
- 自分が起動したペインだけを閉じる。使っている人が見ているペインも閉じるためである。

## worktreeを作る・消す

```bash
WT=$(jj-worktree add <親リポジトリ> <名前> [-r <分岐元>] [--hooks])
jj-worktree remove <親リポジトリ> <名前> [--hooks]
```

- workspaceは`<親リポジトリ>/.worktrees/<名前>`に作り、jjのworkspaceの名前も`<名前>`にする。標準出力には、作ったworkspaceの絶対パスだけが出る。
- `-r`には分岐元のリビジョンか、続きを積む既存のブックマークを渡す。省くと、親リポジトリの作業コピーと同じ親にする。
- 親リポジトリがgitと同居していれば、gitのworktreeも作られる。workspaceの中でも`git`と`gh`が使える。
- workspaceは親リポジトリと同じjjのリポジトリなので、workspaceで作ったコミットは親リポジトリの`jj log`にも出る。
- `--hooks`は、親リポジトリの`.muxy/worktree.json`のsetup（add）かteardown（remove）のコマンドを、workspaceの中で実行する。使う前にユーザーに確認する。スキルや作業指示が確認を省いてよいとしているときは省く。
- `remove`は、作業コピーにコミットしていない変更があれば止まる。`jj workspace forget`のあとでディレクトリを消す。

## zellijのコマンドを直接使うとき

- 使い方は`zellij --help`、`zellij action <コマンド> --help`で確かめる。
- 見つからないセッションに`zellij --session <名前> action list-panes --json`を実行しても、終了コードは0で、JSONの代わりにセッションの一覧が出る。セッションが動いているかは`zellij list-sessions --no-formatting`で確かめる（終わったセッションの行には`(EXITED`が付く）。
- `send-keys`のキー名は、`Enter`、`Esc`、`Down`、`"Ctrl u"`のように書く。`Escape`は受け付けない。
