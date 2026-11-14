/**
 * kimeta (omp)
 *
 * 決定を1件ずつ記録するCLI（~/.local/bin/kimeta）を、会話から使えるようにする。
 * decision_add で記録し、decision_search で、状態と置き換えの向きつきで探す。
 * 記録の形式と決まりはCLIが持つ。この拡張機能は引数を組み立ててCLIを呼ぶだけにする。
 */

import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

const CLI = process.env.KIMETA_BIN ?? join(homedir(), ".local", "bin", "kimeta");

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }], details: {} });

function run(args: string[]) {
	const result = Bun.spawnSync([CLI, ...args], { stdout: "pipe", stderr: "pipe" });
	const output = result.stdout.toString().trim();
	const error = result.stderr.toString().trim();
	return { ok: result.exitCode === 0, output: [output, error].filter(Boolean).join("\n") };
}

export default function kimetaTools(pi: ExtensionAPI) {
	const { Type } = pi.typebox;

	pi.registerTool({
		name: "decision_add",
		label: "Record Decision",
		loadMode: "essential",
		description: [
			"Record one decision in the decision ledger. Call it in the same turn the user decides something, before doing the work that depends on it.",
			"One record holds exactly one decision, written as one line.",
			"status is proposed by default. decided requires the user's own words in quote, copied verbatim, or a citation URL. Never paraphrase a quote and never record your own proposal as decided.",
			"Returns the new ID. Cite that ID in the spec or the report it belongs to.",
		].join("\n"),
		parameters: Type.Object({
			decision: Type.String({ description: "One line, one decision. Do not change it later; a change is a new record." }),
			quote: Type.Optional(Type.String({ description: "The user's words, copied verbatim. Required for status=decided unless cite is given." })),
			cite: Type.Optional(Type.String({ description: "URL of the evidence (Redmine, Notion, Slack, a law or a spec)." })),
			status: Type.Optional(
				Type.Union([Type.Literal("proposed"), Type.Literal("decided"), Type.Literal("withdrawn")], {
					description: "Defaults to proposed. Use decided only when the user has decided it.",
				}),
			),
			scope: Type.Optional(Type.String({ description: "Repository name. Defaults to the repository of the working directory, else general." })),
			topics: Type.Optional(Type.Array(Type.String({ description: "Topic tags, e.g. password-lock" }))),
			tickets: Type.Optional(Type.Array(Type.String({ description: "Related tickets, e.g. #118419" }))),
		}),
		async execute(_toolCallId, params) {
			const args = ["add", "--decision", params.decision];
			if (params.quote) args.push("--quote", params.quote);
			if (params.cite) args.push("--cite", params.cite);
			if (params.status) args.push("--status", params.status);
			if (params.scope) args.push("--scope", params.scope);
			for (const topic of params.topics ?? []) args.push("--topic", topic);
			for (const ticket of params.tickets ?? []) args.push("--ticket", ticket);
			const result = run(args);
			if (!result.ok) return text(`記録できませんでした。\n${result.output}`);
			return text(`${result.output}\n\nこのIDを使う: ${result.output.split(" ")[0]}`);
		},
	});

	pi.registerTool({
		name: "decision_search",
		label: "Search Decisions",
		loadMode: "essential",
		description: [
			"Search the decision ledger. Run it before changing a spec, a design document, or behavior that may already be decided, and before asking the user something the ledger already answers.",
			"Returns one line per record: ID, status (decided with its date, proposed, or withdrawn with the ID that replaced it), the decision, and the scope. A withdrawn record is not current.",
			"Pass id to read one record with its basis quotes, citations, and replacement links.",
		].join("\n"),
		parameters: Type.Object({
			query: Type.Optional(Type.String({ description: "What you are looking for, as words or as a sentence. Results are ranked by relevance." })),
			id: Type.Optional(Type.String({ description: "Read one record by ID, e.g. D-0379" })),
			status: Type.Optional(Type.Union([Type.Literal("proposed"), Type.Literal("decided"), Type.Literal("withdrawn")])),
			scope: Type.Optional(Type.String()),
			limit: Type.Optional(Type.Number({ description: "Number of results (default: all)" })),
		}),
		async execute(_toolCallId, params) {
			const args = params.id ? ["show", params.id] : ["search", params.query ?? ""];
			if (params.status) args.push("--status", params.status);
			if (params.scope) args.push("--scope", params.scope);
			if (params.limit !== undefined) args.push("--limit", String(params.limit));
			const result = run(args);
			if (!result.ok) return text(`検索できませんでした。\n${result.output}`);
			return text(result.output);
		},
	});
}
