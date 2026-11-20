import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("@oh-my-pi/pi-tui", () => ({
	Box: class {
		addChild() {}
	},
	Text: class {},
}));

// index.tsが読む@oh-my-pi/pi-tuiは、ompの外では解決できない。mock.moduleを先に効かせるため、ここで読み込む
const { default: metaCognitiveHooks } = await import("./index");

type Handler = (event: Record<string, unknown>, ctx: unknown) => unknown;

interface Harness {
	userPrompt(): Promise<unknown>;
	continuation(): Promise<unknown>;
	step(): void;
	toolCall(toolName: string, input: Record<string, unknown>): Promise<{ block?: boolean; reason?: string } | undefined>;
	stateTurns(): number[];
}

function load(): Harness {
	const handlers = new Map<string, Handler[]>();
	const states: number[] = [];
	const pi = {
		on: (event: string, handler: Handler) => handlers.set(event, [...(handlers.get(event) ?? []), handler]),
		registerMessageRenderer: () => {},
		registerCommand: () => {},
		appendEntry: (customType: string, data: { turn: number }) => {
			if (customType === "metacog-state") states.push(data.turn);
		},
		sendMessage: () => {},
		sendUserMessage: () => {},
	};
	const ctx = {
		ui: { setStatus: () => {}, notify: () => {} },
		sessionManager: { getBranch: () => [] },
	};
	const emit = async (event: string, payload: Record<string, unknown> = {}) => {
		let result: unknown;
		for (const handler of handlers.get(event) ?? []) result = (await handler({ type: event, ...payload }, ctx)) ?? result;
		return result;
	};
	metaCognitiveHooks(pi as never);
	const start = () => emit("before_agent_start", { prompt: "", systemPrompt: ["base"] });

	return {
		userPrompt: async () => {
			await emit("input", { text: "依頼", source: "interactive" });
			return start();
		},
		continuation: start,
		step: () => void emit("turn_start", { turnIndex: 0, timestamp: 0 }),
		toolCall: (toolName, input) =>
			emit("tool_call", { toolCallId: "c", toolName, input }) as Promise<{ block?: boolean; reason?: string } | undefined>,
		stateTurns: () => states,
	};
}

let h: Harness;
beforeEach(() => {
	h = load();
});

describe("注入", () => {
	test("1ターン目は、4つの指示の全文をシステムプロンプトではなくメッセージとして加える", async () => {
		const result = (await h.userPrompt()) as { systemPrompt?: string[]; message?: { content: string } };

		expect(result.systemPrompt).toBeUndefined();
		for (const heading of ["## 自己点検", "## 影響範囲", "## 変更コスト", "## 応答の姿勢"]) {
			expect(result.message?.content).toContain(heading);
		}
	});

	test("2ターン目以降のターンの始まりには注入しない", async () => {
		await h.userPrompt();
		for (let i = 2; i <= 10; i++) expect(await h.userPrompt()).toBeUndefined();
	});
});

describe("ターン数", () => {
	test("ユーザーの入力がない自動の続きは、ターンに数えない", async () => {
		await h.userPrompt();
		await h.continuation();
		await h.userPrompt();

		expect(h.stateTurns()).toEqual([1, 2]);
	});

	test("ユーザーの入力を受けない場合（サブエージェントなど）は、始まりをすべてターンに数える", async () => {
		await h.continuation();
		await h.continuation();

		expect(h.stateTurns()).toEqual([1, 2]);
	});
});

describe("編集の前の点検", () => {
	test("ターン内で最初のファイル編集を止め、影響範囲と変更コストの指示を返す", async () => {
		await h.userPrompt();
		h.step();

		const result = await h.toolCall("edit", { input: "[src/a.ts#1A2B]\nPUT 1.=1:\n+x", path: "src/a.ts" });

		expect(result?.block).toBe(true);
		expect(result?.reason).toContain("## 影響範囲");
		expect(result?.reason).toContain("## 変更コスト");
	});

	test("同じ応答の中で並べて呼んだ編集も止め、次の応答からは止めない", async () => {
		await h.userPrompt();
		h.step();
		await h.toolCall("edit", { path: "src/a.ts" });

		expect((await h.toolCall("write", { path: "src/b.ts", content: "" }))?.block).toBe(true);

		h.step();
		expect(await h.toolCall("edit", { path: "src/a.ts" })).toBeUndefined();
	});

	test("自動の続きでは止めず、次のユーザーのターンでは再び止める", async () => {
		await h.userPrompt();
		h.step();
		await h.toolCall("edit", { path: "src/a.ts" });
		h.step();

		await h.continuation();
		h.step();
		expect(await h.toolCall("edit", { path: "src/a.ts" })).toBeUndefined();

		await h.userPrompt();
		h.step();
		expect((await h.toolCall("edit", { path: "src/a.ts" }))?.block).toBe(true);
	});

	test("ファイル以外への書き込みと、読み取りは止めない", async () => {
		await h.userPrompt();
		h.step();

		expect(await h.toolCall("write", { path: "xd://lsp", content: "{}" })).toBeUndefined();
		expect(await h.toolCall("write", { path: "local://plan.md", content: "" })).toBeUndefined();
		expect(await h.toolCall("read", { path: "src/a.ts" })).toBeUndefined();
	});
});
