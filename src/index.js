#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Configuration from environment
const BUGSINK_URL = process.env.BUGSINK_URL;
const BUGSINK_TOKEN = process.env.BUGSINK_TOKEN;

if (!BUGSINK_URL || !BUGSINK_TOKEN) {
  console.error(
    "Error: BUGSINK_URL and BUGSINK_TOKEN environment variables are required " +
      "(e.g. BUGSINK_URL=https://bugsink.example.com)",
  );
  process.exit(1);
}

// Bugsink API client
class BugsinkClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  async request(endpoint, params = {}, { method = "GET", body } = {}) {
    const url = new URL(`${this.baseUrl}/api/canonical/0${endpoint}`);
    if (method === "GET") {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.append(key, value);
      });
    }

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    };

    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      throw new Error(
        `Bugsink API error: ${response.status} ${response.statusText}`,
      );
    }

    // Check if response is JSON or text (stacktrace endpoint returns markdown)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return response.json();
    }
    return response.text();
  }

  // Projects
  async listProjects(teamId) {
    const params = {};
    if (teamId) params.team = teamId;
    return this.request("/projects/", params);
  }

  async createProject(data) {
    return this.request("/projects/", {}, { method: "POST", body: data });
  }

  // Issues
  async listIssues(projectId, options = {}) {
    return this.request("/issues/", {
      project: projectId,
      order: options.order || "desc",
      sort: options.sort || "digest_order",
      cursor: options.cursor,
    });
  }

  async getIssue(issueId) {
    return this.request(`/issues/${issueId}/`);
  }

  // Events
  async listEvents(issueId, options = {}) {
    return this.request("/events/", {
      issue: issueId,
      order: options.order || "desc",
      cursor: options.cursor,
    });
  }

  async getEvent(eventId) {
    return this.request(`/events/${eventId}/`);
  }

  async getStacktrace(eventId) {
    return this.request(`/events/${eventId}/stacktrace/`);
  }

  // Teams
  async listTeams() {
    return this.request("/teams/");
  }

  async getTeam(teamId) {
    return this.request(`/teams/${teamId}/`);
  }

  async createTeam(data) {
    return this.request("/teams/", {}, { method: "POST", body: data });
  }

  // Releases
  async listReleases(projectId) {
    return this.request("/releases/", { project: projectId });
  }

  async getRelease(releaseId) {
    return this.request(`/releases/${releaseId}/`);
  }

  async createRelease(data) {
    return this.request("/releases/", {}, { method: "POST", body: data });
  }
}

// Initialize client
const client = new BugsinkClient(BUGSINK_URL, BUGSINK_TOKEN);

// ---- response shaping ----------------------------------------------------
// Bugsink pages are a fixed 250 items with no server-side page size, and a raw
// page is ~200 KB of JSON — enough to blow an agent's context in one call.
// Tools therefore default to a compact projection + client-side limit.

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n) + "…" : s);

const compactIssue = (it) => ({
  id: it.id,
  friendly_id: it.friendly_id,
  type: it.calculated_type,
  value: truncate((it.calculated_value ?? "").replace(/\s+/g, " "), 160),
  transaction: it.transaction,
  count: it.digested_event_count,
  first_seen: it.first_seen,
  last_seen: it.last_seen,
  resolved: it.is_resolved,
  muted: it.is_muted,
});

const compactEventRow = (ev) => ({
  id: ev.id,
  event_id: ev.event_id,
  timestamp: ev.timestamp,
  digest_order: ev.digest_order,
});

// MCP SDK does not enforce inputSchema types — coerce and fall back so a
// garbage limit can never NaN-slice a page into an empty "complete" result.
const clampLimit = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(1, Math.min(n, 250)) : fallback;
};

// Extract the cursor token from a DRF next-page URL.
const cursorFrom = (nextUrl) => {
  if (!nextUrl) return null;
  try {
    return new URL(nextUrl).searchParams.get("cursor");
  } catch {
    return null;
  }
};

