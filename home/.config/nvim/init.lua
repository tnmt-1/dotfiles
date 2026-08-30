-- INIT.LUA (minimal but complete single-file config)
-- 使い方: ~/.config/nvim/init.lua として保存して nvim を起動

-- leader
vim.g.mapleader = " "

-- 基本オプション
local o = vim.opt
o.number = true
o.relativenumber = true
o.expandtab = true
o.shiftwidth = 4
o.tabstop = 4
o.smartindent = true
o.termguicolors = true
o.clipboard = "unnamedplus"

-- キーマップのヘルパー
local map = vim.keymap.set
map("n", "<leader>w", ":w<CR>", { desc = "Save file" })
map("n", "<leader>q", ":q<CR>", { desc = "Quit" })
map("n", "<leader>uw", ":set list!<CR>", { desc = "Toggle whitespace" })

-- 空白の可視化設定
vim.opt.listchars = {
  eol = "↲",
  tab = "› ",
  trail = "·",
  lead = "·",
  nbsp = "␣",
  extends = "…",
  precedes = "…",
}
vim.opt.list = true

-- 行末空白の強調
vim.api.nvim_set_hl(0, "TrailingWhitespace", { bg = "#3b0b0b" })
vim.api.nvim_create_autocmd({ "BufEnter", "WinEnter", "InsertLeave" }, {
  pattern = "*",
  callback = function() vim.cmd([[match TrailingWhitespace /\s\+$/]]) end,
})
vim.api.nvim_create_autocmd({ "BufLeave", "InsertEnter" }, {
  pattern = "*",
  callback = function() vim.cmd([[match none]]) end,
})

-- 保存前に行末スペース削除
vim.api.nvim_create_autocmd("BufWritePre", {
  pattern = "*",
  callback = function() vim.cmd([[%s/\s\+$//e]]) end,
})

-- lazy.nvim 自己インストール（最小）
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

-- プラグイン一覧（最小 + mason/pyright）
require("lazy").setup({
  { "rebelot/kanagawa.nvim", lazy = false, priority = 1000 },
  { "nvim-lua/plenary.nvim" },
  { "nvim-telescope/telescope.nvim", branch = "0.1.x", dependencies = { "nvim-lua/plenary.nvim" } },
  { "nvim-treesitter/nvim-treesitter", run = ":TSUpdate" },
})

-- colorscheme
vim.cmd([[colorscheme kanagawa]])

-- 簡単なヘルスチェック用コマンド
vim.api.nvim_create_user_command("MyCheckLsp", function()
  vim.cmd("checkhealth")
  print("checkhealth run")
end, {})

-- 必要ならここに補完（nvim-cmp）や null-ls/conform の設定を追加してください

