# ~/.config/fish/config.fish
# ~/.config/zsh/.zshrc と同期している(zshが真)。
# Uses:
#   Plugins:      fisher (gitignore)
#   Prompt:       starship
#   Navigation:   zoxide, fzf, fd
#   CLI tools:    eza, bat, nvim, ripgrep

# =========================================================
# Paths
# =========================================================

fish_add_path -g ~/.local/bin

# opencode
fish_add_path -g ~/.opencode/bin

if status is-interactive
    # =========================================================
    # Smart directory navigation
    # =========================================================

    fzf --fish | source
    zoxide init fish | source
    mise activate fish | source

    # omp completions は出力が決定論的なのでキャッシュして読み込む（初回のみ生成）
    set -l _omp_comp $XDG_CACHE_HOME/fish/omp-completions.fish
    if command -q omp
        if not test -f $_omp_comp; or test (command -v omp) -nt $_omp_comp
            mkdir -p (dirname $_omp_comp)
            omp completions fish >$_omp_comp
        end
    end
    if test -f $_omp_comp
        source $_omp_comp
    end

    # =========================================================
    # Prompt/theme
    # =========================================================

    # プロンプトは fish 標準のものを使う(starshipはzshのみ)
    # Pythonのvirtualenvでプロンプトが汚染されるのを防ぐ
    set -gx VIRTUAL_ENV_DISABLE_PROMPT 1
end
