# ~/.config/zsh/.zshenv

# ---------- XDG base directories ----------
# Centralizes config/cache/data locations
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_CACHE_HOME="$HOME/.cache"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_STATE_HOME="$HOME/.local/state"

# ---------- Locale ----------
export LANG="ja_JP.UTF-8"

# ---------- Editor ----------
# Default editor used by git, crontab, etc.
export EDITOR="hx"
export VISUAL="hx"
#bindkey -e

# ---------- Pager ----------
if command -v bat >/dev/null 2>&1; then
  export MANPAGER="sh -c 'col -bx | bat -l man -p'"
  export MANROFFOPT="-c"
elif command -v batcat >/dev/null 2>&1; then
  export MANPAGER="sh -c 'col -bx | batcat -l man -p'"
  export MANROFFOPT="-c"
fi

# ---------- GPG ----------
export GPG_TTY=$(tty 2>/dev/null || true)

# ---------- Starship ----------
export STARSHIP_CONFIG="$ZDOTDIR/starship.toml"

# ---------- PATH ----------
# Personal binaries/scripts
export PATH="$HOME/.local/bin:$PATH"

# ---------- Unicode width ----------
# CJKロケールでも曖昧幅文字(East Asian Ambiguous)を半角として扱う
# go-runewidth系ツール(micro等)とghosttyの描画幅を一致させる
export RUNEWIDTH_EASTASIAN=0

# ---------- headroom persistent env ----------
export HEADROOM_PORT="8788"
export HEADROOM_HOST="127.0.0.1"
export HEADROOM_MODE="token"
export HEADROOM_BACKEND="anthropic"
export HEADROOM_TELEMETRY="on"
export ANTHROPIC_BASE_URL="http://127.0.0.1:8788"
export ENABLE_TOOL_SEARCH="true"

# ---------- Local overrides ----------
# Load local overrides if the file exists
if [[ -f "$ZDOTDIR/.zshenv.local" ]]; then
  source "$ZDOTDIR/.zshenv.local"
fi
