---
name: bunfmt
description: >-
  マニュアル、操作手順、画面文言、仕様書、リリースノート、ヘルプ、お知らせの表記を揃えて、書くか直す。日本語の文書を書き終えたあと、表記の最終検査として1回使う。表記と読みにくさのうち機械的に決まるものは scripts/check.js で検査し、直してから文を返す。
---

# 日本語の実用文を書いて直す

ユーザーに返すのは、書いた文、または直した文である。変更一覧、根拠の表、推敲の節は、ユーザーが求めたときだけ付ける。

第3版の紙面はこのスキルにない。機械的に決まる表記は、JTF日本語標準スタイルガイド（CC BY-SA）を実装した textlint と、技術文書向けの textlint プリセットで検査する。何が検査できて、何が検査できないかは [references/coverage.md](references/coverage.md) に書いてある。検査できない判断は [references/judgment.md](references/judgment.md) だけを使う。

## 手順

1. 文書種別を決める。マニュアル、UI、リリースノート、実用文全般は `--style desu`。仕様書は、原稿が「だ・である」なら `--style dearu`、原稿が「です・ます」なら `--style desu`。
2. [references/overrides.md](references/overrides.md) に規則があれば、それを textlint より優先する。
3. [references/judgment.md](references/judgment.md) に当てはまる箇所を直す。原稿に無い事実、操作、原因は足さない。
4. 次を実行する。`scripts/node_modules` が無ければ、先に `scripts` で `npm install` する。

```bash
node scripts/check.js --fix --style desu path.md
node scripts/check.js --style desu path.md
```

チャットに貼られた文は、一時ファイルに書いて同じコマンドを使う。標準入力も使える。

```bash
node scripts/check.js --fix --style desu < path.md
```

`--fix` で標準入力を渡したときは、直った文が標準出力、残った指摘が標準エラーである。ファイルを渡したときは、`--fix` がそのファイルを書き換える。

5. 終了コードが 0 になるまで、指摘を読んで直す。コード、URL、識別子、画面に出る文字列、引用は直さない。指摘が誤検知なら、その箇所は残し、文の末尾に一行だけ理由を書く。
6. 直した文を返す。

## 書籍と違うと指摘されたとき

指摘を [references/overrides.md](references/overrides.md) に追記する。書籍の文は写さない。追記した内容を、以後の検査より優先する。
