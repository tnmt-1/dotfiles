/**
 * RTK Rewrite
 *
 * bash ツールの実行前に `rtk rewrite` でコマンドを書き換える。
 * Claude Code 側の PreToolUse フック（rtk hook claude）と同じ処理。
 * omp は handler が返した input で実行時の入力を置き換える。
 */

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { execFileSync } from "node:child_process";

export default function rtkRewrite(pi: ExtensionAPI) {
	pi.on("tool_call", (event) => {
		if (event.toolName !== "bash") return;
		const command = event.input.command as string;
		let rewritten: string;
		try {
			rewritten = execFileSync("rtk", ["rewrite", command], { encoding: "utf8" }).trim();
		} catch (error) {
			// 終了コード3は書き換えあり（承認はホストに任せる）。1は書き換えなし、2はdeny
			const { status, stdout } = error as { status?: number; stdout?: string };
			if (status !== 3 || !stdout) return;
			rewritten = stdout.trim();
		}
		if (!rewritten || rewritten === command) return;
		return { input: { ...event.input, command: rewritten } };
	});
}
