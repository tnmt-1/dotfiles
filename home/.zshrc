if [[ -f ~/.config/zsh/.zshrc ]]; then
    source ~/.config/zsh/.zshrc
fi

#[[ ":$PATH:" != *":$HOME/.config/kaku/zsh/bin:"* ]] && export PATH="$HOME/.config/kaku/zsh/bin:$PATH" # Kaku PATH Integration
#[[ -f "$HOME/.config/kaku/zsh/kaku.zsh" ]] && source "$HOME/.config/kaku/zsh/kaku.zsh" # Kaku Shell Integration
