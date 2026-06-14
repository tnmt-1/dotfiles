# Better ls
alias ls='eza --icons'

# Detailed listing
alias ll='eza -lh --icons --git --time-style=long-iso'

# Detailed listing including hidden files
alias la='eza -lah --icons --git --time-style=long-iso'

# Tree view
alias tree='eza --tree --icons'

# Reuse ls completions for eza (avoids defining a separate completion function)
compdef eza=ls

# Better cat
alias cat='bat'

# =========================================================
# Core utilities
# =========================================================

alias grep='rg --color=auto'
alias diff='diff --color=auto'
alias df='df -h'

# =========================================================
# Navigation
# =========================================================

alias -- -='cd -'  # -- prevents - being parsed as a flag; cd - jumps to previous directory

# =========================================================
# Editor
# =========================================================

alias vi="nvim"
alias vim='nvim'

# =========================================================
# git
# =========================================================

alias glog='PAGER="less -F -X" git log'                              # -F quit if one screen, -X no clear on exit
alias gadog='PAGER="less -F -X" git log --all --decorate --oneline --graph'

# =========================================================
# Custom
# =========================================================

alias history="history -Di"
alias reload="exec $SHELL -l"

# --- .aliases の読み込み ---
if [ -f "$ZDOTDIR/aliases.local.zsh" ]; then
  source "$ZDOTDIR/aliases.local.zsh"
fi
