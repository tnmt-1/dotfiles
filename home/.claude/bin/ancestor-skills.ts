#!/usr/bin/env bun
/**
 * 祖先のディレクトリの .claude/skills を、Claude Code に --add-dir で渡せる形に集める。
 * ompの拡張 ancestor-omp.ts のうち、スキルの部分をClaude Code向けにしたもの。
 *
 *   bun ancestor-skills.ts <作業ディレクトリ>
 *
 * 作業ディレクトリの親からホームの手前までをたどり、<dir>/.claude/skills/<名前> を集める。
 * 同じ名前は近い祖先のほうを使い、作業ディレクトリの .claude/skills にある名前は除く。
 * 集めたスキルへのシンボリックリンクを $TMPDIR/claude-ancestor-skills/<作業ディレクトリのハッシュ>/.claude/skills に置き、
 * そのディレクトリのパスを出力する。祖先のスキルがなければ何も出力しない。
 * Claude Codeは --add-dir で渡したディレクトリの .claude/skills を読む。
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import * as path from "node:path";

function skillDirs(dir: string): string[] {
	const skillsDir = path.join(dir, ".claude", "skills");
	if (!existsSync(skillsDir)) return [];
	return readdirSync(skillsDir)
		.filter((name) => !name.startsWith("."))
		.map((name) => path.join(skillsDir, name))
		.filter((skillDir) => {
			try {
				return statSync(skillDir).isDirectory();
			} catch {
				return false;
			}
		});
}

/** 祖先のスキルを、名前からスキルのディレクトリへの対応として返す。 */
export function findAncestorSkills(cwd: string, home: string): Map<string, string> {
	const own = new Set(skillDirs(cwd).map((skillDir) => path.basename(skillDir)));
	const found = new Map<string, string>();
	const stop = path.resolve(home);
	let current = path.dirname(path.resolve(cwd));
	while (current !== stop) {
		for (const skillDir of skillDirs(current)) {
			const name = path.basename(skillDir);
			if (!own.has(name) && !found.has(name)) found.set(name, skillDir);
		}
		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return found;
}

/** 作業ディレクトリごとのディレクトリを作り直し、その .claude/skills にスキルへのシンボリックリンクを置く。 */
export function linkSkills(cwd: string, skills: Map<string, string>, base: string): string {
	const dir = path.join(base, createHash("sha256").update(path.resolve(cwd)).digest("hex").slice(0, 16));
	const skillsDir = path.join(dir, ".claude", "skills");
	rmSync(skillsDir, { recursive: true, force: true });
	mkdirSync(skillsDir, { recursive: true });
	for (const [name, target] of skills) symlinkSync(target, path.join(skillsDir, name));
	return dir;
}

if (import.meta.main) {
	const cwd = process.argv[2] ?? process.cwd();
	const skills = findAncestorSkills(cwd, homedir());
	if (skills.size > 0) console.log(linkSkills(cwd, skills, path.join(tmpdir(), "claude-ancestor-skills")));
}
