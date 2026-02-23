{ config, pkgs, ... }:

{
  home.stateVersion = "25.11";

  imports = [
    ./common.nix
  ];

  # Let Home Manager install and manage itself.
  programs.home-manager.enable = true;
}
