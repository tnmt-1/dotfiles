#!/usr/bin/env bun
/**
 * Claude Code用 日本語ライティングフック。oh-my-piの拡張 ~/.omp/agent/extensions/japanese-writing-hooks.ts と同じ処理をする。
 *
 * 文体の方針はAGENTS.md(~/.claude/CLAUDE.md)に書き、このフックは次だけを受け持つ:
 *
 *   bun japanese-writing-hook.ts prompt    # UserPromptSubmit: 直訳造語の一覧とtextlintの方針をコンテキストに注入
 *   bun japanese-writing-hook.ts stop      # Stop: 最終回答をnoslopで検査し、重い指摘があれば書き直しを要求
 *   bun japanese-writing-hook.ts posttool  # PostToolUse(Write|Edit): 書き込んだファイルの指摘をnoslopとtextlintから渡す
 *
 * textlintの検査は、隣の textlint/ にある。textlintとプラグインは textlint/node_modules に入れる（cd textlint && bun install）。
 *
 * 直訳造語の辞書はnoslopのユーザー設定 ~/.config/noslop/config.toml にある。
 * idがJAで始まる[[custom]]のnameがNG語、hintが言い換え。
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { type ChangedLines, lintChangedFile } from "./textlint/textlint";

const NOSLOP_CONFIG_PATH = join(homedir(), ".config", "noslop", "config.toml");
const NG_WORD_RULE_PREFIX = "JA";
const JAPANESE_TEXT = /[\u3040-\u30ff\u3400-\u9fff]/u;

interface NoslopCustomRule {
	id?: string;
	name?: string;
	hint?: string;
}

async function buildNgWordsPolicy(): Promise<string | undefined> {
	let config: { custom?: NoslopCustomRule[] };
	try {
		config = Bun.TOML.parse(await Bun.file(NOSLOP_CONFIG_PATH).text()) as { custom?: NoslopCustomRule[] };
	} catch {
		return undefined;
	}

	const lines = (config.custom ?? []).flatMap((rule) =>
		rule.id?.startsWith(NG_WORD_RULE_PREFIX) && rule.name && rule.hint ? [`- 「${rule.name}」→ ${rule.hint}`] : [],
	);
	if (lines.length === 0) return undefined;
	return `## 直訳造語\n\n次の語は英語の直訳から作った造語なので使わず、右の言い換えを使う。\n\n${lines.join("\n")}\n`;
}

function hasUnclosedFence(text: string): boolean {
	let fenceChar: string | undefined;
	let fenceLength = 0;

	for (const line of text.split("\n")) {
		const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
		if (!match) continue;

		const marker = match[1];
		if (fenceChar === undefined) {
			fenceChar = marker[0];
			fenceLength = marker.length;
		} else if (marker[0] === fenceChar && marker.length >= fenceLength && /^\s*$/u.test(match[2])) {
			fenceChar = undefined;
		}
	}

	return fenceChar !== undefined;
}

function runNoslop(args: string[], cwd: string | undefined, input: string): string | undefined {
	const result = Bun.spawnSync(["noslop", ...args], { cwd, stdin: Buffer.from(input), timeout: 10_000 });
	if (!result.success) return undefined;
	return result.stdout.toString();
}

// 回答を書き直させる指摘。R14(文・段落の重複)は重大度がinfoでも対象にする
const BLOCKING_SEVERITIES: Record<string, true> = { warning: true, error: true };
const ALWAYS_BLOCKING_RULES: Record<string, true> = { R14: true };

interface BriefReport {
	files: {
		rules: { ruleId: string; title: string; maxSeverity: string; hint: string | null }[];
		occurrences: { ruleId: string; message: string }[];
	}[];
}

function findNoslopIssues(text: string, cwd: string | undefined): string[] {
	const stdout = runNoslop(
		["check", "-", "--stdin-filename", "reply.md", "--report", "brief", "--format", "json", "--include", "lists,tables"],
		cwd,
		text,
	);
	if (!stdout) return [];

	const issues: string[] = [];
	for (const file of (JSON.parse(stdout) as BriefReport).files) {
		for (const rule of file.rules) {
			if (!BLOCKING_SEVERITIES[rule.maxSeverity] && !ALWAYS_BLOCKING_RULES[rule.ruleId]) continue;
			const messages = [
				...new Set(
					file.occurrences
						.filter((occurrence) => occurrence.ruleId === rule.ruleId)
						.map((occurrence) => occurrence.message),
				),
			];
			const hint = rule.hint ? `。直し方: ${rule.hint}` : "";
			issues.push(`${rule.ruleId} ${rule.title}: ${messages.join(" / ")}${hint}`);
		}
	}
	return issues;
}

interface HookInput {
	cwd?: string;
	prompt?: string;
	stop_hook_active?: boolean;
	last_assistant_message?: string;
	transcript_path?: string;
}

interface TranscriptEntry {
	type?: string;
	isSidechain?: boolean;
	message?: { content?: { type?: string; text?: string }[] };
}

// Claude Codeのtranscript(JSONL)から、直近のassistantメッセージ本文を取り出す
async function readLastAssistantText(transcriptPath: string): Promise<string> {
	let raw: string;
	try {
		raw = await Bun.file(transcriptPath).text();
	} catch {
		return "";
	}

	const lines = raw.split("\n");
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i].trim();
		if (!line) continue;

		let entry: TranscriptEntry;
		try {
			entry = JSON.parse(line) as TranscriptEntry;
		} catch {
			continue;
		}

		if (entry.type !== "assistant" || entry.isSidechain === true) continue;
		const content = entry.message?.content;
		if (!Array.isArray(content)) continue;

		const text = content.flatMap((part) => (part?.type === "text" && part.text ? [part.text] : [])).join("\n");
		if (text.trim()) return text;
	}

	return "";
}

// textlintでよく指摘され、文で説明できるルールだけを事前に指示する。ompの拡張と同じ内容にする
const TEXTLINT_POLICY = `## 日本語の表記(textlintで検査する)

日本語の文章は、書いたあとにtextlintで検査される。次の書き方は指摘されるので、最初から避ける。

- 「することができる」「することが可能」と書かず、「できる」と書く(冗長な表現)
- 一文の中で同じ助詞(は、に、が、を)を2回使わない。文を分けるか、言い換える
- 二重否定(「〜しないわけではない」など)を使わない
- ら抜き言葉(「見れる」「来れる」など)を使わない
`;

export function buildPromptContext(ngWordsPolicy: string | undefined): string {
	return [ngWordsPolicy, TEXTLINT_POLICY].filter(Boolean).join("\n");
}

async function handlePromptSubmit(): Promise<void> {
	console.log(
		JSON.stringify({
			suppressOutput: true,
			hookSpecificOutput: {
				hookEventName: "UserPromptSubmit",
				additionalContext: buildPromptContext(await buildNgWordsPolicy()),
			},
		}),
	);
}

async function handleStop(raw: string): Promise<void> {
	let input: HookInput;
	try {
		input = JSON.parse(raw) as HookInput;
	} catch {
		return;
	}

	// 二重発火(この検査が要求した書き直し後のStop)では再検査しない
	if (input.stop_hook_active === true) return;

	// Stop時点ではトランスクリプトへの書き込みが間に合わず、1つ前の回答を読むことがある。
	// 入力に含まれる last_assistant_message を優先する。
	const text =
		typeof input.last_assistant_message === "string"
			? input.last_assistant_message
			: input.transcript_path
				? await readLastAssistantText(input.transcript_path)
				: "";
	if (!JAPANESE_TEXT.test(text)) return;

	const issues = findNoslopIssues(text, input.cwd);
	if (hasUnclosedFence(text)) issues.unshift("コードフェンスが閉じていない");
	if (issues.length === 0) return;

	console.log(
		JSON.stringify({
			decision: "block",
			reason: `回答を確定しないでください。次の問題だけを修正し、内容を増やさずに回答全体を書き直してください。検出した問題:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
		}),
	);
}

interface PostToolInput {
	tool_name?: string;
	tool_input?: { file_path?: unknown };
	tool_response?: { structuredPatch?: { newStart: number; lines: string[] }[] };
	cwd?: string;
}

// Writeはファイル全体、Edit・MultiEditはstructuredPatchで追加した行を、新しいファイルの行番号で返す
export function changedLinesFromHookInput(input: PostToolInput): Map<string, ChangedLines> {
	const changed = new Map<string, ChangedLines>();
	const path = input.tool_input?.file_path;
	if (typeof path !== "string") return changed;

	if (input.tool_name === "Write") {
		changed.set(path, "all");
	} else if (input.tool_name === "Edit" || input.tool_name === "MultiEdit") {
		const patch = input.tool_response?.structuredPatch;
		if (!Array.isArray(patch)) return changed;
		const lines = new Set<number>();
		for (const hunk of patch) {
			let line = hunk.newStart;
			for (const patchLine of hunk.lines) {
				if (patchLine.startsWith("-")) continue;
				if (patchLine.startsWith("+")) lines.add(line);
				line++;
			}
		}
		changed.set(path, lines);
	}
	return changed;
}

export async function textlintReport(changedFiles: Map<string, ChangedLines>, cwd: string): Promise<string | undefined> {
	if (changedFiles.size === 0) return undefined;
	const lines: string[] = [];
	for (const [path, changed] of changedFiles) {
		for (const issue of await lintChangedFile(path, changed, cwd)) {
			lines.push(`- ${path}:${issue.line} ${issue.ruleId}: ${issue.message}`);
		}
	}
	return lines.length > 0 ? `textlintの指摘（今回書き換えた行）:\n${lines.join("\n")}` : undefined;
}

// noslopの出力(hookSpecificOutputのJSON)に、textlintの指摘を加えて1つのadditionalContextにする
export function mergePostToolContext(noslopStdout: string | undefined, textlint: string | undefined): string | undefined {
	const noslop = noslopStdout?.trim() ? noslopStdout : undefined;
	if (!textlint) return noslop;

	let context: string | undefined;
	if (noslop) {
		try {
			context = (JSON.parse(noslop) as { hookSpecificOutput?: { additionalContext?: string } }).hookSpecificOutput
				?.additionalContext;
		} catch {
			context = undefined;
		}
	}
	return JSON.stringify({
		hookSpecificOutput: {
			hookEventName: "PostToolUse",
			additionalContext: [context, textlint].filter(Boolean).join("\n\n"),
		},
	});
}

// noslop hook claude-code とtextlintで、書き込んだファイルの変わった行を検査し、指摘をadditionalContextで返す
async function handlePostTool(raw: string): Promise<void> {
	const noslopStdout = runNoslop(["hook", "claude-code"], undefined, raw);
	let input: PostToolInput;
	try {
		input = JSON.parse(raw) as PostToolInput;
	} catch {
		input = {};
	}
	const textlint = await textlintReport(changedLinesFromHookInput(input), input.cwd ?? process.cwd());
	const output = mergePostToolContext(noslopStdout, textlint);
	if (output) process.stdout.write(output);
}

if (import.meta.main) {
	// pi (claude-bridge) 経由では pi 拡張が同じ処理をするので何もしない
	if (process.env.PI_CODING_AGENT) process.exit(0);

	const mode = process.argv[2];
	if (mode === "prompt") {
		await handlePromptSubmit();
	} else if (mode === "stop") {
		await handleStop(await Bun.stdin.text());
	} else if (mode === "posttool") {
		await handlePostTool(await Bun.stdin.text());
	} else {
		console.error(`unknown mode: ${mode ?? "(none)"} — use "prompt", "stop", or "posttool"`);
		process.exit(1);
	}
}
