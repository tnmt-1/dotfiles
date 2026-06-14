---
name: commit-message
description: 現在のブランチやステージングされたファイルの変更内容に基づいて、明確で規約に沿ったコミットメッセージを生成します！🚀
---

# コミットメッセージ生成プロンプト

目的は、簡潔で意味があり、かつ規約に従ったコミットメッセージを生成することです！📋

## ルール
* コンベンショナルコミット (Conventional Commits / 規約に基づいたコミット) スタイルを使用してください：`type: 短い説明`
  * タイプ一覧: feat (機能追加), fix (バグ修正), docs (ドキュメント), style (書式・スタイル), refactor (リファクタリング), test (テスト), chore (雑用・その他)
  * 必要に応じて、本文に詳細な説明を含めてください。
  * 利用可能な場合は、関連するイシュー (Issue / 課題) やプルリクエスト (PR: Pull Request / 変更要求) を参照してください（例: `#123`）。
  * 常に現在形を使用してください。例： "Added feature" ではなく "Add feature" と記述します！💡
  * コミットメッセージのみを、マークダウン (Markdown / 文書記述言語) のコードブロック形式で出力してください。
  * コミットメッセージは日本語で出力してください。

## 例

英語での出力例ですが、日本語で出力することを守ってください。

```text
feat: add user authentication endpoint

- Implement JWT-based login
- Validate email and password
- Update documentation
- Closes #42
```
