import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { changedLinesFromToolResult, lintChangedFile } from "./textlint";

// 直訳造語の辞書はnoslopのユーザー設定にある。idがJAで始まる[[custom]]のnameがNG語、hintが言い換え
const NOSLOP_CONFIG_PATH = join(homedir(), ".config", "noslop", "config.toml");
const NG_WORD_RULE_PREFIX = "JA";

interface NgWordEntry {
	word: string;
	replacement: string;
}

interface NoslopCustomRule {
	id?: string;
	name?: string;
	hint?: string;
}

function loadNgWords(): NgWordEntry[] {
	let config: { custom?: NoslopCustomRule[] };
	try {
		config = Bun.TOML.parse(readFileSync(NOSLOP_CONFIG_PATH, "utf8")) as { custom?: NoslopCustomRule[] };
	} catch {
		return [];
	}

	return (config.custom ?? []).flatMap((rule) =>
		rule.id?.startsWith(NG_WORD_RULE_PREFIX) && rule.name && rule.hint
			? [{ word: rule.name, replacement: rule.hint }]
			: [],
	);
}

function buildNgWordsPolicy(entries: NgWordEntry[]): string | undefined {
	if (entries.length === 0) return undefined;
	const lines = entries
		.map((entry) => `- 「${entry.word}」→ ${entry.replacement}`)
		.join("\n");
	return `## 直訳造語\n\n次の語は英語の直訳から作った造語なので使わず、右の言い換えを使う。\n\n${lines}\n`;
}

// textlintでよく指摘され、文で説明できるルールだけを事前に指示する。記号のルールはtextlintの検査に任せる。
// 弱い表現(ja-no-weak-phrase)はAGENTS.mdの「避ける表現」にあるので入れない
const TEXTLINT_POLICY = `## 日本語の表記(textlintで検査する)

日本語の文章は、書いたあとにtextlintで検査される。次の書き方は指摘されるので、最初から避ける。

- 「することができる」「することが可能」と書かず、「できる」と書く(冗長な表現)
- 一文の中で同じ助詞(は、に、が、を)を2回使わない。文を分けるか、言い換える
- 二重否定(「〜しないわけではない」など)を使わない
- ら抜き言葉(「見れる」「来れる」など)を使わない
`;

function runNoslop(args: string[], cwd: string, input?: string): string | undefined {
	const result = spawnSync("noslop", args, { cwd, input, encoding: "utf8", timeout: 10_000 });
	if (result.error || result.status !== 0) return undefined;
	return result.stdout;
}

const WRITE_TOOLS: Record<string, true> = { write: true, edit: true };

export default function japaneseWritingHooks(pi: ExtensionAPI) {
	pi.on("before_agent_start", (event) => {
		const ngWordsPolicy = buildNgWordsPolicy(loadNgWords());
		return {
			systemPrompt: [...event.systemPrompt, ...(ngWordsPolicy ? [ngWordsPolicy] : []), TEXTLINT_POLICY],
		};
	});

	pi.on("tool_result", async (event, ctx) => {
		if (event.isError || !WRITE_TOOLS[event.toolName]) return;

		// editの入力にはpathがないので、書き換えたファイルはツールの結果から取り出す
		const changedFiles = changedLinesFromToolResult(event.toolName, event.details, event.input, ctx.cwd);
		const reports: string[] = [];
		const textlintReports: string[] = [];
		for (const [path, changed] of changedFiles) {
			const report = runNoslop(["hook", "file", path], ctx.cwd)?.trim();
			if (report) reports.push(report);
			for (const issue of await lintChangedFile(path, changed, ctx.cwd)) {
				textlintReports.push(`- ${path}:${issue.line} ${issue.ruleId}: ${issue.message}`);
			}
		}
		if (textlintReports.length > 0) reports.push(`textlintの指摘（今回書き換えた行）:\n${textlintReports.join("\n")}`);
		if (reports.length === 0) return;

		return { additionalContext: reports.join("\n\n") };
	});
}
