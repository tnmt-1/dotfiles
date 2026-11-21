import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

// 回答とMarkdown・HTMLは文章用、コードのコメントとdocstringはコード用の設定で検査する(D-0514, D-0516)
// 自前の設定ではnode_modulesDirを渡さない。渡すとパス指定で解決するため、mainを持たずexportsだけの
// @cffnpwr/textlint-plugin-commentsが見つからない
const PROSE_CONFIG = { path: join(import.meta.dir, "textlintrc.prose.json") };
const CODE_CONFIG = { path: join(import.meta.dir, "textlintrc.code.json") };
const RUNNER = join(import.meta.dir, "textlint-runner.ts");

const PROSE_EXTENSIONS: Record<string, true> = { ".md": true, ".markdown": true, ".html": true, ".htm": true };
// @cffnpwr/textlint-plugin-commentsが対応する拡張子。対応外の言語は検査しない(D-0517)
const CODE_EXTENSIONS: Record<string, true> = {
	".go": true,
	".ts": true,
	".mts": true,
	".cts": true,
	".tsx": true,
	".js": true,
	".mjs": true,
	".cjs": true,
	".jsx": true,
	".rs": true,
	".py": true,
	".pyi": true,
	".jsonc": true,
	".json": true,
	".yaml": true,
	".yml": true,
	".toml": true,
	".sh": true,
	".bash": true,
};
const PYTHON_EXTENSIONS: Record<string, true> = { ".py": true, ".pyi": true };
const MARKDOWN_EXTENSIONS: Record<string, true> = { ".md": true, ".markdown": true };

const PROJECT_CONFIG_NAMES = [
	".textlintrc",
	".textlintrc.json",
	".textlintrc.yml",
	".textlintrc.yaml",
	".textlintrc.js",
	".textlintrc.cjs",
];

export interface LintIssue {
	line: number;
	ruleId: string;
	message: string;
}

export type ChangedLines = Set<number> | "all";

interface LintConfig {
	path: string;
	nodeModules?: string;
}

interface LintItem {
	text: string;
	filePath: string;
}

// itemsと同じ順で指摘を返す。設定を読み込めないなど、textlintが失敗したときは指摘なしとして扱う
async function lintTexts(items: LintItem[], config: LintConfig): Promise<LintIssue[][]> {
	const runner = Bun.spawn(["bun", RUNNER], { stdin: "pipe", stdout: "pipe", stderr: "ignore" });
	runner.stdin.write(JSON.stringify({ config: config.path, nodeModules: config.nodeModules, items }));
	runner.stdin.end();
	const [stdout, exitCode] = await Promise.all([new Response(runner.stdout).text(), runner.exited]);
	if (exitCode !== 0) return items.map(() => []);
	return JSON.parse(stdout) as LintIssue[][];
}

const DOCSTRING_SCRIPT = `
import ast, json, sys
src = open(sys.argv[1], encoding="utf-8").read()
out = []
try:
    tree = ast.parse(src)
except SyntaxError:
    tree = None
for node in ast.walk(tree) if tree else []:
    if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.body:
        expr = node.body[0]
        if isinstance(expr, ast.Expr) and isinstance(expr.value, ast.Constant) and isinstance(expr.value.value, str):
            out.append({"line": expr.value.lineno, "source": ast.get_source_segment(src, expr.value)})
print(json.dumps(out, ensure_ascii=False))
`;

interface Docstring {
	line: number;
	text: string;
}

