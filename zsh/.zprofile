# .zprofile
# ログインシェル時に読み込まれるファイル
# ログイン時に1回だけ実行したい初期化処理（PATH追加、起動時メッセージ、rbenvなどの環境セットアップ）向け。

# ========================================
# セットアップ
# ========================================
 
# brew
eval "$(/opt/homebrew/bin/brew shellenv)"

# mise
eval "$(mise activate zsh)"

# Cargoでインストールしたツール
. "$HOME/.cargo/env"
