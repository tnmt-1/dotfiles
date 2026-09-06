# ~/.config/zsh/prompt.zsh

# Pythonのvirtualenvでプロンプトが汚染されるのを防ぐ
export VIRTUAL_ENV_DISABLE_PROMPT=1

# starshipに戻すときはこのコメントを外す
# eval "$(starship init zsh)"

# カスタムプロンプト（2行構成）
# 1行目: カレントディレクトリ、2行目: 入力行
# 先頭の空行で前のコマンド出力との間に1行分の間隔を開ける
# 色を外して元の見た目に戻す場合は、下の色付き設定をコメントアウトし、この行のコメントを外す
# PROMPT=$'\n%~\n%# '
PROMPT=$'\n%F{cyan}%~%f\n%F{green}%#%f '
