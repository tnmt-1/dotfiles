-- Pull in the wezterm API
local wezterm = require 'wezterm'

-- This will hold the configuration.
local config = wezterm.config_builder()

-- This is where you actually apply your config choices.

-- For example, changing the initial geometry for new windows:
-- config.initial_cols = 100
-- config.initial_rows = 24

-- or, changing the font size and color scheme.
config.font_size = 16
config.color_scheme = 'Catppuccin Mocha'

-- my custom
config.font = wezterm.font("FirgeNerd Console")
config.use_ime = true
config.automatically_reload_config = true
config.window_background_opacity = 0.85
config.macos_window_background_blur = 10
-- config.default_prog = { '/opt/homebrew/bin/nu' }
config.default_prog = { '/bin/zsh', '--login', '-c', 'exec /opt/homebrew/bin/nu' }

-- Finally, return the configuration to wezterm:
return config
