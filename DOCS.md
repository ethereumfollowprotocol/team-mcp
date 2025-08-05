# GitHub Team Management MCP Server - Internal Documentation

## 🎯 What is This?

The **GitHub Team Management MCP Server** is a comprehensive Model Context Protocol (MCP) server that provides complete GitHub project management automation for AI assistants. Built on Cloudflare Workers, it enables AI agents like Claude and ChatGPT to perform sophisticated GitHub operations including:

- 📋 **Complete Issue Lifecycle Management** - Create, comment, assign, label, close/reopen issues
- 🌳 **Advanced Git Operations** - Read files, browse directories, create branches, commit changes
- 📊 **Project Board Automation** - Manage project boards, assign tasks, update statuses
- 🔄 **Pull Request Management** - Create PRs, add comments, track review status
- 📈 **Analytics & Reporting** - Financial reports, activity tracking, team analytics

## 🚀 Why is This Useful?

### For Development Teams:

- **AI-Powered Workflow Automation** - Let AI assistants handle routine GitHub tasks
- **Complete Development Cycle** - From issue analysis to PR creation, fully automated
- **Transparent Operations** - All AI commits are co-authored for visibility
- **Security-First Design** - Protected operations prevent dangerous actions

### For AI Agents:

- **Full GitHub API Access** - 38+ tools covering every aspect of GitHub management
- **Intelligent Context** - Rich data structures optimized for AI understanding
- **Safe Operations** - Built-in safeguards prevent destructive actions
- **Cross-Platform Support** - Works with Claude, ChatGPT, and other MCP clients

### Example AI Workflow:

```
1. AI analyzes issue from project board
2. AI reads relevant code files
3. AI creates feature branch
4. AI commits code improvements
5. AI creates pull request
6. Human reviews and merges
```

## 🔗 Connection URLs & Setup

### Production Server

```
https://team-mcp.efp.workers.dev/sse
```

### Claude desktop

You will have to add the MCP server as a "Connector". Under the "Custom Connectors" section, you will click the "Add custom connector" and enter "https://google-services-mcp.efp.workers.dev/sse"

#### **Cursor IDE**

1. Open **Settings** → **MCP**
2. Click **Add Server**
3. Configure:
   - **Name**: GitHub Team Management
   - **Type**: Remote Server
   - **URL**: `https://team-mcp.efp.workers.dev/sse`

#### **VSCode with Claude Extension**

Add to VSCode `settings.json`:

```json
{
  "claude.mcpServers": [
    {
      "name": "github-team",
      "url": "https://team-mcp.efp.workers.dev/sse"
    }
  ]
}
```

#### **ChatGPT Pro**

1. Go to **Settings** → **Beta Features**
2. Enable **Custom Connectors**
3. Navigate to **Connectors** → **Add Connector**
4. Configure:
   - **Name**: GitHub Team Management
   - **Description**: Full GitHub project management with issues, PRs, and project boards
   - **URL**: `https://team-mcp.efp.workers.dev/sse`

#### **Claude Code CLI**

```bash
# Install Claude Code
npm install -g @anthropic/claude-code

# Add the server
claude mcp add --transport sse github-team https://team-mcp.efp.workers.dev/sse

# To test connection you have to launch claude code
# run the following command
/mcp
```

## 🛠️ Complete Tool Reference (38 Tools)

### 1. **User & Organization Tools** (4 tools)

#### `userInfoOctokit`

Get authenticated user information from GitHub.

- **Parameters**: None
- **Returns**: User profile, repos, followers, etc.

#### `listOrganizationRepos`

List all repositories for a GitHub organization with filtering.

- **Parameters**: `organization`, `includePrivate`, `sortBy`, `limit`
- **Returns**: Repository list with metadata

#### `getRecentActivity`

Get recent activity across organization repositories.

- **Parameters**: `organization`, `days`, `includePrivate`, `limit`
- **Returns**: Activity summary with commits, issues, PRs

#### `searchIssuesAndPRs`

Search issues and pull requests across entire organization.

- **Parameters**: `organization`, `query`, `state`, `limit`
- **Returns**: Filtered issues and PRs matching query

### 2. **Repository Management Tools** (9 tools)

#### `getRepositoryDetails`

Get comprehensive repository information.

- **Parameters**: `owner`, `repo`, `includeCommits`, `includeIssues`, `includePRs`, `days`
- **Returns**: Repository details with recent activity

#### `getCommitHistory`

