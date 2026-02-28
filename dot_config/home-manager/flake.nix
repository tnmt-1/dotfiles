{
  description = "nix-darwin & home-manager configuration of tnmt";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    nix-darwin = {
      url = "github:LnL7/nix-darwin";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, nix-darwin, home-manager, ... }:
    let
      mkDarwinConfig = { user, extraModules }: nix-darwin.lib.darwinSystem {
        system = "aarch64-darwin";
        modules = [
          ({ pkgs, ... }: {
            # Necessary for using flakes on this system.
            nix.settings.experimental-features = "nix-command flakes";

            nixpkgs.config.allowUnfree = true;

            # Create /etc/zshrc that loads the nix-daemon environment.
            programs.zsh.enable = true;

            # Set Git commit hash for darwin-version.
            system.configurationRevision = self.rev or self.dirtyRev or null;

            # Used for backwards compatibility, please read the changelog before changing.
            # $ darwin-rebuild changelog
            system.stateVersion = 5;

            # The platform the configuration will be used on.
            nixpkgs.hostPlatform = "aarch64-darwin";

            system.primaryUser = user;
            users.users.${user}.home = "/Users/${user}";

            homebrew = {
              enable = true;
              onActivation.cleanup = "zap";
              onActivation.autoUpdate = true;
              onActivation.upgrade = true;
              brews = [
                "mysql@8.0"
                "difi"
                "gettext"
                "glow"
              ];
              casks = [
                "alt-tab"
                "antigravity"
                "appcleaner"
                "clipy"
                "comet"
                "coteditor"
                "dbeaver-community"
                "drawio"
                "firefox"
                "floorp"
                "ghostty"
                "google-chrome"
                "google-japanese-ime"
                "karabiner-elements"
                "kiro"
                "mongodb-compass"
                "notion"
                "obsidian"
                "raycast"
                "smoothcsv"
                "visual-studio-code"
                "vivaldi"
                "wezterm"
                "zed"
                "cmux"
              ];
            };
          })
          home-manager.darwinModules.home-manager
          {
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
            home-manager.users.${user} = {
              imports = [ ./home.nix ];
              home.username = user;
              home.homeDirectory = "/Users/${user}";
            };
          }
        ] ++ extraModules;
      };
    in
    {
      darwinConfigurations.tnmt = mkDarwinConfig {
        user = "tnmt";
        extraModules = [ ./tnmt.nix ];
      };
      darwinConfigurations.mah = mkDarwinConfig {
        user = "mah";
        extraModules = [ ./mah.nix ];
      };
    };
}
