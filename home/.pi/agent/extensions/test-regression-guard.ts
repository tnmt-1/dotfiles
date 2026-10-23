/**
 * Test Regression Guard
 *
 * Python のファイルを変更したのに、実装前と実装後のテストの失敗一覧を比べないまま完了と報告するのを止める。
 * 特定のファイルのテストだけを実行して、既存のテストを壊したことに気づかなかったことが複数回あったため。
 *
 * - edit / write で .py を変更する直前に、そのリポジトリの .py の中身のハッシュ（変更前）を取る
 * - 応答を終える直前（agent_before_settle）に、いまのハッシュを取り、test_failures.sh の実行記録
 *   （/tmp/test-failures-runs/runs.tsv）と照らす
 *   - いまのハッシュで実行した記録（実装後）があるか
 *   - 変更前のハッシュで、同じコマンドを実行した記録（実装前）があるか
 *   - 実装後にだけある失敗がないか
 * - 満たさなければメッセージを差し込んで、もう1回応答させる。同じ変更に対しては MAX_CONTINUES 回まで。
 *   前回と同じ指摘になったら（失敗を見たうえで報告している）、続けさせずに指摘を表示して終える
 *
 * 時刻ではなくハッシュで照らすので、bash での変更、git checkout での巻き戻し、前のセッションの記録も正しく扱える。
 * shortcut: 変更したかどうかは edit / write でだけ見る。bash だけで .py を変えたセッションは検査しない。
 * shortcut: git のないリポジトリ（jj だけ）ではハッシュがいつも同じになり、照合が効かない。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

const RUNS_FILE = "/tmp/test-failures-runs/runs.tsv";
const SCRIPT = "~/.pi/agent/skills/python/scripts/test_failures.sh";
// test_failures.sh の code_hash と同じコマンドにする
const CODE_HASH = "git ls-files -z --cached --others --exclude-standard -- '*.py' | xargs -0 shasum 2>/dev/null | shasum | cut -d' ' -f1";
const MAX_CONTINUES = 2;
const MAX_LISTED = 10;
// Python のテストを実行できるリポジトリだけを対象にする
const PROJECT_MARKERS = ["manage.py", "src/manage.py", "pyproject.toml", "setup.cfg", "pytest.ini"];

export interface Run {
	start: number;
	end: number;
	root: string;
	codeHash: string;
	snapshot: string;
	command: string;
}

export type Verdict =
	| { ok: true; command: string; failures: number }
	| { ok: false; problem: string };

export function parseRuns(text: string): Run[] {
	return text
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => {
			const [start, end, root, codeHash, snapshot, command] = line.split("\t");
			return { start: Number(start), end: Number(end), root, codeHash, snapshot, command };
		});
}

/** 変更前と変更後のハッシュで実行記録を探し、失敗一覧を比べる。readSnapshot は失敗したテストIDの一覧を返す */
export function evaluate(runs: Run[], beforeHash: string, nowHash: string, readSnapshot: (path: string) => string[]): Verdict {
	const after = runs.filter((r) => r.codeHash === nowHash).at(-1);
	if (!after) {
		return { ok: false, problem: "いまのコードで test_failures.sh を実行した記録（実装後の失敗一覧）がありません。" };
	}
	const baselines = runs.filter((r) => r.codeHash === beforeHash);
	const before = baselines.filter((r) => r.command === after.command).at(-1);
	if (!before) {
		const other = baselines.at(-1);
		return {
			ok: false,
			problem: other
				? `実装前と実装後でテストのコマンドが違います。\n- 実装前: ${other.command}\n- 実装後: ${after.command}`
				: "変更前のコードで test_failures.sh を実行した記録（実装前の失敗一覧）がありません。",
		};
	}
	const baseline = new Set(readSnapshot(before.snapshot));
	const current = readSnapshot(after.snapshot);
	const added = current.filter((id) => !baseline.has(id));
	if (added.length) {
		const listed = added.slice(0, MAX_LISTED).map((id) => `- ${id}`).join("\n");
		const rest = added.length > MAX_LISTED ? `\n- ほか ${added.length - MAX_LISTED} 件` : "";
		return { ok: false, problem: `実装前にはなかった失敗が ${added.length} 件あります（コマンド: ${after.command}）。\n${listed}${rest}` };
	}
	return { ok: true, command: after.command, failures: current.length };
}