// docstringのソースから引用符を外す。行は削らないので、本文のn行目は元のファイルのline+n行目になる
function extractPythonDocstrings(path: string): Docstring[] {
	const result = spawnSync("python3", ["-c", DOCSTRING_SCRIPT, path], { encoding: "utf8", timeout: 10_000 });
	if (result.error || result.status !== 0) return [];

	return (JSON.parse(result.stdout) as { line: number; source: string | null }[]).flatMap(({ line, source }) => {
		const quote = source?.match(/^[rRuUbBfF]*("""|'''|"|')/u);
		if (!source || !quote) return [];
		const body = source.slice(quote[0].length, source.length - quote[1].length);
		const text = body
			.split("\n")
			.map((bodyLine) => bodyLine.trimStart())
			.join("\n");
		return [{ line, text }];
	});
}

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/u;

// 変更した行だけを残し、ほかの行は空行にして行番号を保つ。変更した行がコードフェンスの中にあれば、フェンス全体を残す(D-0521)
function keepChangedLines(content: string, changed: Set<number>): string {
	const lines = content.split("\n");
	const kept = lines.map((_, index) => changed.has(index + 1));
	let fenceStart: number | undefined;
	let fence = "";

	lines.forEach((line, index) => {
		const match = line.match(FENCE);
		if (fenceStart === undefined) {
			if (match) {
				fenceStart = index;
				fence = match[1];
			}
		} else if (match && match[1][0] === fence[0] && match[1].length >= fence.length && match[2].trim() === "") {
			if (kept.slice(fenceStart, index + 1).includes(true)) kept.fill(true, fenceStart, index + 1);
			fenceStart = undefined;
		}
	});

	return lines.map((line, index) => (kept[index] ? line : "")).join("\n");
}

export async function lintChangedFile(path: string, changed: ChangedLines, cwd: string): Promise<LintIssue[]> {
	const extension = extname(path).toLowerCase();
	const ownConfig = PROSE_EXTENSIONS[extension] ? PROSE_CONFIG : CODE_EXTENSIONS[extension] ? CODE_CONFIG : undefined;
	if (!ownConfig || (changed !== "all" && changed.size === 0)) return [];

	const projectConfig = PROJECT_CONFIG_NAMES.map((name) => join(cwd, name)).find((path) => existsSync(path));
	const config: LintConfig = projectConfig ? { path: projectConfig, nodeModules: join(cwd, "node_modules") } : ownConfig;

	let content: string;
	try {
		content = readFileSync(path, "utf8");
	} catch {
		return [];
	}

	// docstringはコメント用プラグインの対象外なので、取り出して1つずつ検査する(D-0513)。変更した行を含むものだけを検査する
	const docstrings = (PYTHON_EXTENSIONS[extension] ? extractPythonDocstrings(path) : []).filter(
		(docstring) =>
			changed === "all" ||
			docstring.text.split("\n").some((_, offset) => changed.has(docstring.line + offset)),
	);
	// Markdownのeditでファイル全体を検査すると、大きなファイルで数十秒かかるので、変更した行だけを検査する(D-0521)
	const text = changed !== "all" && MARKDOWN_EXTENSIONS[extension] ? keepChangedLines(content, changed) : content;
	const [fileIssues, ...docstringIssues] = await lintTexts(
		[{ text, filePath: path }, ...docstrings.map((docstring) => ({ text: docstring.text, filePath: "docstring.txt" }))],
		config,
	);
	const issues = [
		...fileIssues,
		...docstringIssues.flatMap((docIssues, index) =>
			docIssues.map((issue) => ({ ...issue, line: docstrings[index].line + issue.line - 1 })),
		),
	];

	return changed === "all" ? issues : issues.filter((issue) => changed.has(issue.line));
}

const ADDED_LINE = /^\+(\d+)\|/u;

function addedLines(diff: unknown): Set<number> {
	const lines = new Set<number>();
	if (typeof diff !== "string") return lines;
	for (const diffLine of diff.split("\n")) {
		const match = diffLine.match(ADDED_LINE);
		if (match) lines.add(Number(match[1]));
	}
	return lines;
}

interface EditFileResult {
	path?: unknown;
	diff?: unknown;
}

// write/editの結果から、書き換えたファイルと行を取り出す。writeはファイル全体を対象にする
export function changedLinesFromToolResult(
	toolName: string,
	details: unknown,
	input: unknown,
	cwd: string,
): Map<string, ChangedLines> {
	const changed = new Map<string, ChangedLines>();
	const detail = (details ?? {}) as EditFileResult & { perFileResults?: EditFileResult[]; resolvedPath?: unknown };

	if (toolName === "write") {
		const inputPath = (input as { path?: unknown } | undefined)?.path;
		const path =
			typeof detail.resolvedPath === "string"
				? detail.resolvedPath
				: typeof inputPath === "string" && !inputPath.includes("://")
					? resolve(cwd, inputPath)
					: undefined;
		if (path) changed.set(path, "all");
		return changed;
	}

	if (toolName === "edit") {
		for (const file of detail.perFileResults ?? [detail]) {
			if (typeof file.path === "string") changed.set(file.path, addedLines(file.diff));
		}
	}
	return changed;
}
