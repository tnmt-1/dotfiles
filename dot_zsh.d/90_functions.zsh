# 動画の品質調整（上書き保存）
ffq() {
  if [ -z "$1" ]; then
    echo "使用法: ffq filename.mov"
    return 1
  fi

  local input="$1"
  local output="${input%.*}.mp4"

  if [ "$input" = "$output" ]; then
    output="${input%.*}_compressed.mp4"
  fi

  ffmpeg -i "$input" -vcodec libx264 -crf 20 -preset slow "$output"

  if [ $? -eq 0 ]; then
    echo "変換が完了しました！"
    echo "元ファイル（維持）: $input"
    echo "新規作成ファイル: $output✨"
  else
    echo "エラーが発生しました。処理を中断します。"
  fi
}

