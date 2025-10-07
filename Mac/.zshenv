# .zshenv
# 常に実行される（ログイン/非ログイン、インタラクティブ/非インタラクティブ問わず）
# 環境変数の設定（PATH や LANG など）だけに限定するべき。スクリプト実行時にも読むので重い設定はNG。

# ========================================
# Path
# ========================================
# brew
export PATH="/opt/homebrew/sbin:$PATH"

# composer (PHP)
export PATH="$PATH:$HOME/.composer/vendor/bin"

# Deno
export PATH="$PATH:$HOME/.deno/bin"

# grep
export PATH="$PATH:/opt/homebrew/opt/grep/libexec/gnubin"

