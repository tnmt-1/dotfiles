# http://zsh.sourceforge.net/Doc/Release/Options.html#Description-of-Options
setopt hist_ignore_dups

# 終了時にまとめて.zsh_historyに書き込む
#setopt share_history
unsetopt share_history
unsetopt inc_append_history
setopt inc_append_history_time
setopt append_history

HISTSIZE=1000
HISTFILE=~/.zsh_history
SAVEHIST=100000

setopt nonomatch
setopt correct

# Shell integrations
source <(fzf --zsh)

# zoxide
eval "$(zoxide init zsh)"

