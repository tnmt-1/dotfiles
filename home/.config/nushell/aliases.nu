# aliases.nu
# fish の conf.d/aliases.fish を移植(zsh の aliases.zsh と同期)。
# nushell の alias は引数を渡せないため、引数付きコマンドは def で定義する。

# =========================================================
# Better ls (eza)
# =========================================================
#def --wrapped ls [...rest] { ^eza --icons ...$rest }
#def --wrapped ll [...rest] { ^eza -lh --icons --git --time-style=long-iso ...$rest }
#def --wrapped la [...rest] { ^eza -lah --icons --git --time-style=long-iso ...$rest }
#def --wrapped tree [...rest] { ^eza --tree --icons ...$rest }

# =========================================================
# Better cat (bat)
# =========================================================
def --wrapped cat [...rest] { ^bat ...$rest }

# =========================================================
# Core utilities
# =========================================================
#def --wrapped grep [...rest] { ^rg --color=auto ...$rest }
#def --wrapped diff [...rest] { ^diff --color=auto ...$rest }
def --wrapped df [...rest] { ^df -h ...$rest }

# =========================================================
# Editor
# =========================================================
def --wrapped vi [...rest] { ^nvim ...$rest }
def --wrapped vim [...rest] { ^nvim ...$rest }

# =========================================================
# git
# =========================================================
# -F quit if one screen, -X no clear on exit
def --wrapped glog [...rest] { with-env { PAGER: "less -F -X" } { ^git log ...$rest } }
def --wrapped gadog [...rest] { with-env { PAGER: "less -F -X" } { ^git log --all --decorate --oneline --graph ...$rest } }

# =========================================================
# Custom
# =========================================================
# zsh の history -Di 相当は nushell 組み込みの history が担うため定義しない
def reload [] { exec nu --login }
def mdfixclip [] {
  ^pbpaste | save -f /tmp/clipboard.md
  ^markdownlint --fix --config ~/.config/markdownlint/.markdownlint.jsonc /tmp/clipboard.md
  ^cat /tmp/clipboard.md | ^pbcopy
}
