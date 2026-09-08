#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("fs");
const { tmpdir } = require("os");
const { join } = require("path");

const scriptDir = __dirname;
const textlint = join(scriptDir, "node_modules", ".bin", "textlint");

if (!existsSync(textlint)) {
  console.error("textlint がありません。このディレクトリで npm install を実行してください。");
  process.exit(2);
}

const argv = process.argv.slice(2);
let fix = false;
let style = "desu";
const files = [];

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--fix") {
    fix = true;
  } else if (arg === "--style") {
    style = argv[i + 1];
    i += 1;
  } else if (arg === "--help") {
    console.log("usage: node check.js [--fix] [--style desu|dearu] [file...]");
    console.log("ファイルを省略すると、標準入力を検査する。");
    process.exit(0);
  } else {
    files.push(arg);
  }
}

if (style !== "desu" && style !== "dearu") {
  console.error("--style は desu または dearu です。");
  process.exit(2);
}

const config = join(scriptDir, style === "dearu" ? "textlintrc.dearu.json" : "textlintrc.json");
let tempDir = null;
let stdinMode = false;

if (files.length === 0) {
  const text = readFileSync(0, "utf8");
  tempDir = mkdtempSync(join(tmpdir(), "jtca-"));
  const file = join(tempDir, "input.md");
  writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`);
  files.push(file);
  stdinMode = true;
}

const result = spawnSync(
  textlint,
  ["--config", config, ...(fix ? ["--fix"] : []), ...files],
  { encoding: "utf8" }
);

if (result.error) {
  console.error(result.error.message);
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  process.exit(2);
}

if (stdinMode && fix) {
  process.stdout.write(readFileSync(files[0], "utf8"));
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
} else {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

if (tempDir) rmSync(tempDir, { recursive: true, force: true });
process.exit(result.status === null ? 2 : result.status);