Get detailed commit history with filtering.

- **Parameters**: `owner`, `repo`, `branch`, `limit`, `since`
- **Returns**: Commit history with author, message, changes

#### `getContributorStats`

Get contributor statistics for repository.

- **Parameters**: `owner`, `repo`
- **Returns**: Contributor list with commit counts

#### `getRepositoryFile`

Read contents of specific file from repository.

- **Parameters**: `owner`, `repo`, `path`, `branch`
- **Returns**: File content, encoding, size, SHA

#### `getRepositoryTree`

Browse file and directory structure.

- **Parameters**: `owner`, `repo`, `path`, `branch`, `recursive`
- **Returns**: Directory tree with file metadata

#### `listRepositoryBranches`

List all branches with commit information.

- **Parameters**: `owner`, `repo`, `includeProtected`
- **Returns**: Branch list with protection status

#### `getBranchInfo`

Get detailed information about specific branch.

- **Parameters**: `owner`, `repo`, `branch`
- **Returns**: Branch status, ahead/behind counts, protection

#### `createBranch`

Create new branch from base branch.

- **Parameters**: `owner`, `repo`, `branchName`, `baseBranch`, `description`
- **Returns**: New branch details
- **Security**: Validates branch names, prevents protected branch names

#### `commitChanges`

Commit multiple file changes to branch.

- **Parameters**: `owner`, `repo`, `branch`, `message`, `changes[]`
- **Returns**: Commit details with co-author attribution
- **Security**: Blocks protected branches, dangerous paths, delete operations

### 3. **Project Board Management Tools** (5 tools)

#### `listOrganizationProjects`

List all GitHub Projects v2 for organization.

- **Parameters**: `organization`
- **Returns**: Project list with metadata

#### `getProjectBoardDetails`

Get complete project board information.

- **Parameters**: `includeFields`, `includeItems`, `limit`
- **Returns**: Project details, fields, items with full metadata

#### `updateProjectBoardItem`

Update custom field values for project items.

- **Parameters**: `itemId`, `fieldName`, `value`
- **Returns**: Updated field information
- **Note**: Cannot update built-in fields (Title, Assignees, Labels)

#### `updateProjectBoardDraftIssueTitle`

Update draft issue title and/or description.

- **Parameters**: `itemId`, `title`, `body`
- **Returns**: Updated draft issue details

#### `createProjectBoardDraftIssue`

Create draft issue directly in project board.

- **Parameters**: `title`, `body`, `initialStatus`
- **Returns**: New draft issue details

### 4. **Issue Management Tools** (9 tools)

#### `createGitHubIssue`

Create new issue with full metadata support.

- **Parameters**: `owner`, `repo`, `title`, `body`, `assignees[]`, `labels[]`, `milestone`, `addToProject`
- **Returns**: Issue details with optional project integration

#### `commentOnGitHubIssue`

Add comment to existing issue.

- **Parameters**: `owner`, `repo`, `issueNumber`, `body`
- **Returns**: Comment details

#### `updateIssueAssignees`

Update issue assignees (replaces existing).

- **Parameters**: `owner`, `repo`, `issueNumber`, `assignees[]`
- **Returns**: Updated assignee list

#### `updateIssueLabels`

Update issue labels (replaces existing).

- **Parameters**: `owner`, `repo`, `issueNumber`, `labels[]`
- **Returns**: Updated label list

#### `closeIssue`

Close issue with optional reason.

- **Parameters**: `owner`, `repo`, `issueNumber`, `reason`
- **Returns**: Closure confirmation
- **Reasons**: `COMPLETED`, `NOT_PLANNED`

#### `reopenIssue`

Reopen closed issue.

- **Parameters**: `owner`, `repo`, `issueNumber`
- **Returns**: Reopen confirmation

#### `updateIssue`

Update issue title and/or body.

- **Parameters**: `owner`, `repo`, `issueNumber`, `title`, `body`
- **Returns**: Updated issue details

#### `getIssueDetails`

Get comprehensive issue information.

- **Parameters**: `owner`, `repo`, `issueNumber`
- **Returns**: Complete issue details with assignees, labels, comments

#### `addIssueToProject`

Add existing issue to project board.

- **Parameters**: `owner`, `repo`, `issueNumber`, `initialStatus`
- **Returns**: Project integration details

### 5. **Pull Request Management Tools** (3 tools)

#### `createPullRequest`

Create new pull request.

