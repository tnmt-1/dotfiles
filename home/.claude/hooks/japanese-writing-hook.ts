#!/usr/bin/env bun
/**
 * Claude Code用 日本語ライティングフック
 *
 * 規約・検出ロジックは3実装で共通。直訳造語辞書 ja-ng-words.tsv はこのディレクトリを
 * 唯一の参照元とし、pi / oh-my-pi の拡張からも同じファイルを読む:
 *
 *   - ~/.claude/hooks/japanese-writing-hook.ts      (本ファイル, bun CLI)
 *   - ~/.pi/agent/extensions/japanese-writing-hooks.ts
 *   - ~/.omp/agent/extensions/japanese-writing-hooks.ts
 *
 * 使い方:
 *   bun japanese-writing-hook.ts prompt    # UserPromptSubmit: 文章規範をコンテキストに注入
 *   bun japanese-writing-hook.ts stop      # Stop: 最終回答の明白な問題を検出して書き直しを要求
 *   bun japanese-writing-hook.ts posttool  # PostToolUse(Write|Edit): 書き込んだ内容の直訳造語を検出
 *
 * 直訳造語(「raw value」→「生値」のような訳)は ja-ng-words.tsv の辞書で検出する。
 * 新しい造語を見つけたら辞書に1行追加する。
 */

const JAPANESE_WRITING_POLICY = `## 日本語の出力品質

日本語で回答するときは、送信前に内容を変えない範囲で一度だけ推敲してください。

- 修飾語と被修飾語を近づけ、主語と述語の対応を明確にする。
- 一文に複数の主張を詰め込まず、文の役割を分ける。
- 翻訳調の語順、不自然な漢語、曖昧な指示語を避ける。
- 同じ主張の言い換え、空虚な前置き、不要な総括を加えない。
- 用語と文末表現の揺れを減らす。
- 根拠のない断定を避け、確認できていないことは未確認として扱う。
- 推敲過程やこの規則自体は説明せず、完成した回答だけを出す。
- コード、ログ、設定、引用、JSONの内容は文体規則で改変しない。
`;

const TECHNICAL_WRITING_POLICY = `

技術文書、設計書、仕様書、技術記事、技術解説、技術原稿、APIドキュメントでは、次も適用してください。

- 一文ごとに改行し、空行で段落を分ける。
- 一つの段落には一つの話題だけを置く。
- 段落の冒頭で前段落との論理関係を示す。
- 例が主張の範囲を支えているか確認する。
- 技術用語の定義と用語の表記を文書全体で揃える。
- 「重要なのは」「正面から扱う」「多角的に分析する」のような、内容を増やさない表現を避ける。
`;

const NG_WORDS_PATH = `${import.meta.dir}/ja-ng-words.tsv`;

interface NgWordEntry {
	word: string;
	replacement: string;
}

async function loadNgWords(): Promise<NgWordEntry[]> {
	let raw: string;
	try {
		raw = await Bun.file(NG_WORDS_PATH).text();
	} catch {
		return [];
	}

	const entries: NgWordEntry[] = [];
	for (const line of raw.split("\n")) {
		if (!line.trim() || line.startsWith("#")) continue;
		const [word, replacement] = line.split("\t");
		if (word?.trim() && replacement?.trim()) {
			entries.push({ word: word.trim(), replacement: replacement.trim() });
		}
	}
	return entries;
}

// 「」で括られた言及(語について話している箇所)は使用ではないので検査対象から外す
function stripQuotedMentions(text: string): string {
	return text.replace(/「[^「」\n]*」/gu, " ");
}

function findNgWords(text: string, entries: NgWordEntry[]): NgWordEntry[] {
	const auditable = stripQuotedMentions(text);
	return entries.filter((entry) => auditable.includes(entry.word));
}

function buildNgWordsPolicy(entries: NgWordEntry[]): string {
	if (entries.length === 0) return "";
	const lines = entries
		.map((entry) => `  - 「${entry.word}」→ ${entry.replacement}`)
		.join("\n");
	return `- 英語の直訳で造語しない。その分野で慣用されている訳語を選び、定訳がなければカタカナ語か説明的な言い方にする。特に次の語は使わず、右の言い換えを使う。\n${lines}\n`;
}

const TECHNICAL_WRITING_HINT =
	/(?:(?:技術文書|設計書|仕様書|README|技術記事|技術解説|技術原稿|技術報告書|技術ブログ|APIドキュメント|ソフトウェアドキュメント)(?:(?:を|に)(?:書|作成|まとめ|執筆|推敲|校正|リライト|整|直|修正|更新|改訂|追記|加筆|文書化)[^\n。！？]{0,4}|[^\n。！？]{0,16}(?:文章|本文|文体|表現|説明|コード例|として|向けに)[^\n。！？]{0,8}(?:書|作成|まとめ|執筆|推敲|校正|リライト|整|直|修正|更新|改訂|追記|加筆|文書化)[^\n。！？]{0,4}))/u;
