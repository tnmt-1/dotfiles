# ~/.config/zsh/prompt.zsh

# Pythonのvirtualenvでプロンプトが汚染されるのを防ぐ
export VIRTUAL_ENV_DISABLE_PROMPT=1

eval "$(starship init zsh)"
