alias ls='ls -AFG'
alias ll='ls -hlt'
alias history='history -Di'
alias reload='exec $SHELL -l'

# ========================================
# common
# ========================================
alias ls='ls -AFG'
alias ll='ls -hlt'
alias history='history -Di'
alias reload='exec $SHELL -l'

# ========================================
# eza
# ========================================
if command -v eza >/dev/null 2>&1; then
    alias ls='eza --time-style=long-iso --hyperlink -F always --icons auto'
    alias l='ls --git-ignore'
    alias ll='ls -lhg'
    alias la='ls -lhga'
    alias lx='ls -lhga@'
    alias lt='ls --tree $eza_params'
    alias tree='ls --tree $eza_params'
fi

# ========================================
# emacs
# ========================================
alias et='emacsclient -s main -t'

