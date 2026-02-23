{ config, pkgs, ... }:

{
  homebrew.casks = [
    "1password"
    "gcloud-cli"
    "slack"
    "zoom"
  ];

  home-manager.users.${config.system.primaryUser} = {
    home.packages = with pkgs; [
      gettext
    ];
  };
}
