# GitHub Team Management MCP Server

A comprehensive Model Context Protocol (MCP) server built on Cloudflare Workers that provides **full GitHub project management automation** for AI assistants. This server enables **both Claude and ChatGPT** to create issues, manage project boards, assign team members, and automate complete GitHub workflows through OAuth-based authentication.

## 🚀 **Key Features**

### **Complete GitHub Issue Management**

- ✅ **Create Issues** with assignees, labels, and milestones
- ✅ **Comment Management** - Add comments to any issue
- ✅ **Assignee Management** - Add/remove assignees from issues
- ✅ **Label Management** - Apply/remove labels from issues
- ✅ **Issue State Control** - Close/reopen issues with reasons
- ✅ **Content Updates** - Modify issue titles and descriptions
- ✅ **Project Integration** - Automatically add issues to project boards

### **Advanced Project Board Management**

- ✅ **Smart Assignment** - Assign users to project items (handles both custom fields and built-in GitHub issue assignment)
- ✅ **Status Management** - Update project board status columns
- ✅ **Label Integration** - Apply labels to project board items
- ✅ **Draft Issue Support** - Create and manage draft issues
- ✅ **Multi-Item Operations** - Bulk operations across project items

### **Dual AI Assistant Support**

- 🤖 **Claude Integration** - Full feature access through Claude Desktop, Cursor, VSCode
- 🤖 **ChatGPT Integration** - Compatible with ChatGPT Pro's Deep Research mode
- 🔄 **Cross-Compatible** - Same server works with both AI assistants
- 📊 **Smart Search** - AI-optimized search across repositories, issues, and projects

### **Enterprise Repository Management**

- 🏢 **Organization-Wide Access** - List and analyze all repositories
- 📈 **Activity Monitoring** - Track commits, issues, PRs across teams
- 👥 **Contributor Analytics** - Analyze team contributions and patterns
- 🔍 **Advanced Search** - Find issues/PRs across entire organizations
- 📊 **EFP Blockchain Analytics** - Real-time Dune Analytics integration

## 🎯 **Perfect For**

- **Engineering Teams** automating GitHub workflows
- **Project Managers** coordinating development tasks
- **DevOps Teams** managing multi-repository operations
- **AI-Powered Development** with Claude or ChatGPT assistance
- **Team Leads** tracking project progress and assignments

## 📦 **Quick Start**

### **Prerequisites**

- Node.js 18+
- Cloudflare Account with Workers plan
- GitHub OAuth App
- Wrangler CLI

### **1. Setup & Deploy**

```bash
# Clone and install
git clone <repository-url>
cd team-mcp
npm install

# Login to Cloudflare
wrangler login

# Deploy to Cloudflare Workers
npm run deploy
```

### **2. GitHub OAuth Setup**

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create "New OAuth App":
   - **Name**: Your MCP Server
   - **URL**: `https://team-mcp.your-subdomain.workers.dev`
   - **Callback**: `https://team-mcp.your-subdomain.workers.dev/callback`
3. Save Client ID and Secret

### **3. Configure Environment**

Update `wrangler.jsonc`:

```json
{
  "vars": {
    "GITHUB_CLIENT_ID": "your-github-client-id",
    "GITHUB_CLIENT_SECRET": "your-github-client-secret",
    "COOKIE_ENCRYPTION_KEY": "your-base64-encryption-key"
  }
}
```

### **4. Connect AI Assistant**

#### **For Claude Desktop:**

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "github-team": {
      "command": "npx",
      "args": ["mcp-remote", "https://team-mcp.your-subdomain.workers.dev/sse"]
    }
  }
}
```

#### **For ChatGPT Pro:**

1. Add custom connector in ChatGPT settings
2. Use URL: `https://team-mcp.your-subdomain.workers.dev/sse`
3. Test in Deep Research mode

## 🛠️ **Complete Tool Reference**

### **🎫 Issue Management Tools**

#### **`createGitHubIssue`**

Create comprehensive GitHub issues with full metadata support.

```javascript
// Create a bug report with assignees and labels
{
  "owner": "ethereumfollowprotocol",
  "repo": "api",
  "title": "Fix authentication timeout issue",
  "body": "## Bug Description\nUsers experiencing 30s timeout...",
  "assignees": ["janzunec", "teammate"],
  "labels": ["bug", "priority-high"],
  "milestone": 1,
  "addToProject": true
}
```

