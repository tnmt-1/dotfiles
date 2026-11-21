/**
 * Copilot Credits (pi)
 *
 * モデルプロバイダーが github-copilot のとき、ステータスバーに
 * 今月の消費クレジット（premium_interactions.credits_used）を表示する。
 * 取得元は VS Code 拡張と同じ非公開API api.github.com/copilot_internal/user。
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const PROVIDER = "github-copilot";
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
			ctx.ui.setStatus("zz-copilot-credits", undefined);
			return;
		}
		try {
			const used = await readCreditsUsed();
			ctx.ui.setStatus("zz-copilot-credits", used === undefined ? undefined : `\uf09b ${used} credits`);
		} catch {
			ctx.ui.setStatus("zz-copilot-credits", undefined);
		}
	};

	pi.on("session_start", (_e, ctx) => update(ctx));
	pi.on("model_select", (_e, ctx) => update(ctx));
	pi.on("agent_end", (_e, ctx) => update(ctx));
}
