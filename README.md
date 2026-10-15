# BugSink — Claude Code Plugin

MCP server and Claude Code plugin for [BugSink](https://bugsink.com) error tracking. Query issues, analyze stacktraces, set up SDKs, and fix production bugs — all from Claude Code.

## Install from Sols Marketplace (recommended)

Add the Sols marketplace and install the plugin:

```
/plugin marketplace add solsmk/bugsink
/plugin install bugsink@sols-plugins
```

### Auto-install for your team

Add to your project's `.claude/settings.json` so teammates get prompted automatically:

```json
{
  "extraKnownMarketplaces": {
    "sols-plugins": {
      "source": {
        "source": "github",
        "repo": "solsmk/bugsink"
      }
    }
  },
  "enabledPlugins": {
    "bugsink@sols-plugins": true
  }
}
```

## Alternative: Install as standalone plugin

```bash
claude --plugin-dir /path/to/bugsink
```

## Alternative: MCP server only

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "bugsink": {
      "command": "npx",
      "args": ["-y", "bugsink-mcp-server"],
      "env": {
        "BUGSINK_URL": "https://your-bugsink-instance.com",
        "BUGSINK_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BUGSINK_TOKEN` | Yes | - | Your BugSink API token |
| `BUGSINK_URL` | Yes | — | BugSink instance URL (e.g. `https://bugsink.example.com`) |

## MCP Tools (13)

### Read Tools

| Tool | Description |
|------|-------------|
| `list_projects` | List all projects (optional `team_id` filter) |
| `list_issues` | List issues for a project — compact projection by default, `limit` (default 25) + `cursor` paging, `compact:false` for raw rows |
| `get_issue` | Get issue details by ID |
| `list_events` | List events (occurrences) for an issue |
| `get_event` | Get full event data including context |
| `get_stacktrace` | Get formatted stacktrace markdown |
| `list_teams` | List all teams |
| `get_team` | Get team details by UUID |
| `list_releases` | List releases for a project |
| `get_release` | Get release details by ID |

### Write Tools

| Tool | Description |
|------|-------------|
| `create_team` | Create a new team `{name}` |
| `create_project` | Create a project `{team: UUID, name}` |
| `create_release` | Create a release `{project: integer, version}` |

## Commands (8)

Slash commands you can invoke directly. All are also available as agent skills (Claude auto-invokes them based on context).

| Command | Description |
|---------|-------------|
| `/bugsink:fix-issues` | 7-phase workflow to investigate and fix production errors |
| `/bugsink:workflow` | Router that directs you to the right command |
| `/bugsink:code-review` | Cross-reference code changes against known errors |
| `/bugsink:sdk-setup` | General Sentry-compatible SDK configuration |
| `/bugsink:nextjs-sdk` | `@sentry/nextjs` setup for Next.js apps |
| `/bugsink:nodejs-sdk` | `@sentry/node` setup for Node.js/Express apps |
| `/bugsink:create-alert` | Configure email, Slack, Discord, Mattermost alerts |
| `/bugsink:sdk-upgrade` | Upgrade Sentry SDK versions with migration guidance |

## Usage Examples

```
# Ask Claude to fix a production error
/bugsink:fix-issues

# Set up error tracking in your Next.js app
/bugsink:nextjs-sdk

# Review your PR against known errors
/bugsink:code-review

# Or use MCP tools directly
"Show me recent errors from BugSink"
"Get the stacktrace for the latest error"
"Create a new release for project 3"
```

## Installation (npm only)

If you just want the MCP server without the plugin:

```bash
# Via npx (recommended)
npx -y bugsink-mcp-server

# Global install
npm install -g bugsink-mcp-server
```

## Docker

```bash
docker build -t bugsink-mcp .
docker run -e BUGSINK_TOKEN=your-token bugsink-mcp
```

## Development

```bash
npm install
npm run dev    # Watch mode
```

## License

MIT
