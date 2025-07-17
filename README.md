# GitHub MCP Server

A comprehensive Model Context Protocol (MCP) server built on Cloudflare Workers that provides secure access to GitHub repositories, organizations, and project management features. This server enables AI assistants to interact with GitHub data through OAuth-based authentication.

## 🚀 Features

### Repository Management
- **Organization Repositories**: List and explore all repositories within GitHub organizations
- **Repository Details**: Get comprehensive information about specific repositories including recent activity
- **Commit History**: Access detailed commit history with filtering by author, date range, and branch
- **Contributor Analytics**: Analyze contributor statistics and contributions

### Project Management (GitHub Projects v2)
- **Project Discovery**: List all organization projects with visibility controls
- **Project Details**: Complete project information including tasks, fields, and custom assignees
- **Task Management**: Access all project items (issues, PRs, draft issues) with custom field support
- **Progress Tracking**: Monitor project status and item completion

### Search & Discovery
- **Cross-Repository Search**: Search issues and pull requests across all organization repositories
- **Activity Monitoring**: Track recent activity across organization repositories
- **Advanced Filtering**: Filter by state, author, labels, and custom criteria

### Additional Features
- **AI Image Generation**: Generate images using Flux-1-Schnell model (restricted access)
- **Performance Optimization**: Built-in caching and rate limit handling
- **Comprehensive Error Handling**: User-friendly error messages and debugging

## 🏗️ Architecture

### Technology Stack
- **Runtime**: Cloudflare Workers for serverless execution
- **Storage**: Cloudflare KV for OAuth token storage
- **State Management**: Cloudflare Durable Objects for session persistence
- **Authentication**: GitHub OAuth 2.0 with secure token handling
- **Framework**: Hono.js for HTTP routing and middleware
- **AI**: Cloudflare AI Workers for image generation

### Core Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │────│   OAuth Flow    │────│  GitHub API     │
│   (Claude/AI)   │    │   (Cloudflare)  │    │  (GitHub.com)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Server    │────│   KV Storage    │────│  Durable Objects│
│   (This App)    │    │   (Tokens)      │    │   (Sessions)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📦 Installation & Setup

### Prerequisites
- **Node.js** 18 or higher
- **Cloudflare Account** with Workers plan
- **GitHub Account** for OAuth app creation
- **Wrangler CLI** installed globally

### 1. Initial Setup
```bash
# Clone the repository
git clone <repository-url>
cd team-mcp

# Install dependencies
npm install

# Login to Cloudflare
wrangler login
```

### 2. GitHub OAuth App Configuration
1. Navigate to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: `Your MCP Server`
   - **Homepage URL**: `https://team-mcp.your-subdomain.workers.dev`
   - **Authorization callback URL**: `https://team-mcp.your-subdomain.workers.dev/callback`
4. Save the **Client ID** and generate a **Client Secret**

### 3. Cloudflare Resources Setup
```bash
# Create KV namespace for OAuth tokens
wrangler kv:namespace create "OAUTH_KV"

# Generate encryption key for cookies
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 4. Environment Configuration
Update your `wrangler.jsonc` with the OAuth credentials:

```json
{
  "name": "team-mcp",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-10",
  "vars": {
    "GITHUB_CLIENT_ID": "your-github-client-id",
    "GITHUB_CLIENT_SECRET": "your-github-client-secret", 
    "COOKIE_ENCRYPTION_KEY": "your-base64-encryption-key"
  },
  "kv_namespaces": [
    {
      "binding": "OAUTH_KV",
      "id": "your-kv-namespace-id"
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "class_name": "MyMCP",
        "name": "MCP_OBJECT"
      }
    ]
  }
}
```

### 5. Deployment
```bash
# Deploy to Cloudflare Workers
npm run deploy

# Verify deployment
curl -I https://team-mcp.your-subdomain.workers.dev/sse
```

## 🔧 Usage

### Connecting with MCP Inspector
The fastest way to test your deployment:

```bash
# Install and run MCP Inspector
npx @modelcontextprotocol/inspector@latest
```

Enter your server URL: `https://team-mcp.your-subdomain.workers.dev/sse`

### Connecting with Claude Desktop
Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://team-mcp.your-subdomain.workers.dev/sse"
      ]
    }
  }
}
```

### Connecting with Cursor
In Cursor's MCP settings, add:
- **Type**: Command
- **Command**: `npx mcp-remote https://team-mcp.your-subdomain.workers.dev/sse`

## 🛠️ Available Tools

### Repository Tools

#### `listOrganizationRepos`
Lists all repositories for a GitHub organization with comprehensive filtering options.

**Parameters:**
- `organization` (string): GitHub organization name (e.g., "ethereumfollowprotocol")
- `includePrivate` (boolean, default: true): Include private repositories
- `sortBy` (enum, default: "updated"): Sort by "name", "updated", "created", or "pushed"
- `limit` (number, default: 50): Maximum number of repositories to return

