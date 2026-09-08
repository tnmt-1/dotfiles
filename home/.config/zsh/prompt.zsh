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
# jj: @ にブックマークがあればその名前、なければ change id を1行目に表示
_jj_prompt() {
  local info
  info=$(jj log -r @ --no-graph -T 'if(bookmarks, bookmarks, change_id.shortest(8))' 2>/dev/null)
  if [[ -n $info ]]; then
    _jj_info=" %F{magenta}󰘬 $info%f"
  else
    _jj_info=""
  fi
}
precmd_functions+=(_jj_prompt)
setopt PROMPT_SUBST
PROMPT=$'\n%F{cyan}%~%f${_jj_info}\n%F{green}%#%f '
