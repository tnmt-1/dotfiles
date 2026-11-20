/**
 * Meta-Cognitive Hooks
 *
 * 元ツイート: Solは「メタ認知を意識して過去のバイアスに引っ張られずに作業を複数回自己監査すること」
 * という感じに、メタ認知をプロンプトに直接ぶち込んだらだいぶFableっぽくなる
 *
 * 1ターン目と、ファイルを編集する前に、メタ認知・全体最適・長期的視点の指示を差し込む。
 * システムプロンプトは変えない。変えるとプロンプトキャッシュが先頭から作り直されるため（D-0634）。
 *
 * Usage:
 *   自動: 1ターン目に、4つの指示の全文をユーザーのメッセージのあとへ加える（before_agent_startのmessage）。
 *         各ターンで最初のファイル編集（edit・write）を1回止め、止めた理由として「影響範囲」「変更コスト」の指示を返す。
 *         同じ応答で並べて呼んだ編集もまとめて止め、次の応答からは止めない。
 *   手動: /metacog        → 今のターンにメタ認知を注入
 *         /metacog status → 現在の状態を表示
 *         /metacog off    → 自動注入を一時停止
 *         /metacog on     → 自動注入を再開
 *
 * ターン: ユーザーの入力（inputイベント）を受けた始まりだけを数える。noslopの続きのような自動の続きは数えない。
 * inputイベントを一度も受けないセッション（サブエージェント、omp -p）では、始まりをすべて数える。
 *
 * 可視化: 1ターン目の注入はチャットに 🧠 カードとして表示し、展開すると全文を確認できる。
 * 編集を止めたことは、止めたツール呼び出しの結果に表示される。
 *
 * 評価用の記録: 編集を止めるたびにcustomエントリー（metacog-edit-check）へ、ターン、注入の回数、
 * 止めたツール呼び出しのIDを保存する。止めたあとの呼び出しと比べると、点検で編集が変わったかを確かめられる。
 *
 * 再開: ターンごとにカウンタを custom エントリー（metacog-state）へ保存し、resume・/new・分岐・/tree の
 * たびに今のブランチから読み直す。保存エントリーのない古いセッションは、最後の 🧠 カードと
 * それ以降のユーザーメッセージの数から推定する。
 */

import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { Box, Text } from "@oh-my-pi/pi-tui";

// ════════════════════════════════════════════════════════════════════════
// Prompt Pool
// ════════════════════════════════════════════════════════════════════════

const META_PROMPTS = {
	metacognition: `## 自己点検

直前までの判断を、いま一度別の角度から見直してください。

- 今回の方針が「前のターンで採用したから」という理由だけで維持されていないか確認する。
- この実装が成り立つ前提を1〜3個挙げ、その前提が崩れる条件を各1行で示す。
- 前提が崩れる余地があるなら、確認してから進む。推測で埋めない。
- 見直した結果が同じなら、同じである旨だけを1行で述べ、再説明はしない。`,

	globalOptimization: `## 影響範囲

変更を、その行だけでなく周囲との関係で評価してください。

- 同じ処理が他の箇所にもあるなら、片方だけ直して分岐を増やさない。
- 既存の命名・エラー処理・レイヤ構成から外れる場合は、外れる理由を述べる。
- 今回の変更で壊れうる呼び出し元を挙げる。挙げられないなら、まず探す。
- 影響が読み切れない場合は、範囲を狭めた変更に切り替える。`,

	longTermPerspective: `## 変更コスト

将来の変更しやすさを判断材料に含めてください。

- 「後で直す」前提の実装を選んだ場合は、何を先送りしたかを明示する。TODOコメントだけで済ませない。
- 抽象化は、現時点で2箇所以上の実際の用途があるときに限る。将来の想像だけで層を増やさない。
- 設定・定数・スキーマの変更は、既存データや既存呼び出しとの互換性を先に確認する。

適用外: 使い捨てのスクリプト、動作確認用のコード、破棄前提の検証。これらは最小の実装を返してください。`,

	thinkingQuality: `## 応答の姿勢

- 判断材料が揃っているなら、どちらとも取れる書き方をせず、採用する案と却下する案を分けて述べる。
- 判断材料が足りないなら、足りない情報を名指しし、そこで止める。埋め合わせの推測はしない。
- 業界標準やライブラリの推奨を根拠にする場合は、この状況に当てはまる理由も添える。
- ユーザーの決定を誘導しない。採用しなかった案があるなら、その存在も伝える。
- 自分の変更を過大に評価しない。動作未確認のものは未確認と書く。`,
};

