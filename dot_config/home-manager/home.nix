{ config, pkgs, ... }:

{
  home.stateVersion = "25.11";

  # Let Home Manager install and manage itself.
  programs.home-manager.enable = true;

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
    opencode
    pipx
    sqlite
    zellij
    tig
    uv
    zoxide
    mise
    ripgrep
    httpie
    awscli2
    micro
    yazi
    nb
    pandoc
    aerospace
    docker
    docker-buildx
    helix
    felix-fm
  ];

  # Home Manager is pretty good at managing dotfiles.
  home.file = {};

  home.sessionVariables = {
    EDITOR = "hx";
    PATH = "$HOME/.local/bin:/opt/homebrew/opt/mysql@8.0/bin:$PATH";
  };

  launchd.agents.colima = {
    enable = true;
    config = {
      ProgramArguments = [ "${pkgs.colima}/bin/colima" "start" ];
      RunAtLoad = true;
      KeepAlive = false;
      StandardOutPath = "/tmp/colima.log";
      StandardErrorPath = "/tmp/colima.error.log";
    };
  };

  # 各種プログラム設定
  programs.fzf = {
    enable = true;
    enableZshIntegration = true;
  };

  programs.zoxide = {
    enable = true;
    enableZshIntegration = true;
  };

  programs.mise = {
    enable = true;
    enableZshIntegration = true;
  };

  programs.aerospace = {
    enable = true;
    settings = {
      enable-normalization-flatten-containers = true;
      gaps = {
        inner = { horizontal = 0; vertical = 0; };
        outer = { left = 10; bottom = 10; top = 10; right = 10; };
      };
      mode.main.binding = {
        alt-h = "focus left";
        alt-l = "focus right";
        alt-j = "focus down";
        alt-k = "focus up";
        alt-1 = "workspace 1";
        alt-2 = "workspace 2";
      };
    };
  };

  programs.zsh = {
    enable = true;
    enableCompletion = true;
    syntaxHighlighting.enable = true;
    autosuggestion.enable = true;

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
      m = "micro";
      # nix-darwin (現在のログインユーザー名に合わせて構成を自動選択)
      drb = "export NIXPKGS_ALLOW_UNFREE=1 && sudo darwin-rebuild switch --flake ~/.config/home-manager#$(whoami) --impure";
    };

    initContent = ''
      # Nix configuration
      if [ -e '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh' ]; then
        . '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh'
      fi

      if [[ -r "''${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-''${(%):-%n}.zsh" ]]; then
        source "''${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-''${(%):-%n}.zsh"
      fi

      [[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

      zstyle ':completion:*:default' menu select=1
      zstyle ':completion:*:default' list-colors ''${(s.:.)LSCOLORS}

      zstyle ':completion:*:descriptions' format '[%d]'
      zstyle ':completion:*' list-colors ''${(s.:.)LS_COLORS}
      zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
      zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'

      zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}'

      source ${./zsh-functions.zsh}
    '';

    loginExtra = ''
      if [ -x /opt/homebrew/bin/brew ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
      fi
    '';
  };
}