const CODE_TASK_HINT =
	/(?:(?:コード|実装|関数|クラス|テスト|バグ|プログラム|ソース|機能)を(?:書|作|直|修正|変更|追加|削除|実装|実行)|(?:実装|機能)(?:してください|お願いします)|APIを(?:実装|修正|変更|追加))/u;
const JAPANESE_TEXT = /[぀-ヿ㐀-鿿]/u;
const STRUCTURED_LINE =
	/^\s*(?:[{}\[\],]|"[^"]+"\s*:|(?:DEBUG|INFO|WARN|ERROR)\b|\[(?:DEBUG|INFO|WARN|ERROR)\]|\d{4}-\d{2}-\d{2}[T ]|(?:-\s+)?[A-Za-z_][\w.-]*\s*[:=])/u;

interface AuditableText {
	prose: string;
	hasUnclosedFence: boolean;
}

interface StructuredState {
	depth: number;
	inString: boolean;
	escaped: boolean;
}

function updateStructuredState(line: string, state: StructuredState): void {
	for (const character of line) {
		if (state.inString) {
			if (state.escaped) {
				state.escaped = false;
			} else if (character === "\\") {
				state.escaped = true;
			} else if (character === '"') {
				state.inString = false;
			}
			continue;
		}

		if (character === '"') {
			state.inString = true;
		} else if (character === "{" || character === "[") {
			state.depth++;
		} else if (character === "}" || character === "]") {
			state.depth = Math.max(0, state.depth - 1);
		}
	}

	if (state.depth === 0) {
		state.inString = false;
		state.escaped = false;
	}
}

function stripInlineCode(line: string): string {
	let result = "";
	let cursor = 0;

	while (cursor < line.length) {
		const start = line.indexOf("`", cursor);
		if (start === -1) return result + line.slice(cursor);

		result += line.slice(cursor, start);

		let markerLength = 1;
		while (line[start + markerLength] === "`") markerLength++;

		const marker = "`".repeat(markerLength);
		const end = line.indexOf(marker, start + markerLength);
		if (end === -1) return result;

		result += " ";
		cursor = end + markerLength;
	}

	return result;
}

