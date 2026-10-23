// 前回の実行以降に pi と Claude Code が書いた回答から、日本語の地の文だけを1行ずつ取り出す。
// 使い方: bun extract.ts          → 抽出して分割したファイルに書き、パスを表示する
//         bun extract.ts --done   → 今回の時刻を記録し、次回はそれ以降だけを読む
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const HOME = homedir();
const STAMP = join(HOME, ".claude", "hooks", ".ja-ng-scan-stamp");
const ROOTS = [join(HOME, ".pi", "agent", "sessions"), join(HOME, ".claude", "projects")];
const DEFAULT_DAYS = 14;
// サブエージェント1体が一度に読める量に分ける
const CHUNK_CHARS = 60_000;
const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff]/u;

if (process.argv.includes("--done")) {
	const now = new Date();
	if (existsSync(STAMP)) utimesSync(STAMP, now, now);
	else writeFileSync(STAMP, "");
	console.log(`recorded: ${now.toISOString()}`);
	process.exit(0);
}

const since = existsSync(STAMP)
	? statSync(STAMP).mtimeMs
	: Date.now() - DEFAULT_DAYS * 24 * 60 * 60 * 1000;

function* jsonlFiles(dir: string): Generator<string> {
	if (!existsSync(dir)) return;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* jsonlFiles(path);
		else if (entry.name.endsWith(".jsonl") && statSync(path).mtimeMs > since) yield path;
	}
}

// pi は {type:"message", message:{role:"assistant"}}、Claude Code は {type:"assistant", message:{role:"assistant"}}
function assistantTexts(line: string): string[] {
	let record: any;
	try {
		record = JSON.parse(line);
	} catch {
		return [];
	}
	if (record?.message?.role !== "assistant") return [];
	const time = Date.parse(record.timestamp ?? "");
	if (!Number.isNaN(time) && time <= since) return [];
	const content = record.message.content;
	if (!Array.isArray(content)) return [];
	return content.flatMap((part: any) => (part?.type === "text" && typeof part.text === "string" ? [part.text] : []));
}

// コードブロック、引用、インラインコードを除き、日本語を含む行だけを残す
function proseLines(text: string): string[] {
	const lines: string[] = [];
	let inFence = false;
	for (const raw of text.split("\n")) {
		if (/^\s*(```|~~~)/u.test(raw)) {
			inFence = !inFence;
			continue;
		}
		if (inFence || /^\s*>/u.test(raw)) continue;
		const line = raw.replace(/`[^`]*`/gu, " ").trim();
		if (JAPANESE.test(line)) lines.push(line);
	}
	return lines;
}

const seen = new Set<string>();
let files = 0;
for (const root of ROOTS) {
	for (const file of jsonlFiles(root)) {
		files++;
		for (const line of readFileSync(file, "utf8").split("\n")) {
			for (const text of assistantTexts(line)) {
				for (const prose of proseLines(text)) seen.add(prose);
			}
		}
	}
}

const outDir = join(tmpdir(), "ja-ng-scan");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const chunks: string[] = [];
let current = "";
for (const line of seen) {
	if (current.length + line.length > CHUNK_CHARS && current) {
		chunks.push(current);
		current = "";
	}
	current += line + "\n";
}
if (current) chunks.push(current);

console.log(`since: ${new Date(since).toISOString()}`);
console.log(`files: ${files}, lines: ${seen.size}, chunks: ${chunks.length}`);
chunks.forEach((chunk, index) => {
	const path = join(outDir, `${String(index + 1).padStart(2, "0")}.txt`);
	writeFileSync(path, chunk);
	console.log(path);
});
