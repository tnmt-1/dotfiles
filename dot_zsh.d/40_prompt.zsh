# インタラクティブシェル時（通常のシェル操作時）
# シェル操作を快適にする設定（エイリアス、補完、プロンプト、キー設定など）。普段の作業用。
PROMPT="%B%F{green}%n@[%*]%f%b:%B%F{blue}%~%f%b%# "

# https://git-scm.com/book/en/v2/Appendix-A%3A-Git-in-Other-Environments-Git-in-Zsh
autoload -Uz vcs_info
precmd_vcs_info() { vcs_info }
precmd_functions+=( precmd_vcs_info )
setopt prompt_subst
RPROMPT=\$vcs_info_msg_0_

# http://zsh.sourceforge.net/Doc/Release/User-Contributions.html#vcs_005finfo-Configuration
zstyle ':vcs_info:git:*' formats '[%F{yellow}%b%f]%u%c'
zstyle ':vcs_info:git:*' actionformats '[%b|%a]'
zstyle ':vcs_info:git:*' check-for-changes true
zstyle ':vcs_info:git:*' stagedstr ":%F{green}!%f"
zstyle ':vcs_info:git:*' unstagedstr ":%F{red}+%f"
