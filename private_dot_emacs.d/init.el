;; パッケージのリポジトリ設定
(require 'package)
(add-to-list 'package-archives '("melpa" . "https://melpa.org/packages/") t)
(package-initialize)

;; use-packageが入っていなければインストール
(unless (package-installed-p 'use-package)
  (package-refresh-contents)
  (package-install 'use-package))
(require 'use-package)
(setq use-package-always-ensure t) ; 未インストールのものは自動で入れる

;; 行番号を表示
(global-display-line-numbers-mode t)

;; テーマ設定
;; catppuccin mocha
(use-package catppuccin-theme
  :config
  (setq catppuccin-flavor 'mocha) ; 'latte, 'frappe, 'macchiato, or 'mocha
  (load-theme 'catppuccin t))

;; ルーラーを表示
(setq-default fill-column 80) ; 境界にする列数
(global-display-fill-column-indicator-mode t)

;; 空白・タブの可視化
(use-package whitespace
  :diminish
  :config
  (setq whitespace-style '(face           ; faceを使って可視化
                           trailing       ; 行末の空行
                           tabs           ; タブ
                           spaces         ; スペース
                           space-mark     ; 表示記号
                           tab-mark))
  (setq whitespace-display-mappings
         '(
          (space-mark ?\x20 [?·])     ; 半角スペースを 中点(·) で表示
          (tab-mark   ?\t      [?\u00bb ?\t]) ; タブを » で表示
          ))
  (global-whitespace-mode t))

;; 行削除を C-k だけで行う
;; C-a C-k C-k を1回のキー入力で行うようにした
(global-set-key (kbd "C-k") 'kill-whole-line)

;; バックアップファイルを作らない（または場所を指定する）
(setq backup-directory-alist `(("." . "~/.emacs.d/backups")))
(setq auto-save-file-name-transforms `((".*" "~/.emacs.d/backups/" t)))

;; 対応するカッコを強調表示
(show-paren-mode t)

;; カッコを自動で閉じる
(electric-pair-mode t)

;; ターミナルでもマウスを使えるようにする
(xterm-mouse-mode t)

;; 何文字目にいるか（列番号）を表示する
(column-number-mode t)

;; ファイル末尾に改行がないとき保存時に末尾改行を入れる
(setq require-final-newline t)

;; which-key
(use-package which-key
  :config
  (which-key-mode)

  ;; 表示の見た目を微調整（任意）
  (setq which-key-side-window-location 'right)   ; 右側に表示
  (setq which-key-max-display-columns nil)       ; カラム数を自動調整
)

;; M-x をしたとき候補を縦に並べる
(use-package vertico
  :init
  (vertico-mode)) ; 縦並びの補完UIを有効化

;; M-x の候補を検索するとき、スペース区切りで、順不同に検索できる
(use-package orderless
  :custom
  ;; 補完のスタイルに「orderless」を追加
  (completion-styles '(orderless basic))
  ;; ファイル探しだけは、標準の挙動も少し残して使いやすくする
  (completion-category-overrides '((file (styles basic partial-completion)))))

;; 今見ているバッファを削除する
(global-set-key (kbd "C-x k") 'kill-this-buffer)

;; terminal( -nw )でもマウスイベントを受け取れるようにする
(xterm-mouse-mode t)

;; ホイール下/上をスクロールに割り当て
(global-set-key [wheel-down] #'scroll-up-line)
(global-set-key [wheel-up] #'scroll-down-line)

;; クリップボードを連動させる
(setq select-enable-clipboard t)
(setq select-enable-primary t)

