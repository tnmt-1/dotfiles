import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPromptContext, changedLinesFromHookInput, mergePostToolContext, textlintReport } from "./japanese-writing-hook";

const dirs: string[] = [];
afterAll(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe("changedLinesFromHookInput", () => {
	test("Editは、structuredPatchの追加した行を新しいファイルの行番号で取り出す", () => {
		const input = {
			tool_name: "Edit",
			tool_input: { file_path: "/x/a.md" },
			tool_response: {
				filePath: "/x/a.md",
				structuredPatch: [
					{ oldStart: 3, newStart: 3, lines: [" a", "-b", "+c", "+d", " e"] },
					{ oldStart: 20, newStart: 21, lines: [" f", "+g"] },
				],
			},
		};
		expect(changedLinesFromHookInput(input)).toEqual(new Map([["/x/a.md", new Set([4, 5, 22])]]));
	});

	test("Writeはファイル全体を対象にし、structuredPatchのないEditとほかのツールは対象にしない", () => {
		expect(changedLinesFromHookInput({ tool_name: "Write", tool_input: { file_path: "/x/a.md" } })).toEqual(
			new Map([["/x/a.md", "all"]]),
		);
		expect(changedLinesFromHookInput({ tool_name: "Edit", tool_input: { file_path: "/x/a.md" }, tool_response: {} })).toEqual(
			new Map(),
		);
		expect(changedLinesFromHookInput({ tool_name: "NotebookEdit", tool_input: { notebook_path: "/x/a.ipynb" } })).toEqual(
			new Map(),
		);
	});
});

describe("textlintReport", () => {
	test("書き換えた行の指摘だけを、ファイルと行番号つきで返す", async () => {
		const dir = mkdtempSync(join(tmpdir(), "jwh-claude-"));
		dirs.push(dir);
		const path = join(dir, "a.md");
		writeFileSync(path, "# 見出し\n\n設定を確認する事ができる。\n\n手順を確認する事ができる。\n");

		const report = await textlintReport(new Map([[path, new Set([5])]]), dir);

		expect(report).toStartWith("textlintの指摘（今回書き換えた行）:\n");
		expect(report).toContain(`- ${path}:5 ja-technical-writing/ja-no-redundant-expression:`);
		expect(report).not.toContain(`${path}:3 `);
	});
});

describe("mergePostToolContext", () => {
	const noslop = JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "noslopの指摘" } });

	test("noslopとtextlintの指摘を、1つのadditionalContextにまとめる", () => {
		expect(JSON.parse(mergePostToolContext(noslop, "textlintの指摘") ?? "")).toEqual({
			hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "noslopの指摘\n\ntextlintの指摘" },
		});
	});

	test("片方だけならその指摘を返し、どちらもなければ何も返さない", () => {
		expect(JSON.parse(mergePostToolContext(undefined, "textlintの指摘") ?? "").hookSpecificOutput.additionalContext).toBe(
			"textlintの指摘",
		);
		expect(mergePostToolContext(noslop, undefined)).toBe(noslop);
		expect(mergePostToolContext(" \n", undefined)).toBeUndefined();
	});
});

describe("buildPromptContext", () => {
	test("直訳造語の一覧のあとに、textlintの方針を加える", () => {
		const context = buildPromptContext("## 直訳造語\n");
		expect(context).toStartWith("## 直訳造語\n\n## 日本語の表記(textlintで検査する)");
		expect(buildPromptContext(undefined)).toStartWith("## 日本語の表記(textlintで検査する)");
	});
});