- **Parameters**: `owner`, `repo`, `title`, `head`, `base`, `body`, `draft`, `maintainerCanModify`
- **Returns**: PR details with mergeable state

#### `commentOnPullRequest`

Add comment to pull request.

- **Parameters**: `owner`, `repo`, `prNumber`, `body`
- **Returns**: Comment details

#### `getPullRequestDetails`

Get comprehensive PR information.

- **Parameters**: `owner`, `repo`, `prNumber`
- **Returns**: Complete PR details with reviews, mergeable state

### 6. **Project Board Assignment Tools** (4 tools)

#### `assignProjectBoardItem`

Assign users to project board items.

- **Parameters**: `itemId`, `usernames[]`
- **Returns**: Assignment confirmation
- **Smart Logic**: Uses custom fields or falls back to GitHub issue assignment

#### `unassignProjectBoardItem`

Remove assignees from project board items.

- **Parameters**: `itemId`, `usernames[]`
- **Returns**: Unassignment confirmation

#### `labelProjectBoardItem`

Add labels to project board items.

- **Parameters**: `itemId`, `labels[]`
- **Returns**: Label assignment confirmation

#### `getProjectAssignableUsers`

Get list of users who can be assigned.

- **Parameters**: None
- **Returns**: Available users with avatars

### 7. **Analytics & Reporting Tools** (5 tools)

#### `getEFPDuneStatistics`

Fetch EFP blockchain analytics from Dune.

- **Parameters**: `searchQuery`
- **Returns**: Real-time blockchain metrics

#### `getFinancialReportQuick`

Get pre-cached financial report data.

- **Parameters**: `quarter`, `year`
- **Returns**: Cached financial data (fast)

#### `listFinancialReports`

List all available financial reports.

- **Parameters**: None
- **Returns**: Available reports by quarter

#### `getFinancialReport`

Extract financial data from reports (with OCR).

- **Parameters**: `quarter`, `year`, `forceRefresh`
- **Returns**: Extracted financial data

#### `compareFinancialReports`

Compare metrics across multiple quarters.

- **Parameters**: `quarters[]`, `metrics[]`
- **Returns**: Comparative analysis with growth rates

## 🔧 Local Development Setup

### Prerequisites

- **Node.js 18+**
- **Cloudflare Account** with Workers plan
- **GitHub OAuth App**
- **Wrangler CLI**

### Step 1: Clone & Install

```bash
git clone https://github.com/ethereumfollowprotocol/team-mcp.git
cd team-mcp
npm install
```

### Step 2: Cloudflare Setup

```bash
# Login to Cloudflare
wrangler login

# Generate types
npm run cf-typegen
```

### Step 3: GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create **New OAuth App**:
   - **Name**: Team MCP Development
   - **Homepage URL**: `http://localhost:8787`
   - **Callback URL**: `http://localhost:8787/callback`
3. Save **Client ID** and **Client Secret**

### Step 4: Environment Configuration

Create/update `wrangler.jsonc`:

```json
{
  "name": "team-mcp",
  "main": "src/index.ts",
  "compatibility_date": "2024-01-01",
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
  ]
}
```

### Step 5: Development Server

```bash
# Start development server
npm run dev

# Server will be available at:
# http://localhost:8787
```

### Step 6: Testing with AI Clients

Use local development URL:

```
http://localhost:8787/sse
```

## 📋 Code Style Guidelines

### TypeScript Standards

- **Strict TypeScript** - All types must be explicitly defined
- **Zod Validation** - All tool parameters validated with Zod schemas
- **Error Handling** - Comprehensive try/catch with descriptive messages

### File Organization

```
src/
├── index.ts              # Main MCP server and tool registration
├── github-api-service.ts  # GitHub API methods and business logic
├── github-handler.ts      # OAuth and authentication
├── types.ts              # TypeScript type definitions
├── const.ts              # Constants and configuration
└── utils.ts              # Utility functions
```

### Naming Conventions

- **Functions**: `camelCase` (e.g., `createGitHubIssue`)
- **Variables**: `camelCase` (e.g., `githubApi`)
- **Types/Interfaces**: `PascalCase` (e.g., `GitHubIssue`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `PROJECT_BOARD_ID`)

### Security Patterns

