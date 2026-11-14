import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

/**
 * pi 用 日本語ライティングフック
 * ~/.omp/agent/extensions/japanese-writing-hooks.ts (oh-my-pi拡張) の pi 移植版。
 * Claude Code用の ~/.claude/hooks/japanese-writing-hook.ts も同じ処理をする。
 *
 * 文体の方針はAGENTS.mdに書き、この拡張は次だけを受け持つ:
 *   - 直訳造語の一覧をシステムプロンプトへ足す
 *   - 最終回答をnoslopで検査し、重い指摘があれば書き直しを求める
 *   - write/editで書き込んだファイルのnoslopの指摘をツール結果に添える
 *
 * 直訳造語の辞書はnoslopのユーザー設定 ~/.config/noslop/config.toml にある。
 * idがJAで始まる[[custom]]のnameがNG語、hintが言い換え。
 *
 * omp の session_stop → pi では agent_settled + sendUserMessage(followUp) で同等処理。
 * 書き直し要求はユーザープロンプト1回につき1回まで (omp の stop_hook_active 相当)。
 */

const NOSLOP_CONFIG_PATH = join(homedir(), ".config", "noslop", "config.toml");
const NG_WORD_RULE_PREFIX = "JA";
const JAPANESE_TEXT = /[\u3040-\u30ff\u3400-\u9fff]/u;

// piはNode上で動きBun.TOMLがないため、[[custom]]のid・name・hintだけを読む
function parseTomlString(raw: string): string | undefined {
	const value = raw.trim();
	if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
	try {
		const parsed: unknown = JSON.parse(value);
		return typeof parsed === "string" ? parsed : undefined;
	} catch {
		return undefined;
	}
}

function buildNgWordsPolicy(): string | undefined {
	let raw: string;
	try {
		raw = readFileSync(NOSLOP_CONFIG_PATH, "utf8");
	} catch {
		return undefined;
	}

	const rules: Record<string, string>[] = [];
	let current: Record<string, string> | undefined;
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (trimmed === "[[custom]]") {
			current = {};
			rules.push(current);
		} else if (trimmed.startsWith("[")) {
			current = undefined;
		} else if (current) {
			const match = trimmed.match(/^(id|name|hint)\s*=\s*(.+)$/u);
			const value = match ? parseTomlString(match[2]) : undefined;
			if (match && value !== undefined) current[match[1]] = value;
		}
	}

	const lines = rules.flatMap((rule) =>
		rule.id?.startsWith(NG_WORD_RULE_PREFIX) && rule.name && rule.hint ? [`- 「${rule.name}」→ ${rule.hint}`] : [],
	);
	if (lines.length === 0) return undefined;
	return `## 直訳造語\n\n次の語は英語の直訳から作った造語なので使わず、右の言い換えを使う。\n\n${lines.join("\n")}\n`;
}

function getAssistantText(message: AgentMessage | undefined): string {
	if (!message || message.role !== "assistant") return "";

	return message.content
		.flatMap((part) => (part.type === "text" ? [part.text] : []))
		.join("\n");
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

function runNoslop(args: string[], cwd: string, input?: string): string | undefined {
	const result = spawnSync("noslop", args, { cwd, input, encoding: "utf8", timeout: 10_000 });
	if (result.error || result.status !== 0) return undefined;
	return result.stdout;
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

function findNoslopIssues(text: string, cwd: string): string[] {
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

const WRITE_TOOLS: Record<string, true> = { write: true, edit: true };

export default function japaneseWritingHooks(pi: ExtensionAPI) {
	// systemPrompt を返すと claude-bridge が捨てるので、sections に入れる
	pi.on("before_agent_start", (event) => {
		const policy = buildNgWordsPolicy();
		if (policy) event.systemPromptOptions.sections["japanese-writing"] = policy;
	});

	// piのtool_resultにはadditionalContextがないため、指摘はツール結果の本文に添える
	pi.on("tool_result", (event, ctx) => {
		if (event.isError || !WRITE_TOOLS[event.toolName]) return;

		const target = event.input.path;
		if (typeof target !== "string") return;

		const report = runNoslop(["hook", "file", resolve(ctx.cwd, target)], ctx.cwd)?.trim();
		if (!report) return;

		return {
			content: [...event.content, { type: "text", text: report }],
			structuredContent: event.structuredContent,
		};
	});

	// 書き直し要求はユーザープロンプト(extension 由来でない input)ごとに1回まで。
	// 書き直しの followUp は source="extension" なのでここではリセットされない。
	let rewriteRequested = false;

	// 検査対象の最終回答を追跡するための実行状態
	let runInProgress = false;
	let lastAssistantText = "";

	pi.on("input", (event) => {
		if (event.source !== "extension") {
			rewriteRequested = false;
		}
	});

	pi.on("agent_start", () => {
		runInProgress = true;
		lastAssistantText = "";
	});

	pi.on("message_end", (event) => {
		const text = getAssistantText(event.message);
		if (text) lastAssistantText = text;
	});

	// omp の session_stop 相当: エージェントの実行が完全に落ち着いた時点で最終回答を検査する
	pi.on("agent_settled", (_event, ctx) => {
		if (!runInProgress) return;
		runInProgress = false;

		// この実行が書き直し要求後の再実行なら再検査しない (無限ループ防止)
		if (rewriteRequested) return;

		const text = lastAssistantText;
		if (!JAPANESE_TEXT.test(text)) return;

		const issues = findNoslopIssues(text, ctx.cwd);
		if (hasUnclosedFence(text)) issues.unshift("コードフェンスが閉じていない");
		if (issues.length === 0) return;

		rewriteRequested = true;
		void pi.sendUserMessage(
			`回答を確定しないでください。次の問題だけを修正し、内容を増やさずに回答全体を書き直してください。検出した問題:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
			{ deliverAs: "followUp" },
		);
	});
}
