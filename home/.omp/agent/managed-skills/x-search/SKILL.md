---
name: x-search
description: Xのポストを検索・読む。特定のユーザーの発言を探す、話題になっているポストを読む、XのURLの中身を読むとき
---

# Xの検索と読み取り

## 使い分け

- URLが分かっているポスト1件を読むときは、`readPost`を使う。ブラウザは使わない。
- それ以外（ユーザーの発言を探す、話題のポストを読むなど）は、`search`を使う。

## 呼び方

JavaScriptのeval（Bun）から呼ぶ。Pythonのevalでは使えない。

```js
const { search, readPost } = await import("/Users/tnmt/.omp/agent/managed-skills/x-search/x-search.js");

const posts = await search(browser, "from:NASA moon", { limit: 20, latest: true });
const post = await readPost("https://x.com/NASA/status/437774179505426432");
```

## search(browser, query, { limit, latest })

- ompのブラウザリレーで、ChromeにログインしているXのアカウントを使って検索する。背面にタブを開き、読み終えたら失敗したときも閉じる。
- `query`は、Xの検索構文をそのまま書く（`from:`、`since:`、`until:`、`"完全一致"`、`-除外`、`lang:ja`など）。
- `limit`は既定20件で、1〜100件に丸める。足りない分はスクロールして読み足し、新しいポストが3回続けて増えなければ打ち切る。そのため、`limit`より少ない件数を返すことがある。
- `latest`は既定`true`で「最新」タブを、`false`で「話題」タブを読む。
- 返り値は`[{ user, handle, time, url, text }]`で、`time`はISO 8601（UTC）、`url`はポストのURL。
- リポストは、元の投稿者と元のポストのURLで返る。
- 本文の改行と絵文字はそのまま残る。Xが省略して表示するリンクは`t.co`のURLになる。Xがカードとして表示するリンクと、引用ポストの中身は本文に入らないので、必要なら`readPost`で読む。

## readPost(url)

- FxTwitterのAPI（`https://api.fxtwitter.com/2/status/<id>`）でポスト1件を読む。ログインは要らない。
- `url`には、`x.com`、`twitter.com`、`fxtwitter.com`などの`/status/<id>`を含むURLか、IDだけを渡す。
- 返り値は`{ user, handle, time, url, text, media, quote }`。
  - `media`は`[{ type, url, thumbnail?, alt? }]`で、`type`は`photo`、`video`、`gif`のいずれか。
  - `quote`は引用ポストを同じ形で返し、引用がなければ`null`。削除などで読めない引用ポストは`{ url, unavailable: 理由 }`になる。

## 使い方の決まり

- 読むだけにする。ユーザー自身のアカウントなので、いいね、フォロー、投稿、返信、リポストなどの操作をしない。そうした操作をするコードも書かない。
- 検索は、1回の調査で数回（目安は3回）までにする。同じ条件で繰り返し検索しない。
- タブは`search`が開いて閉じる。Xのタブを自分で`browser.open`しない。
- 調査が終わったら`await browser.tabs()`で、名前が`x-search-`で始まるタブが残っていないことを確かめる。残っていたら`browser.close({ name })`で閉じる。
- Nitterは使わない。

## エラーのときの対処

| エラーのメッセージ | 対処 |
|---|---|
| `Xにログインしていません` | ChromeでXにログインするようユーザーに頼む。ログインまで再試行しない。 |
| `検索結果が0件でした` | 期間や語の条件を緩めて検索し直す。検索回数の上限に数える。 |
| `検索結果の読み込みが…終わりませんでした` | 繰り返さず、Xの障害、レート制限、ログイン切れの可能性をユーザーに伝える。 |
| `browser.open`のエラー（リレーにつながらない） | Chromeが起動しているか、ompのブラウザリレーの拡張が有効かをユーザーに確かめてもらう。 |
| `ポストのURLではありません` | 渡したURLに`/status/<id>`が含まれているか確かめる。 |
| `FxTwitterでポストを読めませんでした（404 …）`など | 削除、非公開、凍結の可能性をユーザーに伝える。 |

## テスト

ブラウザを使わない部分（ハンドルの分割、FxTwitterの応答の変換、重複の除去など）は、次のコマンドで確かめる。

```bash
cd /Users/tnmt/.omp/agent/managed-skills/x-search && bun test
```
