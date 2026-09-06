---
name: spec-writing
description: "Write functional specification documents (docs/specs/) with the project's 3-part format and paragraph-level composition"
---

# Spec Writing（機能仕様書）

## When to use

The user says 「spec書いて」「仕様書を作成」「specification」「機能仕様」— and the document belongs in `docs/specs/`. A spec defines **what** a feature does and **how** it behaves, at a level that matches implementation and tests.

## Process

Follow the article's 4-level decomposition, in order:

### 1. 企画（What/Why）

Confirm from context or ask if unclear:

- **テーマ**: この機能は何か（一文）
- **対象読者**: 誰に向けて書くか（実装者／レビューア／運用担当者）
- **目的**: この文書を読んだ後に読者に何をしてほしいか

### 2. アウトライン（全体構成）

Write section headings first—before any prose. The canonical structure:

```
## 概要
## 用語・前提条件
## 機能仕様
  ### シナリオ
  ### 非ゴール（この機能の範囲外）
  ### UIの流れ（画面遷移・API呼び出し順）
  ### エッジケース
## 詳細仕様
  ### API変更一覧
  ### データモデル（ER図）
  ### 権限・ロール
  ### 環境変数・フラグ
  ### 関連ファイル
## 未解決課題
## 関連資料
```

- 見出しは仮でOK。あとで修正する
- 各見出しの下に「ここに書くこと」を箇条書きでメモする（手順3の準備）
- 「非ゴール」は書く。後で「これも含まれてる？」の確認が減る

### 3. 段落（Paragraph Writing）

For each heading, apply パラグラフライティング:

1. **主題文**: この段落で伝えることを1文に
2. **展開文**: 具体例・理由・補足（3-4個が適量）
3. **結語文**: 段落の締め（省略可）

**What（何を書くか）とHow（どう表現するか）を分ける。**
まずは箇条書きで内容だけ決め、後で滑らかな文に直す。

### 4. 文（Prose）

段落の内容を滑らかな文に書き直す。

- 図・表・箇条書きを適宜使う
- 処理の流れはMermaidシーケンス図を使う
- Mermaid図は構文エラーがないか実機確認する

## Conventions（from docs/specs/README.md）

- **1機能1ファイル**: ファイル名 `spec-<feature>.md`
- **3部構成**: 概要／機能仕様／詳細仕様（これ自体はREADMEに書いてある合意）
- **未解決課題は空欄禁止**: 特になければ「なし」と明記
- **設計判断はADRに分離**: なぜその方式を選んだかはSpecに書かず、`docs/adr/` へ
- **実装変更と同時更新**: Spec変更と実装変更は同じPRで揃える
- **一覧更新**: 新規Spec追加時は `docs/specs/README.md` の一覧表も更新する
- **日付・著者**: 作成日・最終更新日・作成者を冒頭に残す

## Edge Cases

- 既存機能の一部変更 → 新規ファイルを作らず、既存Specに追記する
- 検討中の内容 → `docs/sdd/` に置き、確定したらSpecに昇格させる
- コードレベルの詳細 → Specに含めてよい（READMEに明記済み）
- 依存関係のある複数機能 → それぞれ独立したファイルに分ける。1ファイルに詰め込まない

## Verification

- すべての見出しを確認：重複・漏れ・順序の妥当性
- Mermaid図が構文エラーなくレンダリングされること
- 例示したコードサンプルやAPIリクエストが実際に動作すること
- README一覧が更新されていること