**Parameters:**

- `owner` (string): Repository owner
- `repo` (string): Repository name
- `title` (string): Issue title
- `body` (string, optional): Issue description in markdown
- `assignees` (string[], optional): GitHub usernames to assign
- `labels` (string[], optional): Label names to apply
- `milestone` (number, optional): Milestone number
- `addToProject` (boolean, optional): Add to default project board

#### **`commentOnGitHubIssue`**

Add comments to existing GitHub issues.

```javascript
{
  "owner": "ethereumfollowprotocol",
  "repo": "api",
  "issueNumber": 42,
  "body": "## Update\nThis has been fixed in the latest deployment."
}
```

#### **`updateIssueAssignees`**

Manage issue assignees (replaces existing assignees).

```javascript
{
  "owner": "ethereumfollowprotocol",
  "repo": "api",
  "issueNumber": 42,
  "assignees": ["newdev", "teamlead"]
}
```

#### **`updateIssueLabels`**

Update issue labels (replaces existing labels).

```javascript
{
  "owner": "ethereumfollowprotocol",
  "repo": "api",
  "issueNumber": 42,
  "labels": ["in-progress", "needs-review"]
}
```

#### **`closeIssue`** / **`reopenIssue`**

Control issue state with optional close reasons.

```javascript
// Close with reason
{
  "owner": "ethereumfollowprotocol",
  "repo": "api",
  "issueNumber": 42,
  "reason": "COMPLETED"  // or "NOT_PLANNED"
}

// Reopen
{
  "owner": "ethereumfollowprotocol",
  "repo": "api",
  "issueNumber": 42
}
```

#### **`updateIssue`**

Update issue title and/or description.

```javascript
{
  "owner": "ethereumfollowprotocol",
  "repo": "api",
  "issueNumber": 42,
  "title": "Updated: Fix authentication timeout issue",
  "body": "## Updated Description\nResolved in version 2.1.0..."
}
```

#### **`getIssueDetails`**

Fetch comprehensive issue information.

```javascript
{
  "owner": "ethereumfollowprotocol",
  "repo": "api",
  "issueNumber": 42
}
```

### **📋 Project Board Management Tools**

#### **`getProjectBoardDetails`**

Get complete project board information including all tasks and custom fields.

```javascript
{
  "includeFields": true,
  "includeItems": true,
  "limit": 100
}
```

#### **`updateProjectBoardItem`**

Update custom fields on project board items.

```javascript
{
  "itemId": "PVTI_lADOCIgXcc4Ah9ZWzgc45F8",
  "fieldName": "Status",
  "value": "In Progress"
}
```

**Supported Status Values:**

- "Big Projects", "Throw Backlog", "Jan Backlog", "EIK Backlog"
- "SIWE", "Todo - Jan", "Todo - Throw", "Blocked"
- "In Progress", "Done"

#### **`assignProjectBoardItem`**

Assign team members to project board items.

```javascript
{
  "itemId": "PVTI_lADOCIgXcc4Ah9ZWzgc45F8",
  "usernames": ["janzunec", "teammate"]
}
```

**Smart Assignment Logic:**

- ✅ Works with custom assignee fields in projects
- ✅ Falls back to direct GitHub issue assignment
- ✅ Handles Issues, Pull Requests, and Draft Issues
- ✅ Automatically detects the correct assignment method

#### **`unassignProjectBoardItem`**

Remove specific assignees from project items.

```javascript
{
  "itemId": "PVTI_lADOCIgXcc4Ah9ZWzgc45F8",
  "usernames": ["former-assignee"]
}
```

#### **`labelProjectBoardItem`**

Add labels to project board items (works for GitHub issues in projects).

```javascript
{
  "itemId": "PVTI_lADOCIgXcc4Ah9ZWzgc45F8",
  "labels": ["urgent", "bug"]
}
```

#### **`addIssueToProject`**

Add existing GitHub issues to the project board.

```javascript
{
  "owner": "ethereumfollowprotocol",
  "repo": "api",
  "issueNumber": 42,
  "initialStatus": "Todo - Jan"
}
```

#### **`createProjectBoardDraftIssue`**

Create draft issues directly in the project board.

```javascript
{
  "title": "Research new API architecture",
  "body": "## Research Goals\n- Evaluate GraphQL vs REST\n- Performance testing",
  "initialStatus": "Big Projects"
}
```

