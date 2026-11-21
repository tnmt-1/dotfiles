import { describe, expect, test } from "bun:test";
import {
  fromFxTwitter,
  mergeUnique,
  normalizeArticle,
  pageState,
  parseUserName,
  searchUrl,
  statusId,
} from "./x-search.js";

const jack = await Bun.file(new URL("./fixtures/fxtwitter-jack-20.json", import.meta.url)).json();
const nasa = await Bun.file(new URL("./fixtures/fxtwitter-nasa-2119136607009734978.json", import.meta.url)).json();

describe("parseUserName", () => {
  test("表示名とハンドルを分ける", () => {
    expect(parseUserName("NASA@NASA·2h")).toEqual({ user: "NASA", handle: "NASA" });
  });

  test("表示名に@や絵文字を含んでも、最後の@をハンドルとする", () => {
    expect(parseUserName("Moon @ Night 🌙@moon_bot·Nov 7")).toEqual({ user: "Moon @ Night 🌙", handle: "moon_bot" });
  });

  test("ハンドルが見つからなければnullを返す", () => {
    expect(parseUserName("NASA")).toEqual({ user: "NASA", handle: null });
  });
});

describe("normalizeArticle", () => {
  test("相対URLを絶対URLにし、本文の改行とリンクを残す", () => {
    const raw = {
      userName: "NASA@NASA·2h",
      time: "2026-11-07T10:00:00.000Z",
      href: "/NASA/status/2119136607009734978",
      text: "Do you want to be an astronaut?\n\napply: https://go.nasa.gov/4iGqLqu",
    };
    expect(normalizeArticle(raw)).toEqual({
      user: "NASA",
      handle: "NASA",
      time: "2026-11-07T10:00:00.000Z",
      url: "https://x.com/NASA/status/2119136607009734978",
      text: "Do you want to be an astronaut?\n\napply: https://go.nasa.gov/4iGqLqu",
    });
  });

  test("ハンドルが読めなければURLから取る", () => {
    const raw = { userName: "", time: "2026-11-07T10:00:00.000Z", href: "/NASA/status/1", text: "" };
    expect(normalizeArticle(raw).handle).toBe("NASA");
  });

  test("時刻やリンクのない記事（広告など）はnullにする", () => {
    expect(normalizeArticle({ userName: "Ad@ad", time: null, href: null, text: "buy" })).toBeNull();
  });
});

describe("mergeUnique", () => {
  test("URLが同じポストを除き、加えた件数を返す", () => {
    const list = [{ url: "https://x.com/a/status/1" }];
    const added = mergeUnique(list, [
      { url: "https://x.com/a/status/1" },
      { url: "https://x.com/a/status/2" },
      { url: "https://x.com/a/status/2" },
      null,
    ]);
    expect(added).toBe(1);
    expect(list.map((p) => p.url)).toEqual(["https://x.com/a/status/1", "https://x.com/a/status/2"]);
  });
});

describe("searchUrl", () => {
  test("latestなら最新タブ、クエリはエンコードする", () => {
    expect(searchUrl("from:NASA moon", true)).toBe("https://x.com/search?q=from%3ANASA%20moon&src=typed_query&f=live");
  });

  test("latestがfalseなら話題タブ（fを付けない）", () => {
    expect(searchUrl("moon", false)).toBe("https://x.com/search?q=moon&src=typed_query");
  });
});

describe("pageState", () => {
  test("ログイン画面に飛ばされたらlogin", () => {
    expect(pageState({ url: "https://x.com/i/flow/login?redirect_after_login=%2Fsearch", articles: 0, empty: false })).toBe("login");
    expect(pageState({ url: "https://x.com/login", articles: 0, empty: false })).toBe("login");
  });

  test("ポストがあればready、空の表示ならempty、どちらもなければloading", () => {
    expect(pageState({ url: "https://x.com/search?q=a", articles: 3, empty: false })).toBe("ready");
    expect(pageState({ url: "https://x.com/search?q=a", articles: 0, empty: true })).toBe("empty");
    expect(pageState({ url: "https://x.com/search?q=a", articles: 0, empty: false })).toBe("loading");
  });
});

describe("statusId", () => {
  test("x.com、twitter.com、fxtwitterのURLとIDだけの文字列からIDを取る", () => {
    expect(statusId("https://x.com/NASA/status/2119136607009734978")).toBe("2119136607009734978");
    expect(statusId("https://twitter.com/jack/status/20?s=20")).toBe("20");
    expect(statusId("https://fxtwitter.com/i/web/status/20/photo/1")).toBe("20");
    expect(statusId("20")).toBe("20");
  });

  test("ポストのURLでなければエラー", () => {
    expect(() => statusId("https://x.com/NASA")).toThrow("ポストのURL");
  });
});

describe("fromFxTwitter", () => {
  test("本文の改行とリンク、動画を返す", () => {
    expect(fromFxTwitter(nasa)).toEqual({
      user: "NASA",
      handle: "NASA",
      time: "2026-11-07T18:35:13.000Z",
      url: "https://x.com/NASA/status/2119136607009734978",
      text: "Do you want to be an astronaut?\n\nApplications are now open to join NASA's astronaut corps. Join us as we expand the frontiers of discovery in low Earth orbit, on the Moon, and beyond — apply by Dec. 3: https://go.nasa.gov/4iGqLqu",
      media: [
        {
          type: "video",
          url: "https://video.twimg.com/amplify_video/2119136507600531456/vid/avc1/1080x1920/kYn5lFx09UoeDMkc.mp4?tag=16",
          thumbnail: "https://pbs.twimg.com/media/HWivgtWW8AEKfEF.jpg",
        },
      ],
      quote: null,
    });
  });

  test("メディアがなければ空の配列", () => {
    const post = fromFxTwitter(jack);
    expect(post).toMatchObject({ user: "jack", handle: "jack", text: "just setting up my twttr", time: "2006-03-21T20:50:14.000Z" });
    expect(post.media).toEqual([]);
  });

  test("引用ポストを同じ形で返す", () => {
    const quoting = structuredClone(nasa);
    quoting.status.quote = jack.status;
    expect(fromFxTwitter(quoting).quote).toEqual({
      user: "jack",
      handle: "jack",
      time: "2006-03-21T20:50:14.000Z",
      url: "https://x.com/jack/status/20",
      text: "just setting up my twttr",
      media: [],
      quote: null,
    });
  });

  test("読めない引用ポストは理由を返す", () => {
    const quoting = structuredClone(nasa);
    quoting.status.quote = { type: "tombstone", reason: "deleted", url: "https://x.com/i/status/1" };
    expect(fromFxTwitter(quoting).quote).toEqual({ url: "https://x.com/i/status/1", unavailable: "deleted" });
  });

  test("エラーの応答は、コードとメッセージを含むエラーにする", () => {
    expect(() => fromFxTwitter({ code: 404, message: "NOT_FOUND" })).toThrow(/404.*NOT_FOUND/);
  });
});