function collectAuditableText(text: string): AuditableText {
	let fenceChar: string | undefined;
	let fenceLength = 0;
	const proseLines: string[] = [];

	const structuredState: StructuredState = {
		depth: 0,
		inString: false,
		escaped: false,
	};

	for (const line of text.split("\n")) {
		const markerMatch =
			structuredState.depth === 0
				? line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u)
				: undefined;
		if (markerMatch) {
			const marker = markerMatch[1];
			const markerChar = marker[0];
			if (fenceChar === undefined) {
				fenceChar = markerChar;
				fenceLength = marker.length;
			} else if (
				markerChar === fenceChar &&
				marker.length >= fenceLength &&
				/^\s*$/u.test(markerMatch[2])
			) {
				fenceChar = undefined;
				fenceLength = 0;
			}
			proseLines.push("");
			continue;
		}

		if (fenceChar !== undefined) {
			proseLines.push("");
			continue;
		}
		const trimmedLine = line.trim();
		const startsStructuredBlock =
			/^(?:[\[{]\s*$|[\[{]\s*["\]}0-9-])/u.test(trimmedLine) ||
			/:\s*[\[{]\s*$/u.test(trimmedLine);
		if (structuredState.depth > 0 || startsStructuredBlock) {
			updateStructuredState(line, structuredState);
			proseLines.push("");
			continue;
		}

		if (
			/^\s*>/u.test(line) ||
			/^(?: {4}|\t)/u.test(line) ||
			STRUCTURED_LINE.test(line)
		) {
			proseLines.push("");
			continue;
		}

		proseLines.push(stripInlineCode(line));
	}

	return {
		prose: proseLines.join("\n"),
		hasUnclosedFence: fenceChar !== undefined,
	};
}

function isJsonDocument(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;

	try {
		JSON.parse(trimmed);
		return true;
	} catch {
		return false;
	}
}

function findRepeatedProseLines(text: string): boolean {
	let previous = "";

	for (const line of text.split("\n")) {
		const current = line.trim().replace(/\s+/gu, " ");
		if (!current) {
			previous = "";
			continue;
		}

		if (current.length >= 16 && current === previous) return true;
		previous = current;
	}

	return false;
}

function findRepeatedSentences(text: string): boolean {
	const counts = new Map<string, number>();

	for (const sentence of text.split(/[。！？!?]\s*/u)) {
		const normalized = sentence.trim().replace(/\s+/gu, " ");
		if (normalized.length < 20) continue;

		const count = (counts.get(normalized) ?? 0) + 1;
		counts.set(normalized, count);
		if (count >= 2) return true;
	}

	return false;
}

function findObviousIssues(text: string, ngWords: NgWordEntry[]): string[] {
	if (isJsonDocument(text)) return [];

	const auditable = collectAuditableText(text);
	const issues: string[] = [];

	if (auditable.hasUnclosedFence) {
		issues.push("コードフェンスが閉じていない");
	}

	if (findRepeatedProseLines(auditable.prose)) {
		issues.push("同じ文章が隣接して重複している");
	}

	if (findRepeatedSentences(auditable.prose)) {
		issues.push("同じ文が重複している");
	}

	for (const hit of findNgWords(auditable.prose, ngWords)) {
		issues.push(
			`直訳造語「${hit.word}」を使っている(言い換え: ${hit.replacement})`,
		);
	}

	return issues;
}

// Claude Codeのtranscript(JSONL)から、直近のassistantメッセージ本文を取り出す
async function readLastAssistantText(transcriptPath: string): Promise<string> {
	let raw: string;
	try {
		raw = await Bun.file(transcriptPath).text();
	} catch {
		return "";
	}

	const lines = raw.split("\n");
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i].trim();
		if (!line) continue;

		let entry: any;
		try {
			entry = JSON.parse(line);
		} catch {
			continue;
		}

		if (entry.type !== "assistant" || entry.isSidechain === true) continue;

		const content = entry.message?.content;
		if (!Array.isArray(content)) continue;

		const text = content
			.flatMap((part: any) => (part?.type === "text" ? [part.text] : []))
			.join("\n");
		if (text.trim()) return text;
	}

	return "";
}

async function readStdinJson(): Promise<any> {
	try {
		const raw = await Bun.stdin.text();
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

async function handlePromptSubmit(): Promise<void> {
	const input = await readStdinJson();
	const prompt: string = typeof input.prompt === "string" ? input.prompt : "";

	const technicalWriting =
		TECHNICAL_WRITING_HINT.test(prompt) && !CODE_TASK_HINT.test(prompt);
	const ngWordsPolicy = buildNgWordsPolicy(await loadNgWords());
	const policy =
		(technicalWriting
			? `${JAPANESE_WRITING_POLICY}${TECHNICAL_WRITING_POLICY}`
			: JAPANESE_WRITING_POLICY) + ngWordsPolicy;

	console.log(
		JSON.stringify({
			suppressOutput: true,
			hookSpecificOutput: {
				hookEventName: "UserPromptSubmit",
				additionalContext: policy,
			},
		}),
	);
}

async function handleStop(): Promise<void> {
	const input = await readStdinJson();

	// 二重発火(この検査が要求した書き直し後のStop)では再検査しない
	if (input.stop_hook_active === true) return;

	const transcriptPath: string =
		typeof input.transcript_path === "string" ? input.transcript_path : "";
	if (!transcriptPath) return;

	const text = await readLastAssistantText(transcriptPath);
	if (!JAPANESE_TEXT.test(text)) return;

	const issues = findObviousIssues(text, await loadNgWords());
	if (issues.length === 0) return;

	console.log(
		JSON.stringify({
			decision: "block",
			reason: `回答を確定しないでください。次の問題だけを修正し、内容を増やさずに回答全体を書き直してください。検出した問題: ${issues.join("、")}`,
		}),
	);
}

// Write/Edit系ツールの入力から、新しく書き込まれるテキストを集める
function collectWrittenText(input: any): string {
	const toolInput = input.tool_input ?? {};
	const parts: string[] = [];

	if (typeof toolInput.content === "string") parts.push(toolInput.content); // Write
	if (typeof toolInput.new_string === "string")
		parts.push(toolInput.new_string); // Edit
	if (typeof toolInput.new_source === "string")
		parts.push(toolInput.new_source); // NotebookEdit
	if (Array.isArray(toolInput.edits)) {
		for (const edit of toolInput.edits) {
			if (typeof edit?.new_string === "string") parts.push(edit.new_string); // MultiEdit
		}
	}

	return parts.join("\n");
}

async function handlePostTool(): Promise<void> {
	const input = await readStdinJson();

	// 辞書やこのフック自身の編集では発火させない
	const filePath: string =
		input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? "";
	if (
		filePath.endsWith("ja-ng-words.tsv") ||
		filePath.endsWith("japanese-writing-hook.ts")
	)
		return;

	const text = collectWrittenText(input);
	if (!JAPANESE_TEXT.test(text)) return;

	const hits = findNgWords(text, await loadNgWords());
	if (hits.length === 0) return;

	const details = hits
		.map((hit) => `「${hit.word}」→ ${hit.replacement}`)
		.join("、");
	console.log(
		JSON.stringify({
			decision: "block",
			reason: `書き込んだ内容に直訳造語が含まれています。${filePath ? `${filePath} の` : ""}該当箇所を次の言い換えで修正してください: ${details}`,
		}),
	);
}

const mode = process.argv[2];
if (mode === "prompt") {
	await handlePromptSubmit();
} else if (mode === "stop") {
	await handleStop();
} else if (mode === "posttool") {
	await handlePostTool();
} else {
	console.error(
		`unknown mode: ${mode ?? "(none)"} — use "prompt", "stop", or "posttool"`,
	);
	process.exit(1);
}
