{ config, pkgs, ... }:

{
  home.stateVersion = "25.11"; # Please read the comment before changing.

  # nixpkgs の設定
  nixpkgs.config = {
    allowUnfree = true;
  };

  # パッケージ定義
  home.packages = with pkgs; [
    # 開発ツール
    autoconf
    bat
    bzip2
    chezmoi
    claude-code
    codex
    colima
    delta
    emacs-nox
    eza
    fd
    ffmpeg
    fish
    fzf
    gemini-cli
    gh
    ghq
    htop
    hugo
    jq
    lazygit
    nkf
    codex
    chezmoi
    claude-code
    opencode
    pipx
    sqlite
    zellij
    tig
    uv
    zoxide
    gettext
    mise
    ripgrep
    httpie
    awscli2
    micro
];

  # Home Manager is pretty good at managing dotfiles. The primary way to manage
  # plain files is through 'home.file'.
  home.file = {
    # # Building this configuration will create a copy of 'dotfiles/screenrc' in
    # # the Nix store. Activating the configuration will then make '~/.screenrc' a
    # # symlink to the Nix store copy.
    # ".screenrc".source = dotfiles/screenrc;

    # # You can also set the file content immediately.
    # ".gradle/gradle.properties".text = ''
    #   org.gradle.console=verbose
    #   org.gradle.daemon.idletimeout=3600000
    # '';
  };

  # Home Manager can also manage your environment variables through
  # 'home.sessionVariables'. These will be explicitly sourced when using a
  # shell provided by Home Manager. If you don't want to manage your shell
  # through Home Manager then you have to manually source 'hm-session-vars.sh'
  # located at either
  #
  #  ~/.nix-profile/etc/profile.d/hm-session-vars.sh
  #
  # or
  #
  #  ~/.local/state/nix/profiles/profile/etc/profile.d/hm-session-vars.sh
  #
  # or
  #
  #  /etc/profiles/per-user/mah/etc/profile.d/hm-session-vars.sh
  #
  home.sessionVariables = {
    EDITOR = "micro";
    PATH = "$HOME/.local/bin:/opt/homebrew/opt/mysql@8.0/bin:$PATH";
  };

  # Let Home Manager install and manage itself.
  programs.home-manager.enable = true;

  launchd.agents.colima = {
    enable = true;
    config = {
      ProgramArguments = [ "${pkgs.colima}/bin/colima" "start" ];
      RunAtLoad = true;      # ログイン時に実行
      KeepAlive = false;     # 終了したら再起動しない（true にすると常時監視）
      StandardOutPath = "/tmp/colima.log";
      StandardErrorPath = "/tmp/colima.error.log";
    };
  };

  # fzf の設定
  programs.fzf = {
    enable = true;
    enableZshIntegration = true;  # source <(fzf --zsh) と同等

    # オプション: デフォルトのオプションやキーバインディングも設定可能
    #defaultCommand = "fd --type f";
    #defaultOptions = [ "--height 40%" "--layout=reverse" ];
  };

  # zoxide の設定
  programs.zoxide = {
    enable = true;
    enableZshIntegration = true;  # eval "$(zoxide init zsh)" と同等

    # オプション: cd コマンドを zoxide に置き換える
    #options = [ "--cmd cd" ];
  };

  # mise
  programs.mise = {
    enable = true;
    enableZshIntegration = true;  # `eval "$(mise activate zsh)"` と同等
  };

  programs.zsh = {
    enable = true;
    enableCompletion = true;
    syntaxHighlighting.enable = true;
    autosuggestion.enable = true;

    # Powerlevel10kを有効化
    plugins = [
      {
        name = "powerlevel10k";
        src = pkgs.zsh-powerlevel10k;
        file = "share/zsh-powerlevel10k/powerlevel10k.zsh-theme";
      }
      {
        name = "fzf-tab";
        src = pkgs.zsh-fzf-tab;
        file = "share/fzf-tab/fzf-tab.plugin.zsh";
      }
    ];

    shellAliases = {
      history = "history -Di";
      reload = "exec $SHELL -l";
      ls = "eza --time-style=long-iso --hyperlink -F always --icons auto";
      l = "ls --git-ignore";
      ll = "ls -lhg";
      la = "ls -lhga";
      lx = "ls -lhga@";
      lt = "ls --tree";
      tree = "lt";
      et = "emacsclient -s ~/.emacs.d/server/main -t";
    };

    # Powerlevel10k設定ファイルを読み込み
    initContent = ''
      # Nix configuration
      if [ -e '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh' ]; then
        . '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh'
      fi

      # p10k instant promptを有効化（オプション）
      if [[ -r "''${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-''${(%):-%n}.zsh" ]]; then
        source "''${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-''${(%):-%n}.zsh"
      fi

      # p10k設定ファイル（存在する場合）
      [[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

      # 補完候補を一覧表示したとき、Tabや矢印で選択できるようにする
      zstyle ':completion:*:default' menu select=1
      zstyle ':completion:*:default' list-colors ''${(s.:.)LSCOLORS}

      # fzf-tab設定
      zstyle ':completion:*:descriptions' format '[%d]'
      zstyle ':completion:*' list-colors ''${(s.:.)LS_COLORS}
      zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
      zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'

      # その他の補完設定
      zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}'  # 大文字小文字を区別しない

      source ${./zsh-functions.zsh}
    '';
  };
}
