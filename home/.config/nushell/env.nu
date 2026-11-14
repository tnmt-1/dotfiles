# env.nu
# fish の conf.d/env.fish、zsh の .zshenv と同期させている(zshが真)。
# ログインシェルでも読み込まれるので、環境変数の定義はここに集約する。
#
# ※ nushell の source/use はパース時に評価されるため、生成ファイルは
#    事前に生成しておく必要がある(初回セットアップ時に一度実行):
#     mise activate nu   | save -f ~/.local/share/nushell/mise.nu
#     zoxide init nushell | save -f ~/.local/share/nushell/zoxide.nu
#     starship init nu    | save -f ~/.local/share/nushell/starship.nu
#     (nushell から実行すること。更新後は nu を再起動)

# =========================================================
# XDG base directories
# =========================================================
$env.XDG_CONFIG_HOME = ($env.HOME | path join ".config")
$env.XDG_CACHE_HOME = ($env.HOME | path join ".cache")
$env.XDG_DATA_HOME = ($env.HOME | path join ".local" "share")
$env.XDG_STATE_HOME = ($env.HOME | path join ".local" "state")

# =========================================================
# PATH
# =========================================================
# ~/.local/bin, ~/.opencode/bin を先頭に追加(冪等)
$env.PATH = ([
  ($env.HOME | path join ".local" "bin")
  ($env.HOME | path join ".opencode" "bin")
] ++ $env.PATH | uniq)

# =========================================================
# Editor
# =========================================================
# fish 側と同期(micro)。zsh 側は hx になっているが魚の方が新しい
$env.EDITOR = "fresh"
$env.VISUAL = "fresh"

# =========================================================
# Pager (bat が居れば man を bat 経由で表示)
# =========================================================
# (mise の PATH 復元後に判定するため下の mise セクションより後で定義)

# =========================================================
# GPG
# =========================================================
# tty が無いコンテキストでもエラーにしない(stderr は complete で吸収)
let _gpg_tty = (^tty | complete)
$env.GPG_TTY = (if $_gpg_tty.exit_code == 0 { $_gpg_tty.stdout | str trim } else { "" })

# =========================================================
# Unicode width
# =========================================================
# CJKロケールでも曖昧幅文字(East Asian Ambiguous)を半角として扱う
# go-runewidth系ツール(micro等)とghosttyの描画幅を一致させる
$env.RUNEWIDTH_EASTASIAN = "0"

# =========================================================
# Python virtualenv
# =========================================================
# プロンプトが virtualenv に汚染されないようにする
$env.VIRTUAL_ENV_DISABLE_PROMPT = "1"

# =========================================================
# mise
# =========================================================
# mise activate nu の生成物。mise の hook が実行時に
# `mise hook-env` で PATH を再計算するため、古くても自己修復される。
use ~/.local/share/nushell/mise.nu

# mise のスナップショットが PATH を置き換えるため、独自の PATH を再適用
$env.PATH = ([
  ($env.HOME | path join ".local" "bin")
  ($env.HOME | path join ".opencode" "bin")
] ++ $env.PATH | uniq)

# 対話シェルでは pre_prompt hook が毎プロンプト適用するが、
# `nu -c` やスクリプト起動 (非対話) では発火しない。
# ここで一度 hook 相当を適用し、mise ツール (node 等) を
# 非対話コンテキストでも使えるようにする(zsh より一手進んでいる)。
def --env apply-mise-hook-env [] {
  let patch = (^/opt/homebrew/opt/mise/bin/mise hook-env -s nu
    | from csv --noheaders --no-infer
    | rename op name value)
  for $var in $patch {
    if $var.op == "set" {
      if ($var.name =~ '(?i)^path$') {
        $env.PATH = ($var.value | split row (char esep))
      } else {
        load-env {($var.name): $var.value}
      }
    } else if $var.op == "hide" and $var.name in $env {
      hide-env $var.name
    }
  }
}
apply-mise-hook-env

# =========================================================
# Pager (mise の PATH 復元後)
# =========================================================
if (which bat | is-not-empty) {
  $env.MANPAGER = "sh -c 'col -bx | bat -l man -p'"
  $env.MANROFFOPT = "-c"
}

# =========================================================
# zoxide
# =========================================================
source ~/.local/share/nushell/zoxide.nu

# =========================================================
# Starship (プロンプト)
# =========================================================
# zsh と同じ starship.toml を使う(fish は標準プロンプトのため未使用)
$env.STARSHIP_CONFIG = ($env.HOME | path join ".config" "zsh" "starship.toml")
source ~/.local/share/nushell/starship.nu

# =========================================================
# Local overrides
# =========================================================
# マシン固有の環境変数は env.local.nu に置く(chezmoi 管理外)
source ~/.config/nushell/env.local.nu