interface MetacogInjectionDetails {
	turn: number;
	count: number;
	label: string;
}

const ALL_PROMPTS_COMBINED = Object.values(META_PROMPTS).join("\n\n");

const FIRST_TURN_MESSAGE = `以下は、拡張機能（meta-cognitive-hooks）がこのセッションの作業全体に加える指示です。

${ALL_PROMPTS_COMBINED}`;

const EDIT_CHECK_REASON = `この編集はまだ実行していません。拡張機能（meta-cognitive-hooks）が、このターンで最初のファイル編集の前に、次の点検を求めています。

${META_PROMPTS.globalOptimization}

${META_PROMPTS.longTermPerspective}

点検したうえで、次のどれかを選んでください。
- 編集が必要なら、同じ編集をもう一度呼び出す
- 変えるべき点が見つかったら、直した編集を呼び出す
- 編集が要らないと分かったら、呼び出さない

同じ応答で並べて呼んだ編集も、まとめて止めています。必要なものを呼び出し直してください。`;

const EDIT_TOOLS: Record<string, true> = { edit: true, write: true };

/** edit・writeのうち、ファイルへの書き込みを判定する。xd://・local://などの内部URLへの書き込みは含めない。 */
function isFileEdit(toolName: string, input: object): boolean {
	if (!EDIT_TOOLS[toolName]) return false;
	const paths = [
		"path" in input ? input.path : undefined,
		...("paths" in input && Array.isArray(input.paths) ? input.paths : []),
	].filter((p): p is string => typeof p === "string");
	return paths.length === 0 ? toolName === "edit" : paths.some((p) => !p.includes("://"));
}

// ════════════════════════════════════════════════════════════════════════
// Session restore
// ════════════════════════════════════════════════════════════════════════

const STATE_ENTRY_TYPE = "metacog-state";
const CARD_MESSAGE_TYPE = "metacog-injection";
const EDIT_CHECK_ENTRY_TYPE = "metacog-edit-check";

interface MetacogState {
	turn: number;
	count: number;
}

/** The SessionEntry fields read when restoring counters. */
interface BranchEntry {
	type: string;
	customType?: string;
	message?: { role: string };
	details?: unknown;
	data?: unknown;
}

function readState(value: unknown): MetacogState | undefined {
	if (!value || typeof value !== "object" || !("turn" in value) || !("count" in value)) return undefined;
	const { turn, count } = value;
	return typeof turn === "number" && typeof count === "number" ? { turn, count } : undefined;
}

/**
 * Rebuilds counters from the active branch. The last metacog-state entry wins; sessions saved
 * before that entry existed fall back to the last 🧠 card plus the user messages after it
 * (a card is appended after its own turn's user message).
 */
export function restoreCounts(entries: readonly BranchEntry[]): MetacogState {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type !== "custom" || entry.customType !== STATE_ENTRY_TYPE) continue;
		const state = readState(entry.data);
		if (state) return state;
	}

	let userMessagesAfter = 0;
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type === "message" && entry.message?.role === "user") {
			userMessagesAfter++;
		} else if (entry.type === "custom_message" && entry.customType === CARD_MESSAGE_TYPE) {
			const card = readState(entry.details);
			if (card) return { turn: card.turn + userMessagesAfter, count: card.count };
		}
	}
	return { turn: userMessagesAfter, count: 0 };
}

// ════════════════════════════════════════════════════════════════════════
// Extension
// ════════════════════════════════════════════════════════════════════════

