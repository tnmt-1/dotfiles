# ~/.config/fish/conf.d/aliases.fish
# ~/.config/zsh/aliases.zsh と同期している(zshが真)。

# Better ls
alias ls 'eza --icons'

# Detailed listing
alias ll 'eza -lh --icons --git --time-style=long-iso'

# Detailed listing including hidden files
alias la 'eza -lah --icons --git --time-style=long-iso'

# Tree view
alias tree 'eza --tree --icons'

# Better cat
alias cat bat

# =========================================================
# Core utilities
# =========================================================

alias grep 'rg --color=auto'
alias diff 'diff --color=auto'
alias df 'df -h'

# =========================================================
# Navigation
# =========================================================

# 直前のディレクトリへ戻る
abbr -a -- - 'cd -'

# =========================================================
# Editor
# =========================================================

alias vi nvim
alias vim nvim

# =========================================================
# git
# =========================================================

# -F quit if one screen, -X no clear on exit
alias glog 'env PAGER="less -F -X" git log'
alias gadog 'env PAGER="less -F -X" git log --all --decorate --oneline --graph'

# =========================================================
# Custom
# =========================================================

# zsh の history -Di 相当は fish 組み込みの history が担うため定義しない
alias reload 'exec $SHELL -l'
alias mdfixclip 'pbpaste > /tmp/clipboard.md && markdownlint --fix --config ~/.config/markdownlint/.markdownlint.jsonc /tmp/clipboard.md && pbcopy < /tmp/clipboard.md'

# 端末固有の alias は conf.d/aliases.local.fish に置く(fishが自動で読み込む)
