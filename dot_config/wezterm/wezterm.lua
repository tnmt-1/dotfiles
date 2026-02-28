-- Pull in the wezterm API
local wezterm = require 'wezterm'
local act = wezterm.action

-- This will hold the configuration.
local config = wezterm.config_builder()

-- This is where you actually apply your config choices.

-- For example, changing the initial geometry for new windows:
-- config.initial_cols = 100
-- config.initial_rows = 24

-- or, changing the font size and color scheme.
config.font_size = 16
config.color_scheme = 'Catppuccin Mocha'

---------------------------
-- my custom
---------------------------
--config.font = wezterm.font("FirgeNerd Console", { weight = 'Regular' })
config.font = wezterm.font_with_fallback { 'JetBrains Mono', '源柔ゴシックL', 'FirgeNerd Console' }
config.use_ime = true
config.automatically_reload_config = true
config.window_background_opacity = 0.85
config.macos_window_background_blur = 10

-- 左右どちらの Option も「記号合成せず、普通の Alt(meta)」として扱いたい場合
config.send_composed_key_when_left_alt_is_pressed  = false
config.send_composed_key_when_right_alt_is_pressed = false

-- パネル分割
config.leader = { key = 'a', mods = 'CTRL', timeout_milliseconds = 1000 }
config.keys = {
  -- 横方向に分割（左右に並ぶ）
  { key = 'RightArrow', mods = 'LEADER', action = act.SplitHorizontal { domain = 'CurrentPaneDomain' } },

  -- 縦方向に分割（上下に並ぶ）
  { key = 'DownArrow', mods = 'LEADER', action = act.SplitVertical { domain = 'CurrentPaneDomain' } },
}

-- Finally, return the configuration to wezterm:
return config
