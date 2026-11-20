// textlintを別プロセスで動かす。lintChangedFileが、標準入出力でこのファイルとやりとりする
// 標準入力: { config, nodeModules?, items: [{ text, filePath }] }
// 標準出力: itemsと同じ順の、指摘の配列の配列
import { createLinter, loadTextlintrc } from "textlint";

interface RunnerInput {
	config: string;
	nodeModules?: string;
	items: { text: string; filePath: string }[];
}

const input = (await Bun.stdin.json()) as RunnerInput;
const descriptor = await loadTextlintrc({ configFilePath: input.config, node_modulesDir: input.nodeModules });
const linter = createLinter({ descriptor });

const results = [];
for (const item of input.items) {
	const result = await linter.lintText(item.text, item.filePath);
	results.push(
		result.messages.map((message) => ({
			line: message.line,
			ruleId: message.ruleId,
			message: message.message.split("\n")[0],
		})),
	);
}
console.log(JSON.stringify(results));
