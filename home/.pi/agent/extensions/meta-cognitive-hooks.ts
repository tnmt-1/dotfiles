/**
 * Meta-Cognitive Hooks
 *
 * 元ツイート: Solは「メタ認知を意識して過去のバイアスに引っ張られずに作業を複数回自己監査すること」
 * という感じに、メタ認知をプロンプトに直接ぶち込んだらだいぶFableっぽくなる
 *
 * 数回に一回、システムプロンプトにメタ認知・全体最適・長期的視点の指示を強制注入する。
 * Piのイベントフック（before_agent_start）を使って実現。
 *
 * Usage:
 *   自動: 3ターンに1回、メタ認知プロンプトがシステムプロンプトに追加される
 *   手動: /metacog        → 今のターンにメタ認知を注入
 *         /metacog status → 現在の状態を表示
 *         /metacog off    → 自動注入を一時停止
 *         /metacog on     → 自動注入を再開
 *
 * 可視化: 注入のたびにチャットに 🧠 カードを表示する（LLMコンテキストには含めない）。
 * カードは展開すると注入した全文を確認できる。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";

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

type PromptKey = keyof typeof META_PROMPTS;

interface MetacogEntry {
	turn: number;
	count: number;
	label: string;
	block: string;
}

const PROMPT_KEYS = Object.keys(META_PROMPTS) as PromptKey[];

const ALL_PROMPTS_COMBINED = Object.values(META_PROMPTS).join("\n\n");

// Paired combos for mid-session variety
const PAIRED_COMBOS: [PromptKey, PromptKey][] = [
	["metacognition", "globalOptimization"],
	["longTermPerspective", "thinkingQuality"],
	["globalOptimization", "longTermPerspective"],
	["metacognition", "thinkingQuality"],
	["metacognition", "longTermPerspective"],
	["globalOptimization", "thinkingQuality"],
];

function getComboPrompt(keys: [PromptKey, PromptKey]): string {
	return keys.map((k) => META_PROMPTS[k]).join("\n\n");
}

// ════════════════════════════════════════════════════════════════════════
// Extension
// ════════════════════════════════════════════════════════════════════════

export default function metaCognitiveHooks(pi: ExtensionAPI) {
	let turnCount = 0;
	let injectionCount = 0;
	let enabled = true;

	// ── Chat card: make injections visible in the transcript ───────────────

	pi.registerEntryRenderer<MetacogEntry>("metacog-injection", (entry, { expanded }, theme) => {
		const d = entry.data;
		if (!d) return new Text(theme.fg("dim", "🧠 metacog"));

		const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
		box.addChild(
			new Text(
				`${theme.fg("accent", "🧠 metacog")} #${d.count} (turn ${d.turn}): ${theme.bold(d.label)}`,
				0,
				0,
			),
		);

		if (expanded && d.block) {
			box.addChild(new Text(theme.fg("dim", d.block), 0, 0));
		}

		return box;
	});

	const INJECTION_INTERVAL = 3; // Every N turns
	const INJECT_FIRST_TURN = true;

	// ── Periodic injection via before_agent_start ──────────────────────

	pi.on("before_agent_start", async (event, ctx) => {
		if (!enabled) return;

		turnCount++;

		const shouldInject =
			(INJECT_FIRST_TURN && turnCount === 1) ||
			(turnCount > 1 && turnCount % INJECTION_INTERVAL === 0);

		if (!shouldInject) return;

		injectionCount++;

		// Pick what to inject
		let promptBlock: string;

		if (turnCount === 1) {
			// First turn: full combined prompt as initial conditioning
			promptBlock = ALL_PROMPTS_COMBINED;
		} else {
			// Subsequent injections: cycle through paired combos, then singles
			const cycleIndex = injectionCount - 2; // 0-indexed, offset by first-turn special case
			if (cycleIndex < PAIRED_COMBOS.length) {
				promptBlock = getComboPrompt(PAIRED_COMBOS[cycleIndex]);
			} else {
				// After cycling through all combos, use singles (deterministic)
				const singleIndex = (cycleIndex - PAIRED_COMBOS.length) % PROMPT_KEYS.length;
				promptBlock = META_PROMPTS[PROMPT_KEYS[singleIndex]];
			}
		}

		// Update status indicator
		ctx.ui.setStatus("metacog", `🧠 ${injectionCount}`);

		// Notify so the user feels the injection happening
		const label =
			turnCount === 1 ? "all prompts (first turn)" : promptBlock.match(/^## (.+)/)?.[1] ?? "";
		ctx.ui.notify(`🧠 Meta-cognitive prompt injected (${injectionCount}): ${label}`, "info");

		// Render a durable chat card (visible in transcript, NOT sent to the LLM)
		pi.appendEntry<MetacogEntry>("metacog-injection", {
			turn: turnCount,
			count: injectionCount,
			label,
			block: promptBlock,
		});

		return {
			systemPrompt: `${event.systemPrompt}\n\n${promptBlock}`,
		};
	});

	// ── /metacog command ───────────────────────────────────────────────

	pi.registerCommand("metacog", {
		description: "Meta-cognitive hooks control",
		handler: async (args, ctx) => {
			const arg = args.trim().toLowerCase();

			if (arg === "status") {
				const nextTurn =
					turnCount === 0
						? 1
						: turnCount + (INJECTION_INTERVAL - (turnCount % INJECTION_INTERVAL));
				ctx.ui.notify(
					`Metacog: ${enabled ? "ON" : "OFF"} | Turns: ${turnCount} | Injected: ${injectionCount} | Next inject: turn ${nextTurn} | Interval: every ${INJECTION_INTERVAL}`,
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
				const lines = [
					"## メタ認知・全体最適・長期的視点",
					...PROMPT_KEYS.map((k) => META_PROMPTS[k]),
				];
				pi.sendUserMessage(
					`【メタ認知強制注入】以下の指示をシステムプロンプトに追加してから応答してください。\n\n${lines.join("\n\n")}`,
					{ deliverAs: "steer" },
				);
				ctx.ui.notify("🧠 Meta-cognitive prompt manually injected (all prompts)", "success");
				return;
			}

			ctx.ui.notify(
				"Usage: /metacog [status|on|off|now]",
				"warning",
			);
		},
	});

	// ── Cleanup ────────────────────────────────────────────────────────

	pi.on("session_shutdown", (_event, ctx) => {
		ctx.ui.setStatus("metacog", undefined);
	});
}
