import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { findAncestorSkills, linkSkills } from "./ancestor-skills";

let root: string;
let home: string;
beforeEach(() => {
	root = mkdtempSync(path.join(os.tmpdir(), "ancestor-skills-"));
	home = path.join(root, "home");
});
afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

function skill(dir: string, name: string) {
	const skillDir = path.join(dir, ".claude", "skills", name);
	mkdirSync(skillDir, { recursive: true });
	writeFileSync(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`);
	return skillDir;
}

describe("findAncestorSkills", () => {
	test("作業ディレクトリの親からホームの手前までのスキルを集め、同じ名前は近い祖先を使う", () => {
		const cwd = path.join(home, "projects", "cdm", "niwashi");
		const near = skill(path.join(home, "projects", "cdm"), "nihongo");
		const far = skill(path.join(home, "projects"), "kosshi");
		skill(path.join(home, "projects"), "nihongo");
		skill(home, "home-only");
		mkdirSync(cwd, { recursive: true });

		expect(findAncestorSkills(cwd, home)).toEqual(
			new Map([
				["nihongo", near],
				["kosshi", far],
			]),
		);
	});

	test("作業ディレクトリにある名前と、ディレクトリでない項目は除く", () => {
		const cwd = path.join(home, "projects", "app");
		skill(cwd, "nihongo");
		skill(path.join(home, "projects"), "nihongo");
		writeFileSync(path.join(home, "projects", ".claude", "skills", ".DS_Store"), "");

		expect(findAncestorSkills(cwd, home)).toEqual(new Map());
	});

	test("ホームの外では、ルートまでたどる", () => {
		const cwd = path.join(root, "outside", "app");
		const found = skill(path.join(root, "outside"), "zukai");
		mkdirSync(cwd, { recursive: true });

		expect(findAncestorSkills(cwd, home).get("zukai")).toBe(found);
	});
});

describe("linkSkills", () => {
	test("作業ディレクトリごとのディレクトリを作り直し、.claude/skillsにシンボリックリンクを置く", () => {
		const base = path.join(root, "tmp");
		const first = skill(path.join(root, "a"), "old");
		const dirA = linkSkills("/work/a", new Map([["old", first]]), base);
		const second = skill(path.join(root, "b"), "nihongo");
		const dirAgain = linkSkills("/work/a", new Map([["nihongo", second]]), base);
		const dirB = linkSkills("/work/b", new Map([["nihongo", second]]), base);

		expect(dirAgain).toBe(dirA);
		expect(dirB).not.toBe(dirA);
		const skillsDir = path.join(dirA, ".claude", "skills");
		expect(readdirSync(skillsDir)).toEqual(["nihongo"]);
		expect(readlinkSync(path.join(skillsDir, "nihongo"))).toBe(second);
	});
});