**Example Usage:**
```javascript
// List recent repositories for an organization
{
  "organization": "ethereumfollowprotocol",
  "includePrivate": true,
  "sortBy": "updated",
  "limit": 25
}
```

#### `getRepositoryDetails`
Retrieves comprehensive information about a specific repository including recent activity.

**Parameters:**
- `owner` (string): Repository owner (username or organization)
- `repo` (string): Repository name
- `includeCommits` (boolean, default: true): Include recent commits
- `includeIssues` (boolean, default: true): Include recent issues
- `includePRs` (boolean, default: true): Include recent pull requests
- `days` (number, default: 30): Number of days to look back for activity

#### `getCommitHistory`
Fetches detailed commit history with advanced filtering capabilities.

**Parameters:**
- `owner` (string): Repository owner
- `repo` (string): Repository name
- `since` (string, optional): ISO 8601 date to start from
- `until` (string, optional): ISO 8601 date to end at
- `branch` (string, optional): Specific branch (defaults to default branch)
- `author` (string, optional): Filter by author username or email
- `limit` (number, default: 50): Maximum number of commits to return

#### `getContributorStats`
Analyzes contributor statistics and contributions for a repository.

**Parameters:**
- `owner` (string): Repository owner
- `repo` (string): Repository name
- `limit` (number, default: 50): Maximum number of contributors to return

### Activity & Search Tools

#### `getRecentActivity`
Monitors recent activity across all repositories in an organization.

**Parameters:**
- `organization` (string): GitHub organization name
- `days` (number, default: 7): Number of days to look back for activity
- `includePrivate` (boolean, default: true): Include private repositories
- `limit` (number, default: 20): Maximum number of repositories to show

#### `searchIssuesAndPRs`
Searches for issues and pull requests across all organization repositories.

**Parameters:**
- `organization` (string): GitHub organization name
- `query` (string): Search query (supports GitHub search syntax)
- `state` (enum, default: "all"): Filter by "open", "closed", or "all"
- `limit` (number, default: 50): Maximum number of results to return

**Search Query Examples:**
- `"bug"` - Find issues/PRs containing "bug"
- `"author:username"` - Find items by specific author
- `"label:urgent"` - Find items with "urgent" label
- `"is:pr is:open"` - Find open pull requests

### Project Management Tools

#### `listOrganizationProjects`
Lists all GitHub Projects v2 for an organization.

**Parameters:**
- `organization` (string): GitHub organization name
- `includePrivate` (boolean, default: true): Include private projects
- `limit` (number, default: 50): Maximum number of projects to return

#### `getProjectDetails`
Retrieves comprehensive information about a GitHub Projects v2 board.

**Parameters:**
- `projectId` (string): GitHub project ID (obtained from `listOrganizationProjects`)
- `includeFields` (boolean, default: true): Include custom field information
- `includeItems` (boolean, default: true): Include all project items
- `limit` (number, default: 100): Maximum number of items to return

**Features:**
- Custom field support (including assignees stored as custom fields)
- Issue, PR, and draft issue handling
- Field value extraction and formatting
- Complete project metadata

### Utility Tools

#### `userInfoOctokit`
Returns authenticated user information from GitHub.

**Parameters:** None

**Returns:** Complete GitHub user profile information

#### `generateImage` (Restricted Access)
Generates images using Cloudflare's Flux-1-Schnell model.

**Parameters:**
- `prompt` (string): Text description of the image to generate
- `steps` (number, 4-8, default: 4): Number of diffusion steps for quality

**Access Control:** Only available to users listed in the `ALLOWED_USERNAMES` configuration.

## 📚 Practical Examples

### Repository Analysis
```javascript
// Get organization overview
const repos = await listOrganizationRepos({
  organization: "ethereumfollowprotocol",
  sortBy: "updated",
  limit: 10
});

// Deep dive into a specific repository
const details = await getRepositoryDetails({
  owner: "ethereumfollowprotocol",
  repo: "api",
  days: 14
});

// Analyze contributor patterns
const contributors = await getContributorStats({
  owner: "ethereumfollowprotocol",
  repo: "api",
  limit: 20
});
```

### Project Management
```javascript
// List all organization projects
const projects = await listOrganizationProjects({
  organization: "ethereumfollowprotocol"
});

// Get detailed project information
const projectDetails = await getProjectDetails({
  projectId: "PVT_kwDOABCD123",
  includeItems: true,
  limit: 50
});
```

### Issue Tracking
```javascript
// Find all open bugs
const bugs = await searchIssuesAndPRs({
  organization: "ethereumfollowprotocol",
  query: "bug is:issue is:open",
  limit: 25
});

// Monitor recent activity
const activity = await getRecentActivity({
  organization: "ethereumfollowprotocol",
  days: 7
});
```

## 🔒 Security & Authentication