// Slice a page and attach honest pagination: a mid-page slice cannot be
// resumed with the server cursor, so next_cursor is only returned for
// whole pages. "No next page" and "next URL unparseable" are distinguished —
// the latter gets a warning note instead of silently looking like completion.
function shapePage(page, { limit, mapRow }) {
  const rows = page.results ?? [];
  const shown = rows.slice(0, limit).map(mapRow);
  if (rows.length > limit) {
    return {
      items: shown,
      total_in_page: rows.length,
      note: `showing ${shown.length} of ${rows.length} items in this page; raise limit to 250 to page onward with next_cursor`,
    };
  }
  const next_cursor = cursorFrom(page.next);
  const out = { items: shown, total_in_page: rows.length, next_cursor };
  if (page.next && !next_cursor) {
    out.note =
      "a next page exists but its cursor could not be parsed from the API's next URL — pagination may be truncated";
  }
  return out;
}
// ---------------------------------------------------------------------------

// Create MCP server
const server = new Server(
  {
    name: "bugsink-mcp-server",
    version: "2.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Define tools
const TOOLS = [
  {
    name: "list_projects",
    description: "List all projects in Bugsink. Optionally filter by team.",
    inputSchema: {
      type: "object",
      properties: {
        team_id: {
          type: "string",
          description: "Optional team UUID to filter projects by team",
        },
      },
      required: [],
    },
  },
  {
    name: "list_issues",
    description:
      "List issues for a project. Returns a COMPACT projection by default (id, friendly_id, type, truncated value, transaction, count, first/last seen, resolved/muted) limited to 25 items — a raw Bugsink page is 250 items / ~200 KB and will blow your context. Use limit (max 250) for more, cursor to page (next_cursor is returned only for un-sliced pages), compact:false for raw rows.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "integer",
          description: "The project ID (integer) to list issues for",
        },
        sort: {
          type: "string",
          enum: ["last_seen", "digest_order"],
          description: "Sort order (default: digest_order)",
        },
        order: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Order direction (default: desc)",
        },
        limit: {
          type: "integer",
          description:
            "Max issues to return from the fetched page (default 25, max 250). Values < 250 slice the page, which disables next_cursor.",
        },
        cursor: {
          type: "string",
          description: "Pagination cursor from a previous call's next_cursor",
        },
        compact: {
          type: "boolean",
          description: "Compact projection (default true). false returns raw API rows.",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "get_issue",
    description:
      "Get details of a specific issue including error message and metadata",
    inputSchema: {
      type: "object",
      properties: {
        issue_id: {
          type: "string",
          description: "The issue ID to retrieve",
        },
      },
      required: ["issue_id"],
    },
  },
  {
    name: "list_events",
    description:
      "List events (occurrences) for an issue, compact rows (id, event_id, timestamp, digest_order), default limit 20. Pass an event's `id` to get_stacktrace/get_event.",
    inputSchema: {
      type: "object",
      properties: {
        issue_id: {
          type: "string",
          description: "The issue ID to list events for",
        },
        order: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Order direction (default: desc)",
        },
        limit: {
          type: "integer",
          description:
            "Max events to return from the fetched page (default 20, max 250). Values < 250 slice the page, which disables next_cursor.",
        },
        cursor: {
          type: "string",
          description: "Pagination cursor from a previous call's next_cursor",
        },
        compact: {
          type: "boolean",
          description: "Compact rows (default true). false returns raw API rows.",
        },
      },
      required: ["issue_id"],
    },
  },
  {
    name: "get_event",
    description:
      "Get details of a specific event. By default strips the bulky payload keys (breadcrumbs, debug_meta, modules, extra) — pass compact:false for the complete payload. For diagnosing WHERE an error occurred, prefer get_stacktrace.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "The event ID to retrieve",
        },
        compact: {
          type: "boolean",
          description:
            "Strip bulky keys (default true). false returns the full error data payload.",
        },
      },
      required: ["event_id"],
    },
  },
  {
    name: "get_stacktrace",
    description:
      "Get the stacktrace for an event as formatted markdown. Best for understanding where an error occurred.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "The event ID to get stacktrace for",
        },
      },
      required: ["event_id"],
    },
  },
  {
    name: "list_teams",
    description: "List all teams in Bugsink",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_team",
    description: "Get details of a specific team",
    inputSchema: {
      type: "object",
      properties: {
        team_id: {
          type: "string",
          description: "The team UUID to retrieve",
        },
      },
      required: ["team_id"],
    },
  },
  {
    name: "create_team",
    description: "Create a new team in Bugsink",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the new team",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "create_project",
    description: "Create a new project in Bugsink",
    inputSchema: {
      type: "object",
      properties: {
        team: {
          type: "string",
          description: "Team UUID to create the project under",
        },
        name: {
          type: "string",
          description: "Name for the new project",
        },
      },
      required: ["team", "name"],
    },
  },
  {
    name: "list_releases",
    description: "List releases for a project",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "integer",
          description: "The project ID (integer) to list releases for",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "get_release",
    description: "Get details of a specific release",
    inputSchema: {
      type: "object",
      properties: {
        release_id: {
          type: "string",
          description: "The release ID to retrieve",
        },
      },
      required: ["release_id"],
    },
  },
  {
    name: "create_release",
    description: "Create a new release for a project",
    inputSchema: {
      type: "object",
      properties: {
        project: {
          type: "integer",
          description: "The project ID (integer) for the release",
        },
        version: {
          type: "string",
          description: "Version string for the release (e.g. '1.0.0')",
        },
      },
      required: ["project", "version"],
    },
  },
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case "list_projects":
        result = await client.listProjects(args.team_id);
        break;

      case "list_issues": {
        const page = await client.listIssues(args.project_id, {
          sort: args.sort,
          order: args.order,
          cursor: args.cursor,
        });
        const limit = clampLimit(args.limit, 25);
        const mapRow = args.compact === false ? (x) => x : compactIssue;
        const { items, ...meta } = shapePage(page, { limit, mapRow });
        result = { issues: items, ...meta };
        break;
      }

      case "get_issue":
        result = await client.getIssue(args.issue_id);
        break;

      case "list_events": {
        const page = await client.listEvents(args.issue_id, {
          order: args.order,
          cursor: args.cursor,
        });
        const limit = clampLimit(args.limit, 20);
        const mapRow = args.compact === false ? (x) => x : compactEventRow;
        const { items, ...meta } = shapePage(page, { limit, mapRow });
        result = { events: items, ...meta };
        break;
      }

      case "get_event": {
        result = await client.getEvent(args.event_id);
        if (args.compact !== false && result && typeof result === "object" && result.data) {
          const stripped = [];
          for (const key of ["breadcrumbs", "debug_meta", "modules", "extra"]) {
            if (result.data[key] !== undefined) {
              delete result.data[key];
              stripped.push(key);
            }
          }
          if (stripped.length) {
            result._compact_note = `stripped bulky keys: ${stripped.join(", ")} — pass compact:false for the full payload (get_stacktrace is usually the better tool for diagnosis)`;
          }
        }
        break;
      }

      case "get_stacktrace":
        result = await client.getStacktrace(args.event_id);
        // Stacktrace is already markdown text
        return {
          content: [{ type: "text", text: result }],
        };

      case "list_teams":
        result = await client.listTeams();
        break;

      case "get_team":
        result = await client.getTeam(args.team_id);
        break;

      case "create_team":
        result = await client.createTeam({ name: args.name });
        break;

      case "create_project":
        result = await client.createProject({
          team: args.team,
          name: args.name,
        });
        break;

      case "list_releases":
        result = await client.listReleases(args.project_id);
        break;

      case "get_release":
        result = await client.getRelease(args.release_id);
        break;

      case "create_release":
        result = await client.createRelease({
          project: args.project,
          version: args.version,
        });
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    // Format JSON result
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bugsink MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
