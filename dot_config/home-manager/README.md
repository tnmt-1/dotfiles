# Home Manager & nix-darwin Configuration

macOS 環境を Nix で宣言的に管理するための設定ファイル群です。
`nix-darwin` と `home-manager` を統合しており、システム設定、Homebrew Cask、および各種 CLI ツールの設定を一括管理しています。

## 構成

- `flake.nix`: システム全体の構成定義 (`nix-darwin`) と Homebrew Cask、Home Manager の読み込み
- `home.nix`: ユーザー個別のパッケージ (CLI ツール) とシェル (zsh) などの詳細設定
- `zsh-functions.zsh`: 独自の zsh 関数定義

## 主な管理対象

### Homebrew (Cask & Formula)

[flake.nix](flake.nix) の `homebrew` セクションで管理しています。

- **Casks**: Google Chrome, VS Code, Slack などの GUI アプリ
- **Brews**: `mysql@8.0` などのコマンドラインツール (Formula)

### CLI ツール (Home Manager)

[home.nix](home.nix) で `eza`, `bat`, `fzf`, `zoxide`, `mise` などの開発ツールを管理しています。

### シェル環境

`zsh` + `Powerlevel10k` + `fzf-tab` の構成です。

---

## 再構築・設定の反映方法

設定を変更した後は、以下のコマンドでシステムに反映させます。`nix-darwin` は `/etc` などのシステムファイルを書き換えるため、**`sudo` が必要**です。

```bash
# 基本の適用コマンド
sudo darwin-rebuild switch --flake ~/.config/home-manager#tnmt

# unfree パッケージ (claude-code 等) を含む場合
export NIXPKGS_ALLOW_UNFREE=1
sudo darwin-rebuild switch --flake ~/.config/home-manager#tnmt --impure
```

## トラブルシューティング

### 1. `/etc/bashrc` や `/etc/zshrc` のコンフリクト

`nix-darwin` の初期導入時に `/etc` 下のファイルと競合してエラーが出た場合は、以下のようにリネームして退避させてください。

```bash
sudo mv /etc/bashrc /etc/bashrc.before-nix-darwin
sudo mv /etc/zshrc /etc/zshrc.before-nix-darwin
```

### 2. unfree パッケージ (claude-code 等) のエラー

ライセンスが `unfree` なパッケージが含まれる場合、`--impure` フラグと `NIXPKGS_ALLOW_UNFREE=1` 環境変数が必要です。
[flake.nix](flake.nix) には `nixpkgs.config.allowUnfree = true;` を記述済みですが、評価プロセスにおいて環境変数が必要になることがあります。

---

## プロファイルの切り替え

マシン環境（ユーザー名）に応じて、適用する設定を指定できます。

- **仕事用 (ユーザー名: tnmt)**: `tnmt.nix` を読み込み。`slack`, `zoom` 等が含まれます。
- **個人用 (ユーザー名: mah)**: `mah.nix` を読み込み。

適用コマンド

```bash
# 明示的に指定する場合
sudo darwin-rebuild switch --flake .#tnmt --impure
sudo darwin-rebuild switch --flake .#mah --impure

# エイリアスを使う場合 (現在のログインユーザー名を自動で使用)
drb
```

### パッケージの更新

flake 全体のロックファイルを更新して最新版にするには

```bash
nix flake update
drb
```

### 不要なパッケージの削除

Homebrew 連携において `onActivation.cleanup = "zap";` が設定されているため、[flake.nix](flake.nix) のリストから削除して適用すると、実際のアプリケーションもシステムから削除されます。
