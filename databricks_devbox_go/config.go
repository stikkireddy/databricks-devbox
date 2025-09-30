package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"

	"gopkg.in/yaml.v2"
)

// ExtensionGroup represents a group of VS Code extensions
type ExtensionGroup struct {
	Name         string                 `yaml:"name" json:"name"`
	Description  string                 `yaml:"description" json:"description"`
	Extensions   []string               `yaml:"extensions" json:"extensions"`
	UserSettings map[string]interface{} `yaml:"user_settings,omitempty" json:"user_settings,omitempty"`
}

// PortRange represents a range of ports
type PortRange struct {
	Start int `yaml:"start" json:"start"`
	End   int `yaml:"end" json:"end"`
}

// ServerConfig represents server configuration
type ServerConfig struct {
	DefaultPort         int       `yaml:"default_port" json:"default_port"`
	CodeServerPortRange PortRange `yaml:"code_server_port_range" json:"code_server_port_range"`
}

// UISettings represents UI behavior settings
type UISettings struct {
	AutoRefreshInterval int  `yaml:"auto_refresh_interval" json:"auto_refresh_interval"`
	ShowAdvancedOptions bool `yaml:"show_advanced_options" json:"show_advanced_options"`
	EnableDarkMode      bool `yaml:"enable_dark_mode" json:"enable_dark_mode"`
}

// WorkspaceConfig represents workspace initialization settings
type WorkspaceConfig struct {
	DefaultType           string   `yaml:"default_type" json:"default_type"`
	MaxUploadSizeMB       int      `yaml:"max_upload_size_mb" json:"max_upload_size_mb"`
	SupportedArchiveTypes []string `yaml:"supported_archive_types" json:"supported_archive_types"`
}

// UIConfig represents UI configuration
type UIConfig struct {
	DefaultExtensionGroups []string        `yaml:"default_extension_groups" json:"default_extension_groups"`
	Settings               UISettings      `yaml:"settings" json:"settings"`
	Workspace              WorkspaceConfig `yaml:"workspace" json:"workspace"`
}

// IconLink represents a clickable icon link in templates
type IconLink struct {
	LucideIcon string `yaml:"lucide_icon" json:"lucide_icon"`
	URL        string `yaml:"url" json:"url"`
}

// TemplateItem represents a template with all its configuration
type TemplateItem struct {
	Name            string     `yaml:"name" json:"name"`
	Description     string     `yaml:"description" json:"description"`
	ExtensionGroups []string   `yaml:"extensions_groups" json:"extensions_groups"`
	ThumbnailURL    string     `yaml:"thumbnail_url" json:"thumbnail_url"`
	GithubURL       string     `yaml:"github_url" json:"github_url"`
	IconLinks       []IconLink `yaml:"icon_links" json:"icon_links"`
}

// TemplateTab represents a tab containing templates
type TemplateTab struct {
	Name  string         `yaml:"name" json:"name"`
	Items []TemplateItem `yaml:"items" json:"items"`
}

// PackagedAssets represents the packaged assets configuration
type PackagedAssets struct {
	Tabs []TemplateTab `yaml:"tabs" json:"tabs"`
}

// DevboxConfig represents the complete configuration
type DevboxConfig struct {
	ExtensionGroups map[string]ExtensionGroup `yaml:"extension_groups" json:"extension_groups"`
	Server          ServerConfig              `yaml:"server" json:"server"`
	UI              UIConfig                  `yaml:"ui" json:"ui"`
	PackagedAssets  *PackagedAssets           `yaml:"packaged_assets,omitempty" json:"packaged_assets,omitempty"`
}

// Global config instance
var globalConfig *DevboxConfig

// getDefaultConfig returns the default configuration with hardcoded values
func getDefaultConfig() *DevboxConfig {
	return &DevboxConfig{
		ExtensionGroups: map[string]ExtensionGroup{
			"python": {
				Name:        "Python",
				Description: "Python development tools and language support",
				Extensions:  []string{"ms-python.python", "ms-pyright.pyright"},
				UserSettings: map[string]interface{}{
					"python.languageServer": "None",
				},
			},
			"jupyter": {
				Name:        "Jupyter",
				Description: "Jupyter notebook support and tools",
				Extensions: []string{
					"ms-toolsai.jupyter",
					"ms-toolsai.jupyter-renderers",
					"ms-toolsai.jupyter-keymap",
					"ms-toolsai.vscode-jupyter-cell-tags",
				},
			},
			"databricks": {
				Name:        "Databricks",
				Description: "Databricks platform integration and SQL tools",
				Extensions: []string{
					"databricks.databricks",
					"databricks.sqltools-databricks-driver",
				},
			},
			"api-explorer": {
				Name:        "API Explorer",
				Description: "REST API testing and exploration tools",
				Extensions:  []string{"rangav.vscode-thunder-client"},
			},
		},
		Server: ServerConfig{
			DefaultPort: 8000,
			CodeServerPortRange: PortRange{
				Start: 8010,
				End:   8100,
			},
		},
		UI: UIConfig{
			DefaultExtensionGroups: []string{"python", "jupyter"},
			Settings: UISettings{
				AutoRefreshInterval: 5000,
				ShowAdvancedOptions: false,
				EnableDarkMode:      true,
			},
			Workspace: WorkspaceConfig{
				DefaultType:           "empty",
				MaxUploadSizeMB:       100,
				SupportedArchiveTypes: []string{".zip", ".tar.gz"},
			},
		},
	}
}

// loadConfigFromFile loads configuration from a YAML file
func loadConfigFromFile(filename string) (*DevboxConfig, error) {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file %s: %v", filename, err)
	}

	var config DevboxConfig
	err = yaml.Unmarshal(data, &config)
	if err != nil {
		return nil, fmt.Errorf("failed to parse config file %s: %v", filename, err)
	}

	return &config, nil
}

// InitializeConfig initializes the global configuration
// It tries to load from the config file specified by DEVBOX_CONFIG_PATH environment variable
// If the file doesn't exist or there's an error, it falls back to the default configuration
func InitializeConfig() {
	configPath := os.Getenv("DEVBOX_CONFIG_PATH")

	if configPath == "" {
		// Default to app/devbox.yaml relative to the current working directory
		configPath = "app/devbox.yaml"
	}

	config, err := loadConfigFromFile(configPath)
	if err != nil {
		log.Printf("Warning: Failed to load config from %s: %v", configPath, err)
		log.Println("Using default configuration")
		config = getDefaultConfig()
	} else {
		log.Printf("Successfully loaded configuration from %s", configPath)

		// Validate the loaded config and fill in any missing values with defaults
		config = validateAndFillDefaults(config)
	}

	globalConfig = config
}

// validateAndFillDefaults validates the loaded config and fills in missing values with defaults
func validateAndFillDefaults(config *DevboxConfig) *DevboxConfig {
	defaults := getDefaultConfig()

	// Ensure at least one extension group exists
	if len(config.ExtensionGroups) == 0 {
		log.Println("Warning: No extension groups found in config, using defaults")
		config.ExtensionGroups = defaults.ExtensionGroups
	}

	// Fill in server defaults if missing
	if config.Server.DefaultPort == 0 {
		config.Server.DefaultPort = defaults.Server.DefaultPort
	}
	if config.Server.CodeServerPortRange.Start == 0 {
		config.Server.CodeServerPortRange = defaults.Server.CodeServerPortRange
	}

	// Fill in UI defaults if missing
	if len(config.UI.DefaultExtensionGroups) == 0 {
		config.UI.DefaultExtensionGroups = defaults.UI.DefaultExtensionGroups
	}
	if config.UI.Settings.AutoRefreshInterval == 0 {
		config.UI.Settings = defaults.UI.Settings
	}
	if config.UI.Workspace.DefaultType == "" {
		config.UI.Workspace = defaults.UI.Workspace
	}

	return config
}

// GetConfig returns the global configuration
func GetConfig() *DevboxConfig {
	if globalConfig == nil {
		log.Println("Warning: Config not initialized, using defaults")
		return getDefaultConfig()
	}
	return globalConfig
}

// ReloadConfig reloads the configuration from file
func ReloadConfig() error {
	configPath := os.Getenv("DEVBOX_CONFIG_PATH")
	if configPath == "" {
		configPath = "app/devbox.yaml"
	}

	config, err := loadConfigFromFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to reload config: %v", err)
	}

	globalConfig = validateAndFillDefaults(config)
	log.Printf("Configuration reloaded from %s", configPath)
	return nil
}
