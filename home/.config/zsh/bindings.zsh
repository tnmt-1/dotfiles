# =========================================================
# キーバインド設定 (Keybindings)
# =========================================================

# Viモードごとのカーソル形状設定
ZVM_INSERT_MODE_CURSOR=$ZVM_CURSOR_BEAM   # 挿入モード: 縦棒 (|)
ZVM_NORMAL_MODE_CURSOR=$ZVM_CURSOR_BLOCK  # ノーマルモード: ブロック (█)
ZVM_VISUAL_MODE_CURSOR=$ZVM_CURSOR_BLOCK  # ビジュアルモード: ブロック (█)

# コマンドモード（ノーマルモード）時の行ハイライトを無効化
ZVM_VI_HIGHLIGHT_BACKGROUND=none
ZVM_VI_HIGHLIGHT_FOREGROUND=none
ZVM_VI_HIGHLIGHT_EXTRASTYLE=none

# Emacs風カーソル移動
bindkey -M viins '^A' beginning-of-line # Ctrl+A で行頭へ
bindkey -M viins '^E' end-of-line       # Ctrl+E で行末へ
