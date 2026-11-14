# ~/.config/fish/conf.d/fzf.fish
# ~/.config/zsh/fzf.zsh と同期している(zshが真)。
# Ctrl+T / Ctrl+R / Alt+C のキーバインド本体は config.fish の `fzf --fish | source` が提供する。

# デフォルトの検索コマンド（fdを使用、隠しファイルも含める）
set -gx FZF_DEFAULT_COMMAND 'fd --type f --hidden --strip-cwd-prefix'

# Ctrl+T で使用するコマンド（デフォルトと同じ）
set -gx FZF_CTRL_T_COMMAND $FZF_DEFAULT_COMMAND

# UI・見た目のカスタマイズ
set -gx FZF_DEFAULT_OPTS '
  --height=60%
  --layout=reverse
  --border=rounded
  --prompt="  "
  --pointer="  "
  --preview-window=right:65%:wrap:border-left
'

# プレビュー用コマンド（batを使用、最初の500行を表示）
set -g _fzf_preview_cmd 'bat --color=always --style=plain,numbers --line-range=:500 {}'
set -gx FZF_CTRL_T_OPTS "--preview '$_fzf_preview_cmd'"

# 【Ctrl+F】隠しファイルを除外したファイル選択
function _fzf_file_no_hidden
    # デフォルトコマンドから '--hidden ' を削除して隠しファイルを除外
    set -l cmd (string replace -- '--hidden ' '' $FZF_DEFAULT_COMMAND)

    # fzfを実行し、選択されたらカーソル位置に挿入
    set -l result (eval $cmd | fzf --preview $_fzf_preview_cmd)
    if test -n "$result"
        commandline -i -- "$result "  # 次の入力のために末尾にスペースを付与
    end
    commandline -f repaint
end

if status is-interactive
    bind \cf _fzf_file_no_hidden
end
