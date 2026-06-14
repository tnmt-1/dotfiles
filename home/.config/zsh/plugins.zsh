# =========================================================
# プラグイン管理 (Plugins)
# =========================================================

# プラグインの保存先ディレクトリ
ZPLUGINDIR="${ZDOTDIR:-$HOME/.config/zsh}/plugins"

# プラグインを自動インストールして読み込む関数
_zplugin_load() {
  local repo="$1"
  local plugin="$2"
  local plugin_path="${ZPLUGINDIR}/${plugin}"

  # ディレクトリが存在しない場合は自動で git clone (初回のみ)
  if [[ ! -d "$plugin_path" ]]; then
    mkdir -p "$ZPLUGINDIR"
    echo "プラグインをインストール中: ${plugin}..."
    git clone --depth=1 "https://github.com/${repo}/${plugin}" "$plugin_path" \
      || { echo "エラー: ${plugin} のインストールに失敗しました" >&2; return 1; }
  fi

  # プラグインファイルの読み込み（主要な2パターンのファイル名に対応）
  if [[ -f "${plugin_path}/${plugin}.plugin.zsh" ]]; then
    source "${plugin_path}/${plugin}.plugin.zsh"
  elif [[ -f "${plugin_path}/${plugin}.zsh" ]]; then
    source "${plugin_path}/${plugin}.zsh"
  else
    echo "エラー: ${plugin} の起動ファイル（.zsh）が見つかりません" >&2
  fi
}

# 全プラグインを一括アップデートする関数
zplugin-update() {
  if [[ ! -d "$ZPLUGINDIR" ]]; then
    echo "エラー: プラグインディレクトリが存在しません。"
    return 1
  fi

  local dir
  # *(/N) はzsh特有の修飾子:
  # '/' でディレクトリのみに限定し、'N' (nullglob) で空の場合もエラーを出さずスキップします
  for dir in "${ZPLUGINDIR}"/*(/N); do
    echo "アップデート中: ${dir:t}..."
    git -C "$dir" pull --ff-only
  done
}

# ---------------------------------------------------------
# プラグインの読み込み実行
# ---------------------------------------------------------
_zplugin_load zsh-users zsh-autosuggestions
_zplugin_load zsh-users zsh-history-substring-search
_zplugin_load zdharma-continuum fast-syntax-highlighting
