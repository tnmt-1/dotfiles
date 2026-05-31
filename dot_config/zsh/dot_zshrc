# ~/.config/zsh/.zshrc
# Uses:
#   Plugins:      fast-syntax-highlighting, zsh-autosuggestions,
#                 zsh-history-substring-search
#   Prompt:       starship
#   Navigation:   zoxide, fzf, fd
#   CLI tools:    eza, bat, nvim, ripgrep
#   Node:         nvm

# .zshenvを読み込んでくれないので.zshrcから明示的に読み込む
if [[ -f ./.zshenv ]]; then
    source ./.zshenv
fi

# =========================================================
# History
# =========================================================

HISTFILE="$XDG_STATE_HOME/zsh/history"
HISTSIZE=100000
SAVEHIST=100000

setopt APPEND_HISTORY
setopt SHARE_HISTORY
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_SPACE
setopt HIST_EXPIRE_DUPS_FIRST
setopt HIST_FIND_NO_DUPS

# =========================================================
# Shell behaviour
# =========================================================

setopt AUTOCD
setopt NOBEEP
setopt NUMERIC_GLOB_SORT  # sort file10 after file9, not after file1
set -o emacs

# =========================================================
# Smart directory navigation
# =========================================================

eval "$(mise activate zsh)"
eval "$(fzf --zsh)"
eval "$(zoxide init zsh)"

# =========================================================
# Completion
# =========================================================

# 高度な自動補完システム（compinit）を自動ロードするように設定
autoload -Uz compinit

# 補完のキャッシュファイルの出力先を指定して補完システムを初期化
compinit -d "$XDG_CACHE_HOME/zsh/zcompdump"

# 補完候補を矢印キーで選択できるメニューモードを有効化
zstyle ':completion:*' menu select

# タブキーを1回押した時点で即座にメニュー選択モードに入るように設定
zstyle ':completion:*:default' menu select=1

# 補完候補のグループ名（見出し）を [説明文] の形式で表示
zstyle ':completion:*:descriptions' format '[%d]'

# 補完時に大文字と小文字を区別しない（小文字入力で大文字もマッチさせる）
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'

# =========================================================
# Fuzzy finder
# =========================================================

# macOS / Homebrew (Apple Silicon)
if [[ -f /opt/homebrew/opt/fzf/shell/key-bindings.zsh ]]; then
  source /opt/homebrew/opt/fzf/shell/key-bindings.zsh
  source /opt/homebrew/opt/fzf/shell/completion.zsh
fi

# Ubuntu
if [[ -f /usr/share/doc/fzf/examples/key-bindings.zsh ]]; then
  source /usr/share/doc/fzf/examples/key-bindings.zsh
  source /usr/share/doc/fzf/examples/completion.zsh
fi

# =========================================================
# Modular Config Files
# =========================================================

# fzf configuration
source "$ZDOTDIR/fzf.zsh"

# Aliases
source "$ZDOTDIR/aliases.zsh"

# Custom keybindings
source "$ZDOTDIR/bindings.zsh"

# Plugins and plugin manager
source "$ZDOTDIR/plugins.zsh"

# Prompt/theme
source "$ZDOTDIR/prompt.zsh"