#### **`updateProjectBoardDraftIssueTitle`**

Update draft issue titles and descriptions.

```javascript
{
  "itemId": "PVTI_lADOCIgXcc4Ah9ZWzgc45F8",
  "title": "Updated: Research new API architecture",
  "body": "## Updated Research Goals\n- Focus on GraphQL performance"
}
```

#### **`getProjectAssignableUsers`**

Get list of team members who can be assigned to project items.

```javascript
// No parameters needed
{
}
```

### **🔍 Search & Discovery Tools**

#### **`search`** (ChatGPT Compatible)

AI-optimized search across repositories, issues, PRs, and project items.

```javascript
{
  "query": "authentication bug"
}
```

**Search Types:**

- 🔍 **Repository search** (when query includes "repo" or is short)
- 🎫 **Issue/PR search** (full GitHub search syntax)
- 📋 **Project item search** (when query includes "project", "task", "board")

#### **`fetch`** (ChatGPT Compatible)

Fetch detailed information for specific records by ID.

```javascript
{
  "id": "repo:ethereumfollowprotocol/api"
}
// or
{
  "id": "issue:ethereumfollowprotocol:api:42"
}
// or
{
  "id": "project-item:PVTI_lADOCIgXcc4Ah9ZWzgc45F8"
}
```

**Supported ID Formats:**

- `repo:owner/name` - Repository details
- `issue:owner:repo:number` - Issue details
- `pr:owner:repo:number` - Pull request details
- `project-item:itemId` - Project board item details

### **🏢 Organization & Repository Tools**

#### **`listOrganizationRepos`**

List and filter organization repositories.

```javascript
{
  "organization": "ethereumfollowprotocol",
  "includePrivate": true,
  "sortBy": "updated",
  "limit": 25
}
```

#### **`getRepositoryDetails`**

Get comprehensive repository information including recent activity.

```javascript
{
  "owner": "ethereumfollowprotocol",
  "repo": "api",
  "includeCommits": true,
  "includeIssues": true,
  "includePRs": true,
  "days": 30
}
```

#### **`getRecentActivity`**

Monitor recent activity across organization repositories.

```javascript
{
  "organization": "ethereumfollowprotocol",
  "days": 7,
  "includePrivate": true,
  "limit": 20
}
```

#### **`searchIssuesAndPRs`**

Search issues and pull requests across the entire organization.

```javascript
{
  "organization": "ethereumfollowprotocol",
  "query": "is:issue is:open label:bug",
  "state": "open",
  "limit": 50
}
```

**GitHub Search Query Examples:**

- `"author:username"` - Items by specific author
- `"label:urgent"` - Items with specific label
- `"is:pr is:open"` - Open pull requests only
- `"bug in:title"` - "Bug" in title
- `"created:>2024-01-01"` - Created after date

### **📊 Analytics & Statistics**

#### **`getEFPDuneStatistics`**

Access real-time EFP (Ethereum Follow Protocol) blockchain analytics.

```javascript
{
  "searchQuery": "minted"  // Filter for minting statistics
}
// or
{
  "searchQuery": "daily"   // Daily metrics
}
// or
{}  // All 26+ available statistics
```

**Available Metrics:**

- User growth and adoption trends
- Token minting statistics (all chains)
- Transaction volume analytics
- Daily/monthly active users
- Protocol usage patterns

## 🔒 **Security & Authentication**

### **OAuth Security Model**

- 🔐 **Encrypted Token Storage** in Cloudflare KV
- 🍪 **Secure Cookie Handling** with HTTP-only flags
- 🔑 **Minimal Scope Permissions** - only necessary GitHub scopes
- 🛡️ **Rate Limit Protection** with automatic retry logic
- 🔒 **HTTPS Enforced** - all communications encrypted

### **Required GitHub Permissions**

```json
{
  "scopes": [
    "repo", // Repository access (read/write)
    "read:org", // Organization information
    "read:repo_hook", // Repository webhooks
    "project" // GitHub Projects v2 (read/write)
  ]
}
```

### **Access Control**

- ✅ **User-based authentication** via GitHub OAuth
- ✅ **Organization membership validation**
- ✅ **Repository-level permissions** respected
- ✅ **Project board access control** enforced

## 🎛️ **Configuration**

### **Environment Variables**

```bash
# Required
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
COOKIE_ENCRYPTION_KEY=base64_encoded_32_byte_key

# Optional
DUNE_API_KEY=your_dune_analytics_api_key
OCR_SPACE_API_KEY=your_ocr_space_api_key
```

