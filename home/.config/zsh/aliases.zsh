# Better ls
#alias ls='eza --icons'

# Detailed listing
#alias ll='eza -lh --icons --git --time-style=long-iso'

# Detailed listing including hidden files
#alias la='eza -lah --icons --git --time-style=long-iso'

# Tree view
#alias tree='eza --tree --icons'

# Reuse ls completions for eza (avoids defining a separate completion function)
#compdef eza=ls

# Plain ls (BSD ls: -G enables color)
alias ls='ls -G'
alias ll='ls -lhL'
alias la='ls -lAhL'
alias l='ls -CF'

# Better cat
alias cat='bat'

# =========================================================
# Core utilities
# =========================================================

#alias grep='rg --color=auto'
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
alias mdfixclip='pbpaste > /tmp/clipboard.md && markdownlint --fix --config ~/.config/markdownlint/.markdownlint.jsonc /tmp/clipboard.md && pbcopy < /tmp/clipboard.md'
alias zl="zellij"

# Claude Codeに、祖先のディレクトリの .claude/skills を --add-dir で渡す。
# --add-dir は後ろの引数も値として取り込むので、= でつなぐ。サブコマンドのときは渡さない。
claude() {
  case "$1" in
    agents|attach|auth|auto-mode|doctor|gateway|import|install|logs|mcp|plugin|plugins|purge|respawn|rm|setup-token|stop|kill|ultrareview|update|upgrade)
      command claude "$@"
      return
      ;;
  esac
  local dir
  dir=$(command bun "$HOME/.claude/bin/ancestor-skills.ts" "$PWD" 2>/dev/null)
  if [[ -n "$dir" ]]; then
    command claude --add-dir="$dir" "$@"
  else
    command claude "$@"
  fi
}

# --- .aliases の読み込み ---
if [ -f "$ZDOTDIR/aliases.local.zsh" ]; then
  source "$ZDOTDIR/aliases.local.zsh"
fi
