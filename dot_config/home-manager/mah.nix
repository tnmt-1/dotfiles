{ config, ... }:

{
  homebrew.casks = [
    # 個人用のみで使いたい Cask があればここに追加
  ];

  home-manager.users.${config.system.primaryUser} = {
    home.packages = [
      # 個人用のみで使いたい CLI パッケージがあればここに追加
    ];
  };
}
