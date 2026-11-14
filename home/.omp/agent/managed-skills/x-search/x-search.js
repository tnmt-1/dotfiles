// Read-only helpers for X (Twitter): search through the user's logged-in Chrome (omp browser relay), read one post through FxTwitter.

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const LOAD_TIMEOUT_MS = 20_000;
const POLL_MS = 500;
const SCROLL_WAIT_MS = 1_500;
const MAX_IDLE_SCROLLS = 3;
const MAX_SCROLLS = 40;

export function parseUserName(text) {
  const match = /^(.*)@([A-Za-z0-9_]{1,15})(?:·.*)?$/s.exec(text.trim());
  if (!match) return { user: text.trim(), handle: null };
  return { user: match[1].trim(), handle: match[2] };
}

export function normalizeArticle(raw) {
  if (!raw.time || !raw.href) return null;
  const url = new URL(raw.href, "https://x.com").href;
  const { user, handle } = parseUserName(raw.userName);
  return {
    user,
    handle: handle ?? new URL(url).pathname.split("/")[1],
    time: raw.time,
    url,
    text: raw.text,
  };
}

export function mergeUnique(list, items) {
  const seen = new Set(list.map((post) => post.url));
  let added = 0;
  for (const post of items) {
    if (!post || seen.has(post.url)) continue;
    seen.add(post.url);
    list.push(post);
    added++;
  }
  return added;
}

export function searchUrl(query, latest) {
  return `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query${latest ? "&f=live" : ""}`;
}

export function pageState({ url, articles, empty }) {
  if (/^https:\/\/(x|twitter)\.com\/(i\/flow\/)?login/.test(url)) return "login";
  if (articles > 0) return "ready";
  if (empty) return "empty";
  return "loading";
}

export function statusId(urlOrId) {
  const input = String(urlOrId).trim();
  if (/^\d+$/.test(input)) return input;
  const match = /\/status(?:es)?\/(\d+)/.exec(input);
  if (!match) throw new Error(`ポストのURLではありません: ${input}`);
  return match[1];
}

function toPost(status) {
  if (status.type === "tombstone") return { url: status.url, unavailable: status.reason };
  return {
    user: status.author.name,
    handle: status.author.screen_name,
    time: new Date(status.created_timestamp * 1000).toISOString(),
    url: status.url,
    text: status.text,
    media: (status.media?.all ?? []).map((m) => ({
      type: m.type,
      url: m.url,
      ...(m.thumbnail_url && { thumbnail: m.thumbnail_url }),
      ...(m.altText && { alt: m.altText }),
    })),
    quote: status.quote ? toPost(status.quote) : null,
  };
}

export function fromFxTwitter(body) {
  if (body.code !== 200 || !body.status) {
    throw new Error(`FxTwitterでポストを読めませんでした（${body.code} ${body.message ?? ""}）`);
  }
  return toPost(body.status);
}

export async function readPost(url) {
  const id = statusId(url);
  const res = await fetch(`https://api.fxtwitter.com/2/status/${id}`);
  const body = await res.json().catch(() => ({ code: res.status, message: res.statusText }));
  return fromFxTwitter(body);
}

// Runs in the page; must stay self-contained.
function readArticles() {
  const textOf = (root) => {
    const clone = root.cloneNode(true);
    for (const img of clone.querySelectorAll("img")) img.replaceWith(img.alt);
    for (const a of clone.querySelectorAll("a")) {
      const shown = a.textContent;
      if (!/^https?:\/\//.test(shown)) continue;
      a.replaceWith(shown.endsWith("…") ? a.href : shown);
    }
    return clone.textContent;
  };
  const outsideQuote = (el) => !el.closest('div[role="link"]');
  return [...document.querySelectorAll('article[data-testid="tweet"]')].map((article) => {
    const name = [...article.querySelectorAll('[data-testid="User-Name"]')].find(outsideQuote);
    const time = [...article.querySelectorAll("time[datetime]")].find(outsideQuote);
    const text = [...article.querySelectorAll('[data-testid="tweetText"]')].find(outsideQuote);
    return {
      userName: name ? textOf(name) : "",
      time: time?.getAttribute("datetime") ?? null,
      href: time?.closest("a")?.getAttribute("href") ?? null,
      text: text ? textOf(text) : "",
    };
  });
}

function countState() {
  return {
    articles: document.querySelectorAll('article[data-testid="tweet"]').length,
    empty: !!document.querySelector('[data-testid="emptyState"]'),
  };
}

function scrollDown() {
  window.scrollBy(0, window.innerHeight * 2);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForResults(tab, query) {
  const deadline = Date.now() + LOAD_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const state = pageState({ url: await tab.url(), ...(await tab.evaluate(countState)) });
    if (state === "ready") return;
    if (state === "login") throw new Error("Xにログインしていません（ログイン画面に移動しました）。ChromeでXにログインしてから、もう一度実行してください。");
    if (state === "empty") throw new Error(`検索結果が0件でした: ${query}`);
    await sleep(POLL_MS);
  }
  throw new Error(`検索結果の読み込みが${LOAD_TIMEOUT_MS / 1000}秒以内に終わりませんでした: ${query}（Xの障害、レート制限、またはログイン切れの可能性があります）`);
}

export async function search(browser, query, { limit = DEFAULT_LIMIT, latest = true } = {}) {
  const want = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);
  const name = `x-search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const tab = await browser.open({ name, url: searchUrl(query, latest), app: { relay: true } });
    await waitForResults(tab, query);
    const posts = [];
    let idle = 0;
    for (let round = 0; round <= MAX_SCROLLS && posts.length < want && idle < MAX_IDLE_SCROLLS; round++) {
      const added = mergeUnique(posts, (await tab.evaluate(readArticles)).map(normalizeArticle));
      idle = added === 0 ? idle + 1 : 0;
      if (posts.length >= want) break;
      await tab.evaluate(scrollDown);
      await sleep(SCROLL_WAIT_MS);
    }
    return posts.slice(0, want);
  } finally {
    await browser.close({ name });
  }
}
