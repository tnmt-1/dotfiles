abbr -a reload "exec $SHELL -l"
abbr -a apap "brew update && brew upgrade && mise up && brew cleanup"

abbr -a ls "eza $eza_params"
abbr -a l "eza --git-ignore $eza_params"
abbr -a ll "eza --all --header --long $eza_params"
abbr -a llm "eza --all --header --long --sort=modified $eza_params"
abbr -a la "eza -lbhHigUmuSa"
abbr -a lx "eza -lbhHigUmuSa@"
abbr -a lt "eza --tree $eza_params"
abbr -a tree "eza --tree $eza_params"

