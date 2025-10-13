# ========================================
# common
# ========================================
alias alert='notify-send --urgency=low -i "$([ $? = 0 ] && echo terminal || echo error)" "$(history|tail -n1|sed -e '\''s/^\s*[0-9]\+\s*//;s/[;&|]\s*alert$//'\'')"'
if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    #alias ls='ls --color=auto'
    #alias dir='dir --color=auto'
    #alias vdir='vdir --color=auto'

    alias grep='grep --color=auto'
    alias fgrep='fgrep --color=auto'
    alias egrep='egrep --color=auto'
fi
alias apap='sudo apt update && sudo apt full-upgrade -y && sudo apt autoremove -y'
alias reload='exec $SHELL -l'

# ========================================
# eza
# https://github.com/z-shell/zsh-eza
# ========================================
if command -v eza >/dev/null 2>&1; then
    alias ls='eza $eza_params'
    alias l='eza --git-ignore $eza_params'
    alias ll='eza --all --header --long $eza_params'
    alias llm='eza --all --header --long --sort=modified $eza_params'
    alias la='eza -lbhHigUmuSa'
    alias lx='eza -lbhHigUmuSa@'
    alias lt='eza --tree $eza_params'
    alias tree='eza --tree $eza_params'
else
    alias ll='ls -alF'
    alias la='ls -A'
    alias l='ls -CF'
fi

# ========================================
# fd
# https://github.com/sharkdp/fd
# ========================================
if command -v fdfind >/dev/null 2>&1; then
    alias fd='fdfind'
fi
