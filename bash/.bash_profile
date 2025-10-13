# if running bash
if [ -n "$BASH_VERSION" ]; then
    # include .bashrc if it exists
    if [ -f "$HOME/.bashrc" ]; then
	. "$HOME/.bashrc"
    fi
fi

# set PATH so it includes user's private bin if it exists
if [ -d "$HOME/bin" ] ; then
    PATH="$HOME/bin:$PATH"
fi

# set PATH so it includes user's private bin if it exists
if [ -d "$HOME/.local/bin" ] ; then
    PATH="$HOME/.local/bin:$PATH"
fi

# Wayland対応
unset GTK_IM_MODULE
unset QT_IM_MODULE

# ========================================
# セットアップ
# ========================================
# mise
eval "$(mise activate bash)"

# ========================================
# PATH
# ========================================
# pnpm
export PNPM_HOME="/home/tanimoto/.local/share/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end

# cargo
export PATH=$PATH:~/.cargo/bin
