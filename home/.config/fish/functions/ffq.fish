# ~/.config/zsh/functions.zsh の ffq と同期している(zshが真)。

# 動画の品質調整（上書き保存）
function ffq
    if test -z "$argv[1]"
        echo "使用法: ffq filename.mov"
        return 1
    end

    set -l input $argv[1]
    set -l output (string replace -r '\.[^.]*$' '' -- $input).mp4

    if test "$input" = "$output"
        set output (string replace -r '\.[^.]*$' '' -- $input)_compressed.mp4
    end

    if ffmpeg -i $input -vcodec libx264 -crf 20 -preset slow $output
        echo "変換が完了しました！"
        echo "元ファイル（維持）: $input"
        echo "新規作成ファイル: $output✨"
    else
        echo "エラーが発生しました。処理を中断します。"
    end
end
