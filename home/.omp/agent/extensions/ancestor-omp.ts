import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { getCapability, registerProvider } from "@oh-my-pi/pi-coding-agent/capability";

// cwd の親からホームの手前までの各階層を近い順にたどり、そこにある .omp（skills は .agents も）を読む。
// omp の native プロバイダーは skills をリポジトリのルートまで、それ以外を cwd の .omp だけで探すため、その外側を補う。
// 各階層では native と agents プロバイダーの load をその階層を cwd として呼び、project の項目だけを返す。
// 同じ名前の項目は、cwd の native、近い祖先、遠い祖先の順に優先される。
const PROVIDER_ID = "ancestor-omp";
const PRIORITY = 99;
const TARGETS: Record<string, { providers: string[]; markers: string[] }> = {
	skills: { providers: ["native", "agents"], markers: [".omp/skills", ".agents/skills"] },
	"slash-commands": { providers: ["native"], markers: [".omp"] },
	prompts: { providers: ["native"], markers: [".omp"] },
	rules: { providers: ["native"], markers: [".omp"] },
	tools: { providers: ["native"], markers: [".omp"] },
	mcps: { providers: ["native"], markers: [".omp"] },
};

function findAncestorDirs(cwd: string, markers: string[]): string[] {
	const home = resolve(homedir());
	const found: string[] = [];
	let current = dirname(resolve(cwd));
	while (current !== home) {
		if (markers.some((rel) => existsSync(resolve(current, rel)))) found.push(current);
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return found;
}

export default function (_pi: ExtensionAPI) {
	for (const [capabilityId, { providers, markers }] of Object.entries(TARGETS)) {
		const capability = getCapability(capabilityId);
		if (!capability || capability.providers.some((p) => p.id === PROVIDER_ID)) continue;
		const sources = capability.providers.filter((p) => providers.includes(p.id));
		registerProvider(capabilityId, {
			id: PROVIDER_ID,
			displayName: "Ancestor .omp",
			description: "Project config in .omp directories above the working directory",
			priority: PRIORITY,
			load: async (ctx) => {
				const items = [];
				const warnings = [];
				for (const dir of findAncestorDirs(ctx.cwd, markers)) {
					for (const source of sources) {
						const result = await source.load({ ...ctx, cwd: dir, repoRoot: dir });
						items.push(...result.items.filter((item) => item._source?.level === "project"));
						if (result.warnings) warnings.push(...result.warnings);
					}
				}
				return { items, warnings };
			},
		});
	}
}