### **Project Configuration**

Update `src/const.ts` to customize:

```typescript
export const PROJECT_BOARD_ID = 'PVT_kwDOCIgXcc4Ah9ZW';

export const PROJECT_STATUSES = [
  'Big Projects',
  'Throw Backlog',
  'Jan Backlog',
  'EIK Backlog',
  'SIWE',
  'Todo - Jan',
  'Todo - Throw',
  'Blocked',
  'In Progress',
  'Done',
] as const;
```

## 📊 **Performance & Optimization**

### **Caching Strategy**

- ⚡ **5-minute API response caching** for GitHub data
- 🚀 **Intelligent cache invalidation** on updates
- 📈 **Rate limit optimization** with automatic backoff
- 🔄 **Parallel API calls** for bulk operations

### **Rate Limit Management**

- 📊 **GitHub API**: 5,000 requests/hour (authenticated)
- 📊 **Dune Analytics**: Based on plan (40-1000 requests/minute)
- 🔄 **Automatic retry logic** with exponential backoff
- ⚡ **Request batching** for efficiency

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Authentication Fails**

```bash
# Check OAuth configuration
curl -I https://your-worker.workers.dev/sse
# Verify GitHub OAuth app callback URL matches exactly
```

#### **Rate Limit Errors**

- ✅ GitHub API provides 5,000 requests/hour when authenticated
- ✅ Server implements automatic retry with backoff
- ✅ Check remaining quota: included in error messages

#### **Tool Not Found**

- ✅ Ensure you're using the correct tool name
- ✅ Check MCP client connection status
- ✅ Verify OAuth authentication completed

#### **Project Board Access**

```javascript
// Check if item exists
{
  "includeItems": true,
  "limit": 200
}
// Use getProjectBoardDetails to see all available items
```

### **Debug Commands**

```bash
# View deployment logs
wrangler tail

# Test server endpoint
curl -X GET https://your-worker.workers.dev/sse

# Check OAuth flow
curl -I https://your-worker.workers.dev/authorize
```

## 🤝 **Multi-Client Compatibility**

### **Claude Integration**

- ✅ **Full Feature Access** - All tools available
- ✅ **Native OAuth** - Seamless authentication
- ✅ **Rich Responses** - Detailed JSON formatting
- ✅ **Workflow Integration** - Perfect for development automation

### **ChatGPT Integration**

- ✅ **Deep Research Mode** - Optimized for ChatGPT Pro
- ✅ **Search & Fetch** - Required ChatGPT tools implemented
- ✅ **Read-Only Safe** - Respects current ChatGPT limitations
- ✅ **Future Ready** - Will support write operations when available

### **Universal Compatibility**

- 🔄 **Same Server** works with both AI assistants
- 📊 **Optimized Responses** for each client type
- 🛠️ **Backward Compatible** - No breaking changes
- 🚀 **Future Proof** - Ready for new MCP clients

## 🔮 **Roadmap**

### **Next Features**

- 🔄 **Webhook Support** for real-time updates
- 📊 **Enhanced Analytics** with custom dashboards
- 🔒 **Team-based Access Control** with role management
- 🤖 **AI Workflow Automation** with smart suggestions
- 📱 **Mobile Optimization** for MCP mobile clients

### **Integration Expansion**

- 🐙 **GitLab Support** - Multi-platform repository management
- 📈 **Linear Integration** - Issue tracking across platforms
- 💬 **Slack/Discord** - Team notification integration
- 📊 **Jira Sync** - Enterprise project management

## 📄 **License**

MIT License - See [LICENSE](LICENSE) file for details.

## 🆘 **Support**

- 🐛 **Issues**: [GitHub Issues](https://github.com/ethereumfollowprotocol/team-mcp/issues)
- 📖 **Documentation**: This README + inline tool descriptions
- 🚀 **Cloudflare Docs**: [Workers Documentation](https://developers.cloudflare.com/workers/)
- 🤖 **MCP Protocol**: [Model Context Protocol](https://modelcontextprotocol.io/)

---

**🎯 Built for modern AI-powered development teams who need comprehensive GitHub automation with both Claude and ChatGPT integration.**

_This MCP server transforms how AI assistants interact with GitHub, enabling full project management automation while maintaining enterprise-grade security and performance._
