/**
 * Session Record (pi)
 *
 * セッション終了時（session_shutdown）に、セッションのメタデータを
 * Obsidian vault（~/Documents/chiraura/sessions/）へ記録する。
 *
 * Claude Code 側の SessionEnd フック（~/bin/record-claude-session.sh）と
 * oh-my-pi 側（~/.omp/agent/extensions/session-record.ts）と同じフォーマットで出力する。
 * トランスクリプト本体は読まない。パスと終了時刻だけを控えて即終了する
 * （重い蒸留処理は別の仕組みで後から回す）。
 *
 * 出力例:
 *   ~/Documents/chiraura/sessions/2026-08-21T06-30-00_pi_<sessionId>.md
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { mkdirSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const OUT_DIR = path.join(os.homedir(), "Documents", "chiraura", "sessions");

export default function sessionRecord(pi: ExtensionAPI) {
	pi.on("session_shutdown", (event, ctx) => {
		try {
			const sm = ctx.sessionManager;
			const sessionId = sm.getSessionId();
			const transcript = sm.getSessionFile() ?? "";
			const cwd = sm.getCwd();
			const endedAt = new Date().toISOString();

			const stamp = endedAt.replace(/[:.]/g, "-").replace("Z", "");
			const filePath = path.join(OUT_DIR, `${stamp}_pi_${sessionId}.md`);

			const content = [
				"---",
				"type: ai-session",
				"host: pi",
				`sessionId: ${sessionId}`,
				`transcript: ${transcript}`,
				`cwd: ${cwd}`,
				`reason: ${event.reason}`,
				`endedAt: ${endedAt}`,
				"---",
				"",
				"# AIセッション（pi）",
				"",
				`- 終了: ${endedAt}`,
				`- セッションID: ${sessionId}`,
				`- 作業ディレクトリ: ${cwd}`,
				`- トランスクリプト: ${transcript}`,
				`- 終了理由: ${event.reason}`,
				"",
			].join("\n");

			mkdirSync(OUT_DIR, { recursive: true });
			writeFileSync(filePath, content, "utf8");
		} catch (err) {
			console.error(`[session-record] failed: ${String(err)}`);
		}
	});
}