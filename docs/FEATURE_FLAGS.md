# Feature Flags Configuration

Kasia supports configurable feature flags to control third-party integrations, allowing for privacy-focused deployments and self-hosting scenarios.

## Environment Configuration

Features can be controlled at build time using environment variables:

### `VITE_ENABLED_FEATURES`

Controls which third-party features are available in the build.

**Available Features:**

- `gif` - GIF picker using Tenor API

**Examples:**

```bash
# Enable all features (default)
VITE_ENABLED_FEATURES=gif

# Disable all third-party features (maximum privacy)
VITE_ENABLED_FEATURES=none
# or
VITE_ENABLED_FEATURES=""

# Enable multiple features (comma-separated)
VITE_ENABLED_FEATURES=gif,future_feature
```

## Runtime Configuration

Users can toggle available features at runtime through the Settings page:

1. Go to Settings
2. Find "Third-Party Features" section
3. Toggle individual features on/off

**Important:** Users can only toggle features that were enabled at build time. If a feature is disabled via environment variables, it won't appear in the settings.

## For Self-Hosters

To create a completely privacy-focused build without any third-party dependencies:

```bash
# Build with no third-party features
VITE_ENABLED_FEATURES=none npm run build
```

This will:

- Remove all third-party API calls
- Hide feature toggle options in settings
- Display raw URLs instead of rich embeds
- Show a notice that third-party features are disabled

## Feature Details

### GIF Feature (`gif`)

- **Third-party service:** Tenor API
- **What it does:** Allows users to search and send GIFs in chat
- **When disabled:** GIF URLs show as plain text links
- **Privacy impact:** Sends search queries to Tenor servers

## Architecture

The feature flag system uses:

- **Build-time filtering:** Environment variables determine available features
- **Runtime toggling:** Users can enable/disable available features
- **Persistent storage:** User preferences are saved locally
- **Graceful degradation:** Features fall back to basic functionality when disabled