### OAuth Flow
1. **Client Request**: MCP client connects to `/sse` endpoint
2. **Authentication Challenge**: Server responds with OAuth challenge
3. **GitHub Authorization**: User redirected to GitHub OAuth
4. **Token Exchange**: Authorization code exchanged for access token
5. **Session Creation**: Authenticated session established
6. **API Access**: GitHub API calls made with user's permissions

### Security Features
- **Encrypted Token Storage**: All tokens encrypted in Cloudflare KV
- **Secure Cookie Handling**: HTTP-only, secure cookies with encryption
- **Rate Limit Management**: Built-in GitHub API rate limit handling
- **Scope Minimization**: Only requests necessary GitHub permissions
- **Access Control**: Role-based access for sensitive features

### Required GitHub Permissions
- `repo`: Repository access for reading code and metadata
- `read:org`: Organization information access
- `read:repo_hook`: Repository webhook information
- `read:project`: GitHub Projects v2 access

## ⚡ Performance & Optimization

### Caching Strategy
- **API Response Caching**: 5-minute TTL for GitHub API responses
- **Repository Metadata**: Cached for improved performance
- **Project Information**: Cached to reduce API calls
- **User Information**: Session-based caching

### Rate Limit Handling
- **Automatic Retry**: Exponential backoff for rate-limited requests
- **Quota Monitoring**: Track and report API usage
- **Efficient Batching**: Minimize API calls through intelligent batching
- **Cache Utilization**: Prefer cached responses when available

## 🔧 Development

### Local Development
```bash
# Start development server
npm run dev

# The server will be available at http://localhost:8787
# Set up local GitHub OAuth app with callback: http://localhost:8787/callback

# Create .dev.vars file for local environment
GITHUB_CLIENT_ID=your_local_github_client_id
GITHUB_CLIENT_SECRET=your_local_github_client_secret
COOKIE_ENCRYPTION_KEY=your_encryption_key
```

### Testing
```bash
# Type checking
npm run type-check

# Generate Cloudflare Worker types
npm run cf-typegen

# Test with MCP Inspector
npx @modelcontextprotocol/inspector@latest
# Enter: http://localhost:8787/sse
```

### Project Structure
```
src/
├── index.ts                  # Main MCP server implementation and tool definitions
├── github-handler.ts         # OAuth authentication and GitHub integration
├── github-api-service.ts     # GitHub API client and data processing
├── types.ts                  # TypeScript type definitions
├── utils.ts                  # Utility functions and helpers
└── workers-oauth-utils.ts    # OAuth-specific utility functions

wrangler.jsonc               # Cloudflare Workers configuration
package.json                 # Dependencies and scripts
worker-configuration.d.ts    # Generated TypeScript types
```

### Adding New Tools
1. **Define Tool Schema**: Add tool definition in `src/index.ts`
2. **Implement API Methods**: Add required methods to `github-api-service.ts`
3. **Update Types**: Add type definitions in `types.ts`
4. **Test Implementation**: Use MCP Inspector to test functionality
5. **Update Documentation**: Add tool documentation to README

## 🚨 Troubleshooting

### Common Issues

#### OAuth Authentication Fails
- **Check GitHub OAuth App**: Verify Client ID and Secret
- **Callback URL**: Ensure callback URL matches exactly
- **Permissions**: Verify required GitHub scopes are granted

#### Rate Limit Errors
- **Monitor Usage**: Check GitHub API rate limits
- **Implement Caching**: Use built-in caching features
- **Reduce Frequency**: Optimize request patterns

#### Connection Issues
- **Network Connectivity**: Test basic HTTP connectivity
- **Firewall Settings**: Check for blocked ports
- **DNS Resolution**: Verify domain resolution

### Debug Commands
```bash
# View real-time logs
wrangler tail

# Check deployment status
wrangler deployments list

# Test specific endpoints
curl -I https://team-mcp.your-subdomain.workers.dev/sse

# Validate configuration
wrangler whoami
```

### Error Codes
- **401 Unauthorized**: OAuth token invalid or expired
- **403 Forbidden**: Insufficient permissions for requested resource
- **404 Not Found**: Repository or organization not found
- **429 Too Many Requests**: GitHub API rate limit exceeded

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and add tests
4. Run type checking: `npm run type-check`
5. Submit a pull request

### Code Style
- Use TypeScript for all new code
- Follow existing code patterns and conventions
- Add proper error handling and logging
- Include JSDoc comments for public APIs

### Testing
- Test all new tools with MCP Inspector
- Verify OAuth flow works correctly
- Check rate limit handling
- Validate error responses

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🆘 Support

For issues and questions:
- **GitHub Issues**: Create an issue in this repository
- **Documentation**: Check the troubleshooting section above
- **Cloudflare Docs**: [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- **MCP Docs**: [Model Context Protocol Documentation](https://modelcontextprotocol.io/)

---

**Built with ❤️ using Cloudflare Workers and the Model Context Protocol**

*This MCP server provides secure, scalable access to GitHub's ecosystem for AI assistants and other MCP-compatible tools.*