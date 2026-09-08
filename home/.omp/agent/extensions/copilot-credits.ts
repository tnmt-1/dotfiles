/**
 * Copilot Credits (oh-my-pi)
 *
 * github-copilot選択時に、今月のpremium_interactions消費数を表示する。
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

const PROVIDER = "github-copilot";
const STATUS_KEY = "zz-copilot-credits";
const execFileAsync = promisify(execFile);

async function readCreditsUsed(): Promise<number | undefined> {
	const { stdout } = await execFileAsync(
		"gh",
		["api", "copilot_internal/user", "--jq", ".quota_snapshots.premium_interactions.credits_used"],
		{ encoding: "utf8", timeout: 10_000 },
	);
	const used = Number(stdout.trim());
	return Number.isFinite(used) ? used : undefined;
}

export default function copilotCredits(pi: ExtensionAPI) {
	const update = async (ctx: ExtensionContext) => {
		if (ctx.model?.provider !== PROVIDER) {
			ctx.ui.setStatus(STATUS_KEY, undefined);
			return;
		}

		try {
			const used = await readCreditsUsed();
			ctx.ui.setStatus(STATUS_KEY, used === undefined ? undefined : `\uf09b ${used} credits`);
		} catch {
			ctx.ui.setStatus(STATUS_KEY, undefined);
		}
	};

	pi.on("session_start", (_event, ctx) => update(ctx));
	pi.on("session_switch", (_event, ctx) => update(ctx));
	pi.on("agent_start", (_event, ctx) => update(ctx));
	pi.on("agent_end", (_event, ctx) => update(ctx));
}
