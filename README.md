# mcp-weather-gov

Get NWS weather forecasts, alerts, hourly conditions, and station data for US locations.

> **Free API** — No API key required.

## Tools

| Tool | Description |
|------|-------------|
| `get_forecast` | Get 7-day forecast for a location (US only). |
| `get_hourly_forecast` | Get hourly forecast for a location. |
| `get_alerts` | Get active weather alerts for a state or area. |
| `get_stations` | Find weather observation stations near a point. |
| `get_current_conditions` | Get current weather observations from nearest station. |

## Installation

```bash
git clone https://github.com/PetrefiedThunder/mcp-weather-gov.git
cd mcp-weather-gov
npm install
npm run build
```

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "weather-gov": {
      "command": "node",
      "args": ["/path/to/mcp-weather-gov/dist/index.js"]
    }
  }
}
```

## Usage with npx

```bash
npx mcp-weather-gov
```

## License

MIT
