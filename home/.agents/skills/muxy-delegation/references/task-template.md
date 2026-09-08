# タスク指示書テンプレート

指示書は実装側が元の会話を一切知らない前提で書く。
`<agent-skills>` は `references/agents.md` のスキル置き場に置き換える（pi なら `~/.pi/agent/skills`）。
`<ponytail-review-skill>` は `references/agents.md` にある ponytail-review の SKILL.md の絶対パスに置き換える。

```markdown
# タスク: <一行で>

## 最初に読み込むスキル
<タスクに該当するものを名前で列挙する。読めなかった場合に備えて
 <agent-skills>/<name>/SKILL.md の絶対パスも併記する。~/.claude/skills/ のパスは書かない>
- Python の実装・修正: `python` スキル（<agent-skills>/python/SKILL.md）。
  SKILL.md の指示に従い references/ の該当文書（common/api-design.md, common/testing.md,
  django/implementation.md, django/testing.md など）まで読んでから実装する
- 日本語を書く作業すべて: `natural-japanese` スキル
  （<agent-skills>/natural-japanese/SKILL.md）。設計書や README だけでなく、docstring、コメント、
  テスト名、ログメッセージ、コミットメッセージの日本語もこのスキルに従って書く

## 背景
<この変更が必要な理由。周辺の設計上の制約>

## やること
1. <具体的な手順>

## 規約（既定。変更指示がなければこのまま）
- 機能単位でコミットする（1機能 = 1コミット）
- 機能が一通り完成したら最後にリファクタリングし、1コミットにまとめる
- 各機能ごとにセルフレビューしてから次へ進む。観点は ponytail-review スキル（<ponytail-review-skill>）と、正しさ・セキュリティ・性能
- Git 操作は jj を使う（git を使う場合は理由を明示する）。分岐元と新規 bookmark 名、PR マージ先はユーザー指示に従う

## 触ってよいファイル
- path/to/a.py

## 触ってはいけないもの
- <他ペインが担当する範囲>

## 完了条件
- <テストコマンドが通る、など検証可能な形で>
```

## 既定規約の意図

ユーザーが特段の指示をしなくても、委譲する実装はこの流れに従う。規約欄にそのまま書き込む。

- 機能単位でコミットを残す。1機能 = 1コミットを目安にし、無関係な変更を混ぜたり、途中経過をまとめたりしない
- 機能が一通り完成したら、最後にリファクタリングする。重複や不整合、読みづらい箇所を整えて 1 コミットにまとめる
- 各機能ごとにセルフレビューする。差分を自分で読み、規約と計画からの逸脱、触ってはいけない範囲の混入を確認してから次の機能へ進む。観点は完了後に監督側が回す `/review` と `/ponytail-review`（SKILL.md 手順6）と同じにし、最後のレビューで指摘が山積みにならないようにする

分岐元（大元）のブランチ、新規 bookmark 名、PR のマージ先は状況ごとにユーザーが指定するため、固定しない。委譲を始める前にユーザーへ確認する。
