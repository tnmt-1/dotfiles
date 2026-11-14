import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";

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

const JAPANESE_TEXT = /[\u3040-\u30ff\u3400-\u9fff]/u;

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
	pi.on("before_agent_start", (event) => {
		const policy = buildNgWordsPolicy(loadNgWords());
		if (!policy) return;

		return {
			systemPrompt: [...event.systemPrompt, policy],
		};
	});

	pi.on("session_stop", (event, ctx) => {
		if (event.stop_hook_active) return;

		const text = getAssistantText(event.last_assistant_message);
		if (!JAPANESE_TEXT.test(text)) return;

		const issues = findNoslopIssues(text, ctx.cwd);
		if (hasUnclosedFence(text)) issues.unshift("コードフェンスが閉じていない");
		if (issues.length === 0) return;

		return {
			continue: true,
			additionalContext: `回答を確定しないでください。次の問題だけを修正し、内容を増やさずに回答全体を書き直してください。検出した問題:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
		};
	});

	pi.on("tool_result", (event, ctx) => {
		if (event.isError || !WRITE_TOOLS[event.toolName]) return;

		const { path, paths } = event.input as { path?: unknown; paths?: unknown };
		const reports = (Array.isArray(paths) ? paths : [path])
			.filter((target): target is string => typeof target === "string" && !target.includes("://"))
			.flatMap((target) => {
				const report = runNoslop(["hook", "file", resolve(ctx.cwd, target)], ctx.cwd)?.trim();
				return report ? [report] : [];
			});
		if (reports.length === 0) return;

		return { additionalContext: reports.join("\n\n") };
	});
}
