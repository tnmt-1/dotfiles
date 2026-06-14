# =========================================================
# fzf 設定
# =========================================================

# デフォルトの検索コマンド（fdを使用、隠しファイルも含める）
export FZF_DEFAULT_COMMAND='fd --type f --hidden --strip-cwd-prefix'

# Ctrl+T で使用するコマンド（デフォルトと同じ）
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"

# UI・見た目のカスタマイズ
export FZF_DEFAULT_OPTS='
  --height=60%
  --layout=reverse
  --border=rounded
  --prompt="  "
  --pointer="  "
  --preview-window=right:65%:wrap:border-left
'

# プレビュー用コマンド（batを使用、最初の500行を表示）
_fzf_preview_cmd='bat --color=always --style=plain,numbers --line-range=:500 {}'
export FZF_CTRL_T_OPTS="--preview '$_fzf_preview_cmd'"

# ---------------------------------------------------------
# カスタム ZLE ウィジェット
# ---------------------------------------------------------

# 【Ctrl+F】隠しファイルを除外したファイル選択
_fzf_file_no_hidden() {
  local cmd result
  # デフォルトコマンドから '--hidden ' を削除して隠しファイルを除外
  cmd="${FZF_DEFAULT_COMMAND/--hidden /}"

  # fzfを実行し、選択されたらカーソル位置（LBUFFER）に挿入
  result=$(eval "${cmd:-find . -type f}" | fzf --preview "$_fzf_preview_cmd")
  if [[ -n "$result" ]]; then
    LBUFFER+="${result} " # 次の入力のために末尾にスペースを付与
  fi
  zle reset-prompt
}
zle -N _fzf_file_no_hidden

# 【Ctrl+R】履歴検索（重複を除去し、直近の履歴から表示）
fzf-select-history() {
  local result
  # fc -lnr 1 : zsh組み込み機能で履歴を最新順に取得（OS依存なし）
  # awk '...'  : 履歴の重複を綺麗に除去
  result=$(fc -lnr 1 | awk '!a[$0]++' | fzf --query "$LBUFFER")

  # キャンセル（Esc）された場合は元の入力を維持する
  if [[ -n "$result" ]]; then
    BUFFER="$result"
    CURSOR=$#BUFFER
  fi
  zle clear-screen
}
zle -N fzf-select-history
