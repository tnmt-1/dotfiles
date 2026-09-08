/**
 * RTK Rewrite (pi)
 *
 * bash ツールの実行前に `rtk rewrite` でコマンドを書き換える。
 * Claude Code 側の PreToolUse フック（~/.claude/hooks/rtk-rewrite.sh）と同じ処理。
 * pi は event.input をそのまま実行に使うため、直接書き換える。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFileSync } from "node:child_process";

export default function rtkRewrite(pi: ExtensionAPI) {
	pi.on("tool_call", (event) => {
		if (event.toolName !== "bash") return;
		const command = event.input.command as string;
		let rewritten: string;
		try {
			rewritten = execFileSync("rtk", ["rewrite", command], { encoding: "utf8" }).trim();
		} catch {
			return; // 書き換え対象外のとき、rtk rewrite は終了コード1を返す
		}
		if (!rewritten || rewritten === command) return;
		event.input.command = rewritten;
	});
}
