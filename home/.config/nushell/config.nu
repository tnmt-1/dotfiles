# config.nu
# fish の config.fish / conf.d/*.fish を移植。
# $env.config はフィールド単位で設定する(mise の hook を上書きしないため)。

# =========================================================
# Completion
# =========================================================
# fish の fzf に近いファジー補完にする
$env.config.completions.algorithm = "fuzzy"
$env.config.completions.case_sensitive = false

# =========================================================
# Aliases / Functions
# =========================================================
source ~/.config/nushell/aliases.nu
source ~/.config/nushell/aliases.local.nu
