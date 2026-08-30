# ~/.config/fish/conf.d/env.fish
# ~/.config/zsh/.zshenv と同期している(zshが真)。

# ---------- XDG base directories ----------
set -gx XDG_CONFIG_HOME $HOME/.config
set -gx XDG_CACHE_HOME $HOME/.cache
set -gx XDG_DATA_HOME $HOME/.local/share
set -gx XDG_STATE_HOME $HOME/.local/state

# ---------- Editor ----------
set -gx EDITOR fresh
set -gx VISUAL fresh

# ---------- Pager ----------
if command -q bat
    set -gx MANPAGER "sh -c 'col -bx | bat -l man -p'"
    set -gx MANROFFOPT -c
else if command -q batcat
    set -gx MANPAGER "sh -c 'col -bx | batcat -l man -p'"
    set -gx MANROFFOPT -c
end

# ---------- GPG ----------
set -gx GPG_TTY (tty 2>/dev/null)

# ---------- Unicode width ----------
# CJKロケールでも曖昧幅文字(East Asian Ambiguous)を半角として扱う
# go-runewidth系ツール(micro等)とghosttyの描画幅を一致させる
set -gx RUNEWIDTH_EASTASIAN 0

# ---------- Local overrides ----------
# マシン固有の環境変数は conf.d/env.local.fish に置く(fishが自動で読み込む)