```typescript
// 1. Always validate branch names
const protectedBranches = ['main', 'master', 'develop', 'staging', 'production'];
if (protectedBranches.includes(branchName.toLowerCase())) {
  throw new Error(`Cannot create branch with protected name: ${branchName}`);
}

// 2. Validate file paths
const dangerousPaths = ['.git/', '/.github/workflows/', '.env'];
const hasDangerousPath = changes.some((c) => dangerousPaths.some((dp) => c.path.toLowerCase().includes(dp.toLowerCase())));

// 3. Block dangerous operations
const allowedOperations = ['create', 'update']; // No 'delete'
```

### Error Handling Pattern

```typescript
try {
  const result = await githubApi.someOperation();
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
} catch (error: any) {
  return {
    content: [
      {
        type: 'text',
        text: `Error performing operation: ${error.message}`,
      },
    ],
  };
}
```

## 🛡️ Security Guidelines

### Operations Allowed ✅

- **Read Operations**: Files, branches, issues, PRs, project boards
- **Create Operations**: Issues, PRs, branches, comments, draft issues
- **Update Operations**: Issue content, labels, assignees, project fields
- **Branch Creation**: From any base branch to any valid name

### Operations Blocked ❌

- **Delete Operations**: No files, branches, or repositories can be deleted
- **Protected Branch Commits**: Cannot commit to main/master/develop/staging/production
- **System File Modification**: Cannot modify .git/, workflows, .env, lock files
- **Force Operations**: No force push or history rewriting
- **Merge Operations**: Cannot merge PRs (human-only operation)

### Co-Authored Commits

All commits made through `commitChanges` are automatically co-authored:

```
Your commit message here

Co-authored-by: GitHub Team MCP <ethid.github.mcp@ethfollow.xyz>
```

### Authentication Flow

1. **OAuth-based** - Users authenticate via GitHub OAuth
2. **Token Storage** - Encrypted storage in Cloudflare KV
3. **Scope Validation** - Required scopes: `repo`, `read:org`, `read:repo_hook`, `project`

## 🔍 Troubleshooting

### Common Issues

#### "Authentication Required" Error

**Solution:**

1. Ensure GitHub OAuth app is configured correctly
2. Verify callback URL matches exactly
3. Check required scopes are granted
4. Re-authenticate through MCP client

#### "Tool Not Found" Error

**Solution:**

1. Restart MCP client (Claude Desktop/Cursor/VSCode)
2. Check server URL is accessible: `curl -I https://team-mcp.efp.workers.dev/sse`
3. Verify MCP configuration syntax

#### Rate Limit Errors

**Solutions:**

- GitHub API: 5,000 requests/hour when authenticated
- Server includes automatic retry logic
- Wait between large operations

#### TypeScript Compilation Errors

**Solution:**

```bash
# Check for errors
npm run type-check

# Fix common issues
npm run cf-typegen  # Regenerate Cloudflare types
```

### Development Debugging

```bash
# View deployment logs
wrangler tail

# Test server endpoint
curl -X GET http://localhost:8787/sse

# Check OAuth flow
curl -I http://localhost:8787/authorize
```

## 🚀 Deployment

### Production Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Verify deployment
curl -I https://team-mcp.efp.workers.dev/sse
```

### Environment Variables

Required for production:

- `GITHUB_CLIENT_ID` - GitHub OAuth App Client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth App Client Secret
- `COOKIE_ENCRYPTION_KEY` - Base64 encoded 32-byte key
- `DUNE_API_KEY` - (Optional) Dune Analytics API key
- `OCR_SPACE_API_KEY` - (Optional) OCR Space API key

## 🤖 AI Agent Integration Notes

### For AI Assistants:

- **Tool Discovery**: All 38 tools are automatically available after connection
- **Parameter Validation**: Zod schemas ensure type safety
- **Rich Responses**: JSON responses optimized for AI parsing
- **Error Context**: Descriptive error messages for debugging

### Workflow Recommendations:

1. **Start with Repository Navigation** - Use `getRepositoryTree` and `getRepositoryFile`
2. **Check Project Status** - Use `getProjectBoardDetails` for current state
3. **Create Feature Workflow** - `createBranch` → `commitChanges` → `createPullRequest`
4. **Issue Management** - Full lifecycle from creation to closure

### Best Practices for AI:

- **Be Specific** - Use exact repository names and paths
- **Check Context** - Read existing code before making changes
- **Security Aware** - Understand what operations are blocked and why
- **Incremental Changes** - Make small, focused commits
- **Human Oversight** - Always create PRs for human review

---

**This MCP server transforms AI assistants into powerful GitHub automation tools while maintaining security and human oversight. Happy coding! 🎉**