export default function metaCognitiveHooks(pi: ExtensionAPI) {
	let turnCount = 0;
	let injectionCount = 0;
	let enabled = true;
	// inputイベントを一度でも受けたら、ユーザーの入力のあとの始まりだけをターンに数える
	let receivesInput = false;
	let inputPending = false;
	let editCheckedTurn = 0;
	let blockingEdits = false;

	// ── Chat card: make injections visible in the transcript ───────────────

	pi.registerMessageRenderer<MetacogInjectionDetails>(
		CARD_MESSAGE_TYPE,
		(message, { expanded }, theme) => {
			const d = message.details;
			if (!d) return new Text(theme.fg("dim", "🧠 metacog"));

			const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
			box.addChild(
				new Text(
					`${theme.fg("accent", "🧠 metacog")} #${d.count} (turn ${d.turn}): ${theme.bold(d.label)}`,
					0,
					0,
				),
			);

			if (expanded && typeof message.content === "string") {
				box.addChild(new Text(theme.fg("dim", message.content), 0, 0));
			}

			return box;
		},
	);

	const recordState = () => pi.appendEntry<MetacogState>(STATE_ENTRY_TYPE, { turn: turnCount, count: injectionCount });

	// ── Restore counters when the session (or its active branch) changes ──

	const restore = (ctx: ExtensionContext) => {
		({ turn: turnCount, count: injectionCount } = restoreCounts(ctx.sessionManager.getBranch()));
		ctx.ui.setStatus("metacog", enabled && injectionCount > 0 ? `🧠 ${injectionCount}` : undefined);
	};

	pi.on("session_start", (_event, ctx) => restore(ctx));
	pi.on("session_switch", (_event, ctx) => restore(ctx));
	pi.on("session_branch", (_event, ctx) => restore(ctx));
	pi.on("session_tree", (_event, ctx) => restore(ctx));

	pi.on("input", () => {
		receivesInput = true;
		inputPending = true;
	});

	// ── First-turn injection via before_agent_start ────────────────────

	pi.on("before_agent_start", async (_event, ctx) => {
		if (!enabled) return;
		if (receivesInput && !inputPending) return;
		inputPending = false;

		turnCount++;
		const shouldInject = turnCount === 1;
		if (shouldInject) injectionCount++;
		recordState();
		if (!shouldInject) return;

		const label = "all prompts (first turn)";
		ctx.ui.setStatus("metacog", `🧠 ${injectionCount}`);
		ctx.ui.notify(`🧠 Meta-cognitive prompt injected (${injectionCount}): ${label}`, "info");

		return {
			message: {
				customType: CARD_MESSAGE_TYPE,
				content: FIRST_TURN_MESSAGE,
				display: true,
				details: { turn: turnCount, count: injectionCount, label } satisfies MetacogInjectionDetails,
			},
		};
	});

	// ── Edit check: block the first file edit of each turn once ─────────

	pi.on("turn_start", () => {
		blockingEdits = false;
	});

	pi.on("tool_call", (event, ctx) => {
		if (!enabled || !isFileEdit(event.toolName, event.input)) return;
		if (editCheckedTurn !== turnCount) {
			editCheckedTurn = turnCount;
			blockingEdits = true;
			injectionCount++;
			recordState();
			pi.appendEntry(EDIT_CHECK_ENTRY_TYPE, {
				turn: turnCount,
				count: injectionCount,
				toolCallId: event.toolCallId,
				toolName: event.toolName,
			});
			ctx.ui.setStatus("metacog", `🧠 ${injectionCount}`);
		}
		if (blockingEdits) return { block: true, reason: EDIT_CHECK_REASON };
	});

	// ── /metacog command ───────────────────────────────────────────────

	pi.registerCommand("metacog", {
		description: "Meta-cognitive hooks control",
		handler: async (args, ctx) => {
			const arg = args.trim().toLowerCase();

			if (arg === "status") {
				ctx.ui.notify(
					`Metacog: ${enabled ? "ON" : "OFF"} | Turns: ${turnCount} | Injected: ${injectionCount} | Edit check this turn: ${editCheckedTurn === turnCount ? "done" : "pending"}`,
					"info",
				);
				return;
			}

			if (arg === "off") {
				enabled = false;
				ctx.ui.setStatus("metacog", undefined);
				ctx.ui.notify("Meta-cognitive hooks: paused", "warning");
				return;
			}

			if (arg === "on") {
				enabled = true;
				ctx.ui.setStatus("metacog", `🧠 ${injectionCount}`);
				ctx.ui.notify("Meta-cognitive hooks: resumed", "info");
				return;
			}

			if (arg === "" || arg === "now") {
				// Force injection: queue a steer message asking the model to self-apply
				pi.sendUserMessage(
					`【メタ認知強制注入】以下の指示をシステムプロンプトに追加してから応答してください。\n\n## メタ認知・全体最適・長期的視点\n\n${ALL_PROMPTS_COMBINED}`,
					{ deliverAs: "steer" },
				);
				ctx.ui.notify("🧠 Meta-cognitive prompt manually injected (all prompts)", "info");
				return;
			}

			ctx.ui.notify("Usage: /metacog [status|on|off|now]", "warning");
		},
	});

	// ── Cleanup ────────────────────────────────────────────────────────

	pi.on("session_shutdown", (_event, ctx) => {
		ctx.ui.setStatus("metacog", undefined);
	});
}