function repoRoot(dir: string): string | null {
	for (const [cmd, args] of [["git", ["rev-parse", "--show-toplevel"]], ["jj", ["root"]]] as const) {
		try {
			return execFileSync(cmd, [...args], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
		} catch {
			// 次の方法を試す
		}
	}
	return null;
}

function codeHash(root: string): string {
	return execFileSync("sh", ["-c", CODE_HASH], { cwd: root, encoding: "utf8" }).trim();
}

function readLines(path: string): string[] {
	return existsSync(path) ? readFileSync(path, "utf8").split("\n").filter((l) => l.trim()) : [];
}

function instructions(root: string, problem: string): string {
	return [
		`[test-regression-guard] ${root} の .py を変更しましたが、テストの前後比較が済んでいません。`,
		problem,
		"",
		"完了と報告する前に、python スキルの「検証と自己修復」の手順で比べてください。",
		`- 実装前と実装後に、同じコマンドで \`${SCRIPT} <出力ファイル> <テストコマンド>\` を実行する`,
		"- テストコマンドは AGENTS.md に従う。全体テストを実行してよいリポジトリでは、変更したファイルのテストだけに絞らない",
		"- 実装後にだけある失敗は、テストを弱めずに直す",
		"実装前の状態に戻せない、テストを実行できないなどの事情があるときは、比べられなかったことと理由を最終報告に書いてください。",
	].join("\n");
}

export default function (pi: ExtensionAPI) {
	const changes = new Map<string, { beforeHash: string; continues: number; lastProblem?: string; reportedProblem?: string }>();

	// 変更が書き込まれる前にハッシュを取るため、tool_result ではなく tool_call で見る
	pi.on("tool_call", (event, ctx) => {
		if (event.toolName !== "edit" && event.toolName !== "write") return;
		const path = (event.input as { path?: unknown }).path;
		if (typeof path !== "string" || !path.endsWith(".py")) return;
		const file = isAbsolute(path) ? path : resolve(ctx.cwd, path.replace(/^~(?=\/)/, process.env.HOME ?? "~"));
		const root = existsSync(dirname(file)) ? repoRoot(dirname(file)) : null;
		if (!root || !PROJECT_MARKERS.some((m) => existsSync(join(root, m)))) return;
		const entry = changes.get(root);
		if (entry) {
			entry.continues = 0;
			entry.lastProblem = undefined;
			entry.reportedProblem = undefined;
		} else {
			changes.set(root, { beforeHash: codeHash(root), continues: 0 });
		}
	});

	pi.on("agent_before_settle", (event) => {
		if (event.outcome !== "completed" || changes.size === 0) return;
		const runs = parseRuns(existsSync(RUNS_FILE) ? readFileSync(RUNS_FILE, "utf8") : "");
		const messages: string[] = [];
		let retry = false;
		for (const [root, entry] of changes) {
			const nowHash = codeHash(root);
			if (nowHash === entry.beforeHash) {
				// 変更が失敗したか、元に戻した
				changes.delete(root);
				continue;
			}
			const verdict = evaluate(runs.filter((r) => r.root === root), entry.beforeHash, nowHash, readLines);
			if (verdict.ok) {
				messages.push(`[test-regression-guard] ${root}: 実装前にはなかった失敗は0件でした（失敗 ${verdict.failures} 件、コマンド: ${verdict.command}）。`);
				// 次の変更は、いまのコードを実装前として比べる
				entry.beforeHash = nowHash;
				entry.continues = 0;
				entry.lastProblem = undefined;
			} else if (entry.continues < MAX_CONTINUES && verdict.problem !== entry.lastProblem) {
				entry.continues++;
				entry.lastProblem = verdict.problem;
				retry = true;
				messages.push(instructions(root, verdict.problem));
			} else if (verdict.problem !== entry.reportedProblem) {
				// 同じ指摘は、次の変更まで1回だけ表示する
				messages.push(`[test-regression-guard] ${root}: テストの前後比較が済まないまま終わりました。\n${verdict.problem}`);
				entry.reportedProblem = verdict.problem;
			}
		}
		if (!messages.length) return;
		return {
			entries: messages.map((content) => ({ type: "custom_message" as const, customType: "test-regression-guard", content, display: true })),
			continue: retry,
		};
	});
}
