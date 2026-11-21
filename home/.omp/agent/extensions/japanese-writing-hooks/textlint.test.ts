import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changedLinesFromToolResult, lintChangedFile } from "./textlint";

// ja-no-redundant-expressionが「する事ができる」を冗長な表現として指摘する
const REDUNDANT = "設定を確認する事ができる。";
const REDUNDANT_RULE = "ja-technical-writing/ja-no-redundant-expression";

const dirs: string[] = [];
function makeDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "jwh-textlint-"));
	dirs.push(dir);
	return dir;
}
function writeFixture(name: string, content: string): { dir: string; path: string } {
	const dir = makeDir();
	const path = join(dir, name);
	writeFileSync(path, content);
	return { dir, path };
}

afterAll(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe("changedLinesFromToolResult", () => {
	test("editの差分から追加・変更した行を取り出す", () => {
		const details = { path: "/x/a.md", diff: " 1|a\n-2|b\n+2|c\n+3|d\n 4|e" };
		expect(changedLinesFromToolResult("edit", details, {}, "/x")).toEqual(new Map([["/x/a.md", new Set([2, 3])]]));
	});

	test("複数ファイルのeditはファイルごとに取り出す", () => {
		const details = {
			perFileResults: [
				{ path: "/x/a.md", diff: "+1|a" },
				{ path: "/x/b.md", diff: "-5|b" },
			],
		};
		expect(changedLinesFromToolResult("edit", details, {}, "/x")).toEqual(
			new Map([
				["/x/a.md", new Set([1])],
				["/x/b.md", new Set()],
			]),
		);
	});

	test("writeはファイル全体を対象にする", () => {
		expect(changedLinesFromToolResult("write", { resolvedPath: "/x/a.md" }, { path: "a.md" }, "/x")).toEqual(
			new Map([["/x/a.md", "all"]]),
		);
	});

	test("内部URLへの書き込みは対象にしない", () => {
		expect(changedLinesFromToolResult("write", {}, { path: "local://memo.md" }, "/x")).toEqual(new Map());
	});
});

describe("lintChangedFile", () => {
	test("Markdownは変更した行の指摘だけを返す", async () => {
		const { dir, path } = writeFixture("a.md", `${REDUNDANT}\n\n${REDUNDANT}\n`);
		const issues = await lintChangedFile(path, new Set([3]), dir);
		expect(issues.map((issue) => [issue.ruleId, issue.line])).toEqual([[REDUNDANT_RULE, 3]]);
	});

	test("Markdownは変更した行だけを検査し、ほかの行の文体と比べない", async () => {
		// ファイル全体ではである調が多数なので、全体を検査するとですます調の3行目が指摘される
		const { dir, path } = writeFixture("a.md", "これは設定である。\n\nこれは結果です。\n\nこれは値である。\n\nこれは画面である。\n");
		expect(await lintChangedFile(path, new Set([3]), dir)).toEqual([]);
	});

	test("Markdownのコードフェンスは空行を含んでも1つの段落として扱う", async () => {
		const { dir, path } = writeFixture("a.md", `\`\`\`\nconst a = 1;\n\n${REDUNDANT}\n\`\`\`\n`);
		expect(await lintChangedFile(path, new Set([4]), dir)).toEqual([]);
	});

	test("HTMLは本文を検査し、scriptの中は検査しない", async () => {
		const { dir, path } = writeFixture(
			"a.html",
			`<html><body>\n<p>${REDUNDANT}</p>\n<script>\n// ${REDUNDANT}\n</script>\n</body></html>\n`,
		);
		const issues = await lintChangedFile(path, "all", dir);
		expect(issues.map((issue) => issue.line)).toEqual([2]);
	});

	test("コードはコメントを検査し、文字列リテラルと句点のないコメントは指摘しない", async () => {
		const { dir, path } = writeFixture(
			"a.ts",
			`// ${REDUNDANT}\nconst s = "${REDUNDANT}";\n// 設定を読み込む\nexport { s };\n`,
		);
		const issues = await lintChangedFile(path, "all", dir);
		expect(issues.map((issue) => [issue.ruleId, issue.line])).toEqual([[REDUNDANT_RULE, 1]]);
	});

	test("Pythonは#のコメントとdocstringを元の行番号で指摘する", async () => {
		const { dir, path } = writeFixture(
			"a.py",
			[
				`"""${REDUNDANT}"""`,
				"",
				"",
				`# ${REDUNDANT}`,
				"def f():",
				'    """関数の説明。',
				"",
				`    ${REDUNDANT}`,
				'    """',
				`    return "${REDUNDANT}"`,
				"",
			].join("\n"),
		);
		const issues = await lintChangedFile(path, "all", dir);
		expect(issues.map((issue) => issue.line).sort((a, b) => a - b)).toEqual([1, 4, 8]);
	});

	test("docstringも変更した行の指摘だけを返す", async () => {
		const { dir, path } = writeFixture("a.py", `"""${REDUNDANT}\n\n${REDUNDANT}\n"""\n`);
		const issues = await lintChangedFile(path, new Set([3]), dir);
		expect(issues.map((issue) => issue.line)).toEqual([3]);
	});

	test("docstringは1つずつ検査し、別のdocstringとの文体の違いを指摘しない", async () => {
		const { dir, path } = writeFixture(
			"a.py",
			'"""設定を読み込みます。"""\n\n\ndef f():\n    """設定を読み込む。"""\n',
		);
		expect(await lintChangedFile(path, "all", dir)).toEqual([]);
	});

	test("コメント用プラグインの対応言語にないファイルは検査しない", async () => {
		const { dir, path } = writeFixture("a.rb", `# ${REDUNDANT}\n`);
		expect(await lintChangedFile(path, "all", dir)).toEqual([]);
	});

	test("プロジェクトに.textlintrcがあればその設定を使う", async () => {
		// 自前の設定では無効にしているJTFの4.2.7(コロン)を、プロジェクトの設定では有効にする
		const dir = makeDir();
		symlinkSync(join(import.meta.dir, "node_modules"), join(dir, "node_modules"));
		writeFileSync(join(dir, ".textlintrc.json"), JSON.stringify({ rules: { "preset-jtf-style": true } }));
		const path = join(dir, "a.md");
		writeFileSync(path, "設定は次のとおりです: 有効。\n");
		const colonRule = "jtf-style/4.2.7.コロン(：)";
		expect((await lintChangedFile(path, "all", dir)).map((issue) => issue.ruleId)).toContain(colonRule);
		expect((await lintChangedFile(path, "all", makeDir())).map((issue) => issue.ruleId)).not.toContain(colonRule);
	});
});
