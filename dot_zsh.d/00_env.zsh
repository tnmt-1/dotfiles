# パス設定
typeset -U path PATH
path=(
    /opt/homebrew/bin(N-/)
    /usr/local/bin(N-/)
    $path
)

# change 'ls' color
export CLICOLOR=1;
export LSCOLORS=gxfxcxdxbxegedabagacad;
export LS_COLORS="di=36:ln=35:so=32:pi=33:ex=31:bd=34;46:cd=34;43:su=30;41:sg=30;46:tw=30;42:ow=30;43:"

# colima
export DOCKER_HOST="unix:///Users/$USER/.colima/default/docker.sock"

# Added by Antigravity
export PATH="/Users/tnmt/.antigravity/antigravity/bin:$PATH"

# nushell使うために必要な環境変数
export XDG_CONFIG_HOME="$HOME/.config"

# 日本語
export LANG=ja_JP.UTF-8

