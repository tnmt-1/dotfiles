#!/usr/bin/env python3
"""差分で追加・変更した関数から、設計を見直す候補を出す

使い方: jj diff --git | python3 -I design_hints.py   （リポジトリのルートで実行する）

- 引数か戻り値の型注釈にdictを含む関数
- 定義が1つだけで、テスト以外からの呼び出しが1か所以下のprivateな関数・メソッド

例外のある規約なので、候補を出すだけで合否は決めない。
候補があれば終了コード1、なければ0。差分が空なら終了コード2。diffコマンドの失敗を合格と取り違えないため。
"""

import ast
import os
import re
import sys

HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")
DICT = re.compile(r"\b(?:dict|Dict)\b")


def added_lines(diff: str) -> dict[str, set[int]]:
    files: dict[str, set[int]] = {}
    path, lineno = None, 0
    for line in diff.splitlines():
        if line.startswith("+++ "):
            target = line[4:]
            path = target[2:] if target.startswith("b/") else None
            if path and path.endswith(".py"):
                files.setdefault(path, set())
            else:
                path = None
        elif m := HUNK.match(line):
            lineno = int(m.group(1))
        elif path is None or line.startswith(("---", "\\")):
            continue
        elif line.startswith("+"):
            files[path].add(lineno)
            lineno += 1
        elif not line.startswith("-"):
            lineno += 1
    return files


def is_test(path: str) -> bool:
    return "/tests/" in f"/{path}" or os.path.basename(path).startswith("test_")


def python_sources() -> dict[str, str]:
    sources = {}
    for root, dirs, names in os.walk("."):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("node_modules", "migrations")]
        for name in names:
            if name.endswith(".py"):
                path = os.path.relpath(os.path.join(root, name))
                with open(path, encoding="utf-8", errors="replace") as f:
                    sources[path] = f.read()
    return sources


def dict_annotations(func: ast.FunctionDef | ast.AsyncFunctionDef) -> list[str]:
    args = func.args
    found = [
        f"引数 {a.arg}: {ast.unparse(a.annotation)}"
        for a in [*args.posonlyargs, *args.args, *args.kwonlyargs]
        if a.annotation and DICT.search(ast.unparse(a.annotation))
    ]
    if func.returns and DICT.search(ast.unparse(func.returns)):
        found.append(f"戻り値: {ast.unparse(func.returns)}")
    return found


def callers(name: str, sources: dict[str, str]) -> tuple[int, list[str]]:
    """定義の数と、テスト以外で名前が出てくる箇所（定義行を除く）を返す"""
    word = re.compile(rf"\b{re.escape(name)}\b")
    definition = re.compile(rf"^\s*(?:async\s+)?def\s+{re.escape(name)}\b")
    defs, uses = 0, []
    for path, text in sources.items():
        for i, line in enumerate(text.splitlines(), 1):
            if definition.match(line):
                defs += 1
            elif not is_test(path) and word.search(line):
                uses.append(f"{path}:{i}")
    return defs, uses


def main() -> int:
    diff = sys.stdin.read()
    if not diff.strip():
        print("差分が空です。diffコマンドの失敗か、変更なしです", file=sys.stderr)
        return 2
    sources = python_sources()
    hints = []
    for path, lines in sorted(added_lines(diff).items()):
        if not lines or path not in sources:
            continue
        for node in ast.walk(ast.parse(sources[path], path)):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) or node.lineno not in lines:
                continue
            for found in dict_annotations(node):
                hints.append(f"{path}:{node.lineno}: dict型 {node.name} の{found}")
            private = node.name.startswith("_") and not node.name.startswith("__")
            if private and not is_test(path):
                defs, uses = callers(node.name, sources)
                if defs == 1 and len(uses) <= 1:
                    where = uses[0] if uses else "なし"
                    hints.append(f"{path}:{node.lineno}: 呼び出し1か所以下 {node.name} （呼び出し: {where}）")
    if hints:
        print("\n".join(hints))
    return 1 if hints else 0


if __name__ == "__main__":
    sys.exit(main())
