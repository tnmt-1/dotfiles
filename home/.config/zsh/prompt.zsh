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
# git: ブランチがあればその名前を表示。jjと同じ名前、またはブランチがない（detached HEAD）ときはjjの表示だけにする
# jjのリポジトリでなければ、gitのブランチ名（なければ短いコミットハッシュ）を表示
_jj_prompt() {
  local info branch
  info=$(jj log -r @ --no-graph -T 'if(bookmarks, bookmarks, change_id.shortest(8))' 2>/dev/null)
  branch=$(git symbolic-ref --short -q HEAD 2>/dev/null)
  _jj_info=""
  if [[ -n $info ]]; then
    if [[ -n $branch && $branch != "${info%\*}" ]]; then
      _jj_info+=" %F{yellow} $branch%f"
    fi
    _jj_info+=" %F{magenta}󰘬 $info%f"
  else
    [[ -z $branch ]] && branch=$(git rev-parse --short HEAD 2>/dev/null)
    [[ -n $branch ]] && _jj_info=" %F{yellow} $branch%f"
  fi
}
precmd_functions+=(_jj_prompt)
setopt PROMPT_SUBST
PROMPT=$'\n%F{cyan}%~%f${_jj_info}\n%F{green}%#%f '
