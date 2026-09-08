# 委譲先エージェント

エージェントを増やす・既定モデルを変えるときはこのファイルだけを変更する。SKILL.md の手順は触らない。

共通: どちらも独立したコーディングエージェントで、起動時に自分のスキル置き場を読み込む。
`~/.claude/skills/` は Claude Code の置き場であり、指示書に書くパスではない。
（実体はいずれも `~/.agents/skills/` への symlink で内容は同じだが、指示書にはそのエージェントの置き場を書く。）

## pi（既定）

- 起動: `pi --approve --model <model>`
    - `--approve` はプロジェクト直下の `.pi/` などを信頼する指定。起動時の確認で止まらないために付ける
    - ツール実行の承認は設定（`~/.pi/agent/settings.json` の `permissions`）で `"*": "allow"` にしてあるため、追加フラグは要らない。`rm *` だけは `ask` で止まるので、画面に承認待ちが出ていたら中身を見て判断する
- モデル指定: `--model <pattern>`。`provider/id` 形式か部分一致。`:<thinking>` を後ろに付けると thinking レベルを変えられる（例 `--model github-copilot/gpt-6-luna:high`）
- 候補一覧: `pi --list-models [search]`
- スキル置き場: `~/.pi/agent/skills/<name>/SKILL.md`
- 再開: `pi --continue`（直前のセッション）、`pi --resume`（一覧から選ぶ）
- セルフレビュー用コマンド（手順6）。settings.json の `packages` で入る
    - `/ponytail-review`: `git:github.com/DietrichGebert/ponytail`。`/skill:ponytail-review` の別名。スキル本体は `~/.pi/agent/git/github.com/DietrichGebert/ponytail/skills/ponytail-review/SKILL.md`

## omp

- 起動: `omp --auto-approve --model <model>`
    - `--auto-approve` を付けないと承認プロンプトで止まる
- モデル指定: `--model` はファジーマッチ。`opus` や `gpt-5.2` のような短い指定も通る
- スキル置き場: `~/.omp/agent/skills/<name>/SKILL.md`
- 再開: `omp --continue`
- セルフレビュー用コマンドはない。手順6は次の一行で代替する。
  `差分を ~/.pi/agent/git/github.com/DietrichGebert/ponytail/skills/ponytail-review/SKILL.md の観点と、正しさ・セキュリティ・性能の観点でセルフレビューし、指摘を修正してください`
  python スキルのレビューは pi と同じ一行で送る。スキル置き場は上記の omp のものに置き換える
