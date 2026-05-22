# 端末固有の alias を管理する
alias kabep='ssh kabe -D localhost:1080 -N -C tnmt@kabe.beproud.jp'
alias spectacular='cd src && poetry run python manage.py makemessages -l ja && poetry run python manage.py makemessages -l en && poetry run python manage.py compilemessages && poetry run python manage.py spectacular --file ../schema.yml && cd ../'
alias upup="brew update && brew upgrade && brew autoremove && mise up"
