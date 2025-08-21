import OAuthProvider from '@cloudflare/workers-oauth-provider';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { Octokit } from 'octokit';
import { z } from 'zod';
import { GitHubHandler } from './github-handler';
import { GitHubApiService } from './github-api-service';
import { FinancialReportsService } from './financial-reports-service';
import { EFP_STATS_DUNE_QUERIES, PROJECT_BOARD_ID, PROJECT_STATUSES } from './const';
import { ProjectStatus } from './types';

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = {
  login: string;
  name: string;
  email: string;
  accessToken: string;
};

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: 'Team MCP',
    version: '1.0.0',
    description: 'GitHub team management MCP server with Claude and ChatGPT support',
  });

  // Helper method to set project item status
  private async setProjectItemStatus(
    githubApi: GitHubApiService,
    projectId: string,
    itemId: string,
    status: ProjectStatus,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const projectDetails = await githubApi.getProjectDetails(projectId);
      const statusField = projectDetails.fields.find((f) => f.name.toLowerCase() === 'status' && f.dataType === 'SINGLE_SELECT');

      if (!statusField) {
        return { success: false, error: 'Status field not found in project' };
      }

      const statusOption = statusField.options?.find((opt) => opt.name === status);

      if (!statusOption) {
        return { success: false, error: `Status option '${status}' not found` };
      }

      await githubApi.updateProjectItemField(projectId, itemId, statusField.id, { singleSelectOptionId: statusOption.id });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async init() {
    // Initialize GitHub API service
    const githubApi = new GitHubApiService(this.props.accessToken);

    // Initialize financial reports service
    const financialReportsService = new FinancialReportsService(this.env);

    // Use the upstream access token to facilitate tools
    this.server.tool('userInfoOctokit', 'Get user info from GitHub, via Octokit', {}, async () => {
      const octokit = new Octokit({ auth: this.props.accessToken });
      return {
        content: [
          {
            text: JSON.stringify(await octokit.rest.users.getAuthenticated()),
            type: 'text',
          },
        ],
      };
    });

    // List repositories for a GitHub organization
    this.server.tool(
      'listOrganizationRepos',
      'List all repositories for a GitHub organization with filtering options',
      {
        organization: z.string().describe('The GitHub organization name'),
        includePrivate: z.boolean().optional().default(true).describe('Include private repositories'),
        sortBy: z.enum(['name', 'updated', 'created', 'pushed']).optional().default('updated').describe('Sort repositories by'),
        limit: z.number().optional().default(50).describe('Maximum number of repositories to return'),
      },
      async ({ organization, includePrivate, sortBy, limit }) => {
        try {
          const repos = await githubApi.getOrganizationRepositories(organization, includePrivate);

          // Sort repositories
          let sortedRepos = repos;
          if (sortBy === 'name') {
            sortedRepos = repos.sort((a, b) => a.name.localeCompare(b.name));
          } else if (sortBy === 'created') {
            sortedRepos = repos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          } else if (sortBy === 'pushed') {
            sortedRepos = repos.sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime());
          }

          // Limit results
          const limitedRepos = sortedRepos.slice(0, limit);

          const summary = {
            organization,
            total_repositories: repos.length,
            showing: limitedRepos.length,
            repositories: limitedRepos.map((repo) => ({
              name: repo.name,
              full_name: repo.full_name,
              description: repo.description,
              language: repo.language,
              stars: repo.stargazers_count,
              forks: repo.forks_count,
              open_issues: repo.open_issues_count,
              private: repo.private,
              updated_at: repo.updated_at,
              pushed_at: repo.pushed_at,
              url: repo.html_url,
            })),
          };

          return {
            content: [{ text: JSON.stringify(summary, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Get recent activity for GitHub organization repositories
    this.server.tool(
      'getRecentActivity',
      'Get recent activity for repositories in a GitHub organization, showing commits, issues, and PRs from the last N days',
      {
        organization: z.string().describe('The GitHub organization name'),
        days: z.number().optional().default(7).describe('Number of days to look back for activity'),
        includePrivate: z.boolean().optional().default(true).describe('Include private repositories'),
        limit: z.number().optional().default(20).describe('Maximum number of repositories to show'),
      },
      async ({ organization, days, includePrivate, limit }) => {
        try {
          const activity = await githubApi.getOrganizationActivity(organization, days, includePrivate);

          // Limit results
          const limitedRepos = activity.repositories.slice(0, limit);

          const result = {
            organization: activity.organization,
            summary: activity.summary,
            period_days: days,
            total_repositories: activity.total_repos,
            active_repositories: activity.active_repos,
            total_commits: activity.total_commits,
            showing: limitedRepos.length,
            repositories: limitedRepos.map((repo) => ({
              name: repo.repository.name,
              full_name: repo.repository.full_name,
              description: repo.repository.description,
              language: repo.repository.language,
              url: repo.repository.html_url,
              activity: {
                recent_commits: repo.commit_count,
                last_commit: repo.recent_commits[0]
                  ? {
                      author: repo.recent_commits[0].commit.author.name,
                      date: repo.recent_commits[0].commit.author.date,
                      message: repo.recent_commits[0].commit.message.split('\n')[0],
                    }
                  : null,
                top_contributors: repo.top_contributors.slice(0, 3).map((c) => ({
                  login: c.login,
                  contributions: c.contributions,
                })),
                open_issues: repo.open_issues,
                open_prs: repo.open_prs,
                last_activity: repo.last_activity,
              },
            })),
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Search for issues and pull requests in a GitHub organization
    this.server.tool(
      'searchIssuesAndPRs',
      'Search for issues and pull requests across all repositories in a GitHub organization',
      {
        organization: z.string().describe('The GitHub organization name'),
        query: z.string().describe("Search query (e.g., 'bug', 'feature', 'urgent', author:username)"),
        state: z.enum(['open', 'closed', 'all']).optional().default('all').describe('Filter by state'),
        limit: z.number().optional().default(50).describe('Maximum number of results to return'),
      },
      async ({ organization, query, state, limit }) => {
        try {
          const results = await githubApi.searchIssuesAndPRs(organization, query, state);

          // Limit results
          const limitedIssues = results.issues.slice(0, Math.floor(limit / 2));
          const limitedPRs = results.pull_requests.slice(0, Math.floor(limit / 2));

          const result = {
            organization,
            query,
            state,
            total_found: {
              issues: results.issues.length,
              pull_requests: results.pull_requests.length,
            },
            showing: {
              issues: limitedIssues.length,
              pull_requests: limitedPRs.length,
            },
            issues: limitedIssues.map((issue) => ({
              number: issue.number,
              title: issue.title,
              state: issue.state,
              author: issue.user.login,
              created_at: issue.created_at,
              updated_at: issue.updated_at,
              labels: issue.labels.map((l) => l.name),
              assignees: issue.assignees.map((a) => a.login),
              url: issue.html_url,
              repository: issue.html_url.split('/').slice(-4, -2).join('/'),
            })),
            pull_requests: limitedPRs.map((pr) => ({
              number: pr.number,
              title: pr.title,
              state: pr.state,
              author: pr.user.login,
              created_at: pr.created_at,
              updated_at: pr.updated_at,
              merged: pr.merged,
              draft: pr.draft,
              head_branch: pr.head.ref,
              base_branch: pr.base.ref,
              url: pr.html_url,
              repository: pr.html_url.split('/').slice(-4, -2).join('/'),
            })),
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Get detailed information about a specific repository
    this.server.tool(
      'getRepositoryDetails',
      'Get detailed information about a specific repository including recent commits, issues, and pull requests',
      {
        owner: z.string().describe('The repository owner (username or organization)'),
        repo: z.string().describe('The repository name'),
        includeCommits: z.boolean().optional().default(true).describe('Include recent commits'),
        includeIssues: z.boolean().optional().default(true).describe('Include recent issues'),
        includePRs: z.boolean().optional().default(true).describe('Include recent pull requests'),
        days: z.number().optional().default(30).describe('Number of days to look back for activity'),
      },
      async ({ owner, repo, includeCommits, includeIssues, includePRs, days }) => {
        try {
          const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

          // Get repository info
          const octokit = new Octokit({ auth: this.props.accessToken });
          const repoInfo = await octokit.rest.repos.get({ owner, repo });

          // Get activity data in parallel
          const [commits, issues, prs, contributors] = await Promise.all([
            includeCommits ? githubApi.getRecentCommits(owner, repo, sinceDate) : [],
            includeIssues ? githubApi.getRepositoryIssues(owner, repo, 'all', sinceDate) : [],
            includePRs ? githubApi.getRepositoryPullRequests(owner, repo, 'all') : [],
            githubApi.getContributors(owner, repo),
          ]);

          // Filter issues vs PRs
          const actualIssues = issues.filter((issue) => !issue.pull_request);
          const recentPRs = prs.filter((pr) => new Date(pr.updated_at) > new Date(sinceDate));

          const result = {
            repository: {
              name: repoInfo.data.name,
              full_name: repoInfo.data.full_name,
              description: repoInfo.data.description,
              language: repoInfo.data.language,
              stars: repoInfo.data.stargazers_count,
              forks: repoInfo.data.forks_count,
              open_issues: repoInfo.data.open_issues_count,
              private: repoInfo.data.private,
              created_at: repoInfo.data.created_at,
              updated_at: repoInfo.data.updated_at,
              pushed_at: repoInfo.data.pushed_at,
              default_branch: repoInfo.data.default_branch,
              url: repoInfo.data.html_url,
            },
            activity_period_days: days,
            recent_commits: commits.slice(0, 10).map((commit) => ({
              sha: commit.sha.substring(0, 7),
              author: commit.commit.author.name,
              date: commit.commit.author.date,
              message: commit.commit.message.split('\n')[0],
              url: commit.html_url,
            })),
            recent_issues: actualIssues.slice(0, 10).map((issue) => ({
              number: issue.number,
              title: issue.title,
              state: issue.state,
              author: issue.user.login,
              created_at: issue.created_at,
              labels: issue.labels.map((l) => l.name),
              url: issue.html_url,
            })),
            recent_pull_requests: recentPRs.slice(0, 10).map((pr) => ({
              number: pr.number,
              title: pr.title,
              state: pr.state,
              author: pr.user.login,
              created_at: pr.created_at,
              merged: pr.merged,
              draft: pr.draft,
              head_branch: pr.head.ref,
              base_branch: pr.base.ref,
              url: pr.html_url,
            })),
            contributors: contributors.slice(0, 10).map((contributor) => ({
              login: contributor.login,
              contributions: contributor.contributions,
              avatar_url: contributor.avatar_url,
            })),
            statistics: {
              recent_commits: commits.length,
              recent_issues: actualIssues.length,
              recent_prs: recentPRs.length,
              total_contributors: contributors.length,
            },
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Get detailed commit history for a repository
    this.server.tool(
      'getCommitHistory',
      'Get detailed commit history for a specific repository with filtering options',
      {
        owner: z.string().describe('The repository owner (username or organization)'),
        repo: z.string().describe('The repository name'),
        since: z.string().optional().describe('Only show commits after this date (ISO 8601 format)'),
        until: z.string().optional().describe('Only show commits before this date (ISO 8601 format)'),
        branch: z.string().optional().describe('Branch to get commits from (defaults to default branch)'),
        author: z.string().optional().describe('Filter commits by author username or email'),
        limit: z.number().optional().default(50).describe('Maximum number of commits to return'),
      },
      async ({ owner, repo, since, until, branch, author, limit }) => {
        try {
          const commits = await githubApi.getRecentCommits(owner, repo, since, branch);

          // Filter by author if specified
          let filteredCommits = commits;
          if (author) {
            filteredCommits = commits.filter(
              (commit) =>
                commit.commit.author.name.toLowerCase().includes(author.toLowerCase()) ||
                commit.commit.author.email.toLowerCase().includes(author.toLowerCase()) ||
                (commit.author && commit.author.login.toLowerCase().includes(author.toLowerCase())),
            );
          }

          // Filter by until date if specified
          if (until) {
            const untilDate = new Date(until);
            filteredCommits = filteredCommits.filter((commit) => new Date(commit.commit.author.date) <= untilDate);
          }

          // Limit results
          const limitedCommits = filteredCommits.slice(0, limit);

          const result = {
            repository: `${owner}/${repo}`,
            branch: branch || 'default',
            filters: {
              since,
              until,
              author,
            },
            total_found: filteredCommits.length,
            showing: limitedCommits.length,
            commits: limitedCommits.map((commit) => ({
              sha: commit.sha,
              short_sha: commit.sha.substring(0, 7),
              author: {
                name: commit.commit.author.name,
                email: commit.commit.author.email,
                username: commit.author?.login,
                date: commit.commit.author.date,
              },
              committer: {
                name: commit.commit.committer.name,
                email: commit.commit.committer.email,
                username: commit.committer?.login,
                date: commit.commit.committer.date,
              },
              message: commit.commit.message,
              url: commit.html_url,
            })),
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Get contributor statistics for a repository
    this.server.tool(
      'getContributorStats',
      'Get detailed contributor statistics for a specific repository',
      {
        owner: z.string().describe('The repository owner (username or organization)'),
        repo: z.string().describe('The repository name'),
        limit: z.number().optional().default(50).describe('Maximum number of contributors to return'),
      },
      async ({ owner, repo, limit }) => {
        try {
          const contributors = await githubApi.getContributors(owner, repo);

          // Limit results
          const limitedContributors = contributors.slice(0, limit);

          const result = {
            repository: `${owner}/${repo}`,
            total_contributors: contributors.length,
            showing: limitedContributors.length,
            contributors: limitedContributors.map((contributor) => ({
              login: contributor.login,
              contributions: contributor.contributions,
              avatar_url: contributor.avatar_url,
              type: contributor.type,
            })),
            statistics: {
              total_contributions: contributors.reduce((sum, c) => sum + c.contributions, 0),
              average_contributions:
                contributors.length > 0 ? Math.round(contributors.reduce((sum, c) => sum + c.contributions, 0) / contributors.length) : 0,
              top_contributor:
                contributors.length > 0
                  ? {
                      login: contributors[0].login,
                      contributions: contributors[0].contributions,
                      percentage:
                        contributors.length > 0
                          ? Math.round((contributors[0].contributions / contributors.reduce((sum, c) => sum + c.contributions, 0)) * 100)
                          : 0,
                    }
                  : null,
            },
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // List organization projects (GitHub Projects v2)
    this.server.tool(
      'listOrganizationProjects',
      'List all GitHub Projects v2 for a specific organization',
      {
        organization: z.string().describe('The GitHub organization name'),
        includePrivate: z.boolean().optional().default(true).describe('Include private projects'),
        limit: z.number().optional().default(50).describe('Maximum number of projects to return'),
      },
      async ({ organization, includePrivate, limit }) => {
        try {
          const projects = await githubApi.getOrganizationProjects(organization);

          // Filter by visibility if needed
          let filteredProjects = projects;
          if (!includePrivate) {
            filteredProjects = projects.filter((project) => project.visibility === 'PUBLIC');
          }

          // Limit results
          const limitedProjects = filteredProjects.slice(0, limit);

          const result = {
            organization,
            total_projects: filteredProjects.length,
            showing: limitedProjects.length,
            projects: limitedProjects.map((project) => ({
              id: project.id,
              number: project.number,
              title: project.title,
              description: project.description,
              visibility: project.visibility,
              closed: project.closed,
              items_count: project.itemsCount,
              created_at: project.createdAt,
              updated_at: project.updatedAt,
              url: project.url,
            })),
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Get detailed project information including all tasks
    this.server.tool(
      'getProjectBoardDetails',
      'Get detailed information about a GitHub Projects v2 board including all tasks, fields, and status',
      {
        includeFields: z.boolean().optional().default(true).describe('Include custom field information'),
        includeItems: z.boolean().optional().default(true).describe('Include all project items (issues, PRs, draft issues)'),
        limit: z.number().optional().default(100).describe('Maximum number of items to return'),
      },
      async ({ includeFields, includeItems, limit }) => {
        try {
          const projectDetails = await githubApi.getProjectDetails(PROJECT_BOARD_ID);

          const result = {
            project: {
              id: projectDetails.project.id,
              number: projectDetails.project.number,
              title: projectDetails.project.title,
              description: projectDetails.project.description,
              visibility: projectDetails.project.visibility,
              closed: projectDetails.project.closed,
              owner: projectDetails.project.owner,
              created_at: projectDetails.project.createdAt,
              updated_at: projectDetails.project.updatedAt,
              url: projectDetails.project.url,
              total_items: projectDetails.totalItemsCount,
            },
            summary: projectDetails.summary,
            fields: includeFields
              ? projectDetails.fields.map((field) => ({
                  id: field.id,
                  name: field.name,
                  data_type: field.dataType,
                  options: field.options,
                }))
              : [],
            items: includeItems
              ? projectDetails.items.slice(0, limit).map((item) => ({
                  id: item.id,
                  type: item.type,
                  title: item.content.title,
                  url: item.content.url,
                  number: item.content.number,
                  state: item.content.state,
                  body: item.content.body ? item.content.body.substring(0, 500) + (item.content.body.length > 500 ? '...' : '') : null,
                  author: item.content.author,
                  assignees: item.content.assignees,
                  labels: item.content.labels,
                  created_at: item.content.createdAt,
                  updated_at: item.content.updatedAt,
                  field_values: item.fieldValues.map((fv) => ({
                    field_name: fv.field.name,
                    field_type: fv.field.type,
                    value: fv.value,
                  })),
                }))
              : [],
            showing_items: includeItems ? Math.min(limit, projectDetails.items.length) : 0,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Update project item fields
    this.server.tool(
      'updateProjectBoardItem',
      'Update custom field values for an item in a GitHub Projects v2 board (status, start time, end time, etc). Note: Built-in fields like Title, Assignees, Labels cannot be updated through this tool.',
      {
        itemId: z.string().describe('The project item ID (can be obtained from getProjectBoardDetails)'),
        fieldName: z
          .string()
          .describe(
            "The name of the CUSTOM field to update (e.g., 'Status', 'Priority'). Cannot update built-in fields like Title, Assignees, Labels.",
          ),
        value: z
          .union([
            z.string().describe('Text value or status name'),
            z.number().describe('Numeric value'),
            z.enum(PROJECT_STATUSES).describe('For Status field, use one of the predefined statuses'),
            z
              .object({
                optionName: z.string().describe('For single-select fields, the name of the option to select'),
              })
              .describe('Object format for single-select fields'),
          ])
          .describe('The new value for the field. For Status field, use one of: ' + PROJECT_STATUSES.join(', ')),
      },
      async (params) => {
        const projectId = PROJECT_BOARD_ID;

        const { itemId, fieldName, value } = params;

        try {
          // Check if all required parameters are provided
          if (!itemId) {
            throw new Error(`itemId parameter is required`);
          }
          if (!fieldName) {
            throw new Error(`fieldName parameter is required`);
          }
          if (value === undefined || value === null) {
            throw new Error(`value parameter is required. Received: ${value}. Please provide a value for the field.`);
          }
          // Get project details to find field information
          const projectDetails = await githubApi.getProjectDetails(projectId);

          // Check for built-in fields that cannot be updated via updateProjectV2ItemFieldValue
          const readOnlyFields = ['title', 'assignees', 'labels', 'repository', 'milestone'];
          if (readOnlyFields.includes(fieldName.toLowerCase())) {
            throw new Error(`Field '${fieldName}' is a built-in field that cannot be updated. Only custom project fields can be modified.`);
          }

          // Find the field
          const field = projectDetails.fields.find((f) => f.name.toLowerCase() === fieldName.toLowerCase());

          if (!field) {
            // List available fields for better error message
            const availableFields = projectDetails.fields.map((f) => f.name).join(', ');
            throw new Error(`Field '${fieldName}' not found in project. Available custom fields: ${availableFields}`);
          }

          // Prepare the value based on field type
          let fieldValue: any = {};

          switch (field.dataType) {
            case 'TEXT':
              fieldValue.text = String(value);
              break;
            case 'NUMBER':
              fieldValue.number = typeof value === 'number' ? value : parseFloat(String(value));
              break;
            case 'DATE':
              fieldValue.date = String(value);
              break;
            case 'SINGLE_SELECT':
              if (typeof value === 'object' && 'optionName' in value) {
                const option = field.options?.find((opt) => opt.name.toLowerCase() === value.optionName.toLowerCase());
                if (!option) {
                  throw new Error(`Option '${value.optionName}' not found for field '${fieldName}'`);
                }
                fieldValue.singleSelectOptionId = option.id;
              } else {
                // Try to match the value as a string
                const option = field.options?.find((opt) => opt.name.toLowerCase() === String(value).toLowerCase());
                if (!option) {
                  throw new Error(`Option '${value}' not found for field '${fieldName}'`);
                }
                fieldValue.singleSelectOptionId = option.id;
              }
              break;
            default:
              throw new Error(`Unsupported field type: ${field.dataType}`);
          }

          // Update the field
          await githubApi.updateProjectItemField(projectId, itemId, field.id, fieldValue);

          const result = {
            projectId,
            itemId,
            field: {
              name: field.name,
              type: field.dataType,
              value: value,
            },
            message: `Field '${fieldName}' updated successfully`,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error updating project item: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Update draft issue title and/or description
    this.server.tool(
      'updateProjectBoardDraftIssueTitle',
      'Update the title and/or description of a draft issue in a GitHub Projects v2 board',
      {
        itemId: z.string().describe('The project item ID of the draft issue (can be obtained from getProjectBoardDetails)'),
        title: z.string().optional().describe('The new title for the draft issue (leave empty to keep current title)'),
        body: z.string().optional().describe('The new description/body for the draft issue (leave empty to keep current body)'),
      },
      async ({ itemId, title, body }) => {
        const projectId = PROJECT_BOARD_ID;

        try {
          // At least one field must be provided
          if (!title && !body) {
            throw new Error("At least one of 'title' or 'body' must be provided to update the draft issue");
          }

          // First, get the project details to verify this is a draft issue
          const projectDetails = await githubApi.getProjectDetails(projectId);
          const item = projectDetails.items.find((i) => i.id === itemId);

          if (!item) throw new Error(`Project item with ID '${itemId}' not found`);

          if (item.type !== 'DRAFT_ISSUE') {
            throw new Error(
              `Item '${itemId}' is not a draft issue. Only draft issues can be updated this way. For repository issues, update the title/body directly in the repository.`,
            );
          }

          // Get the actual draft issue ID from the project item content
          const draftIssueId = item.content.id;

          // Build the mutation dynamically based on provided fields
          const updateFields: string[] = [];
          const variables: any = { draftIssueId };

          if (title !== undefined) {
            updateFields.push('title: $title');
            variables.title = title;
          }

          if (body !== undefined) {
            updateFields.push('body: $body');
            variables.body = body;
          }

          const mutation = `
            mutation($draftIssueId: ID!${title !== undefined ? ', $title: String!' : ''}${body !== undefined ? ', $body: String' : ''}) {
              updateProjectV2DraftIssue(input: {
                draftIssueId: $draftIssueId,
                ${updateFields.join(',\n                ')}
              }) {
                draftIssue {
                  id
                  title
                  body
                }
              }
            }
          `;

          const response = await githubApi.octokit.graphql<{
            updateProjectV2DraftIssue: {
              draftIssue: {
                id: string;
                title: string;
                body: string;
              };
            };
          }>(mutation, variables);

          const updatedFields: string[] = [];
          if (title !== undefined)
            updatedFields.push(`title: '${item.content.title}' → '${response.updateProjectV2DraftIssue.draftIssue.title}'`);
          if (body !== undefined) updatedFields.push(`body: ${item.content.body ? 'updated' : 'added'}`);

          const result = {
            projectItemId: itemId,
            draftIssueId: draftIssueId,
            updates: {
              title:
                title !== undefined
                  ? {
                      old: item.content.title,
                      new: response.updateProjectV2DraftIssue.draftIssue.title,
                    }
                  : null,
              body:
                body !== undefined
                  ? {
                      old: item.content.body || null,
                      new: response.updateProjectV2DraftIssue.draftIssue.body || null,
                    }
                  : null,
            },
            message: `Draft issue updated successfully: ${updatedFields.join(', ')}`,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error updating draft issue: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Create a draft issue in a project
    this.server.tool(
      'createProjectBoardDraftIssue',
      'Create a draft issue directly in a GitHub Projects v2 board without creating a repository issue',
      {
        title: z.string().describe('The draft issue title'),
        body: z.string().optional().describe('The draft issue body/description'),
        initialStatus: z
          .enum(PROJECT_STATUSES)
          .optional()
          .describe('Initial status column to set. Options: ' + PROJECT_STATUSES.join(', ')),
      },
      async ({ title, body, initialStatus }) => {
        const projectId = PROJECT_BOARD_ID;

        try {
          // Create the draft issue
          const draftItem = await githubApi.createProjectDraftIssue(projectId, title, body);

          let statusUpdate = null;
          if (initialStatus) {
            // Set the initial status using our helper method
            const statusResult = await this.setProjectItemStatus(githubApi, projectId, draftItem.itemId, initialStatus);
            statusUpdate = {
              success: statusResult.success,
              value: statusResult.success ? initialStatus : null,
              error: statusResult.error || null,
            };
          }

          const result = {
            projectId,
            itemId: draftItem.itemId,
            draftIssue: {
              title,
              body: body || null,
              type: 'DRAFT_ISSUE',
            },
            statusUpdate,
            message: `Draft issue created successfully${
              statusUpdate?.success
                ? ` with status '${statusUpdate.value}'`
                : statusUpdate?.error
                  ? ` (status update failed: ${statusUpdate.error})`
                  : ''
            }`,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error creating draft issue: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Quick status update tool
    // this.server.tool(
    //   "updateProjectBoardItemStatus",
    //   "Update the status column of a project item quickly",
    //   {
    //     itemId: z.string().describe("The project item ID (can be obtained from getProjectBoardDetails)"),
    //     status: z.enum(PROJECT_STATUSES).describe("The new status to set. Options: " + PROJECT_STATUSES.join(", ")),
    //   },
    //   async ({ itemId, status }) => {
    //     const projectId = PROJECT_BOARD_ID;

    //     try {
    //       const statusResult = await this.setProjectItemStatus(githubApi, projectId, itemId, status);

    //       const result = {
    //         projectId,
    //         itemId,
    //         status: status,
    //         success: statusResult.success,
    //         error: statusResult.error || null,
    //         message: statusResult.success ? `Status updated to '${status}' successfully` : `Failed to update status: ${statusResult.error}`,
    //       };

    //       return {
    //         content: [{ text: JSON.stringify(result, null, 2), type: "text" }],
    //       };
    //     } catch (error: any) {
    //       return {
    //         content: [{ text: `Error updating status: ${error.message}`, type: "text" }],
    //       };
    //     }
    //   },
    // );

    // Get EFP statistics from Dune Analytics
    this.server.tool(
      'getEFPDuneStatistics',
      'Fetch EFP (Ethereum Follow Protocol) statistics and analytics from Dune Analytics dashboard',
      {
        searchQuery: z.string().optional().describe('Search for a specific Dune query by name (leave blank to get all queries)'),
      },
      async ({ searchQuery }: { searchQuery?: string }) => {
        try {
          const duneApiKey = this.env.DUNE_API_KEY;
          if (!duneApiKey) {
            return {
              content: [
                {
                  text: JSON.stringify(
                    {
                      error: 'Dune API key not configured',
                      message: 'DUNE_API_KEY environment variable is required but not set',
                      setup_instructions: 'Add DUNE_API_KEY to your wrangler.jsonc vars section',
                    },
                    null,
                    2,
                  ),
                  type: 'text',
                },
              ],
            };
          }

          const queries = EFP_STATS_DUNE_QUERIES;

          // Filter queries based on target if provided
          const filteredQueries = searchQuery ? queries.filter((q) => q.name.toLowerCase().includes(searchQuery.toLowerCase())) : queries;

          if (filteredQueries.length === 0) {
            return {
              content: [
                {
                  text: JSON.stringify(
                    {
                      message: searchQuery ? `No queries found matching: "${searchQuery}"` : 'No queries available',
                      available_queries: queries.map((q) => q.name),
                    },
                    null,
                    2,
                  ),
                  type: 'text',
                },
              ],
            };
          }

          // Fetch results for each query individually with error handling
          const results = await Promise.allSettled(
            filteredQueries.map(async (query) => {
              try {
                const resultsResponse = await fetch(`https://api.dune.com/api/v1/query/${query.queryId}/results?limit=1000`, {
                  method: 'GET',
                  headers: {
                    'X-Dune-API-Key': duneApiKey,
                  },
                });

                if (!resultsResponse.ok) {
                  const errorText = await resultsResponse.text();
                  return {
                    query_name: query.name,
                    query_id: query.queryId,
                    status: 'error',
                    error: `HTTP ${resultsResponse.status}`,
                    details: errorText,
                  };
                }

                const data = (await resultsResponse.json()) as any;

                return {
                  query_name: query.name,
                  query_id: query.queryId,
                  status: 'success',
                  data: data.result || data,
                };
              } catch (error) {
                return {
                  query_name: query.name,
                  query_id: query.queryId,
                  status: 'error',
                  error: error instanceof Error ? error.message : String(error),
                };
              }
            }),
          );

          // Process results and separate successful from failed queries
          const processedResults = results.map((result, index) => {
            if (result.status === 'fulfilled') {
              return result.value;
            } else {
              return {
                query_name: filteredQueries[index].name,
                query_id: filteredQueries[index].queryId,
                status: 'error',
                error: result.reason instanceof Error ? result.reason.message : String(result.reason),
              };
            }
          });

          const successfulQueries = processedResults.filter((r) => r.status === 'success');
          const failedQueries = processedResults.filter((r) => r.status === 'error');

          const response = {
            source: 'Dune Analytics',
            dashboard_url: 'https://dune.com/throw_efp/efp',
            total_queries_requested: filteredQueries.length,
            successful_queries: successfulQueries.length,
            failed_queries: failedQueries.length,
            results: processedResults,
          };

          return {
            content: [{ text: JSON.stringify(response, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error fetching EFP Dune statistics: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Quick financial report tool (no OCR)
    this.server.tool(
      'getFinancialReportQuick',
      'Get pre-cached financial report data (fast, no OCR required)',
      {
        quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']).describe('The quarter (Q1, Q2, Q3, or Q4)'),
        year: z.number().min(2024).max(2025).describe('The year (2024 or 2025)'),
      },
      async ({ quarter, year }) => {
        try {
          const report = await financialReportsService.getReportByQuarter(quarter, year);

          if (!report) {
            return {
              content: [
                {
                  text: JSON.stringify(
                    {
                      error: 'Report not found',
                      message: `No financial report found for ${year} ${quarter}`,
                    },
                    null,
                    2,
                  ),
                  type: 'text',
                },
              ],
            };
          }

          const result = {
            period: `${year} ${quarter}`,
            report_url: `https://discuss.ens.domains/t/eif-efp-spp-financial-and-progress-reports/20102`,
            image_urls: report.imageUrls,
            has_cached_data: !!report.extractedData,
            message: report.extractedData
              ? 'Pre-cached data available'
              : 'No cached data - use getFinancialReport with forceRefresh=false for OCR extraction',
            cached_data: report.extractedData || null,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    this.server.tool('listFinancialReports', 'List all available financial reports by quarter', {}, async () => {
      try {
        const reports = await financialReportsService.getAvailableReports();

        const result = {
          total_reports: reports.length,
          reports: reports
            .map((report) => ({
              quarter: report.quarter,
              year: report.year,
              period: `${report.year} ${report.quarter}`,
            }))
            .sort((a, b) => {
              // Sort by year and quarter
              if (a.year !== b.year) return b.year - a.year;
              const quarterOrder = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
              return quarterOrder[b.quarter as keyof typeof quarterOrder] - quarterOrder[a.quarter as keyof typeof quarterOrder];
            }),
        };

        return {
          content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
        };
      } catch (error: any) {
        return {
          content: [{ text: `Error listing financial reports: ${error.message}`, type: 'text' }],
        };
      }
    });

    // Get specific financial report
    this.server.tool(
      'getFinancialReport',
      'Extract and retrieve financial data from a specific quarterly report',
      {
        quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']).describe('The quarter (Q1, Q2, Q3, or Q4)'),
        year: z.number().min(2024).max(2025).describe('The year (2024 or 2025)'),
        forceRefresh: z.boolean().optional().default(false).describe('Force re-extraction of data from images'),
      },
      async ({ quarter, year, forceRefresh }) => {
        try {
          let report = await financialReportsService.getReportByQuarter(quarter, year);

          if (!report) {
            return {
              content: [
                {
                  text: JSON.stringify(
                    {
                      error: 'Report not found',
                      message: `No financial report found for ${year} ${quarter}`,
                    },
                    null,
                    2,
                  ),
                  type: 'text',
                },
              ],
            };
          }

          // Extract data if not already cached or if force refresh is requested
          if (!report.extractedData || forceRefresh) {
            report = await financialReportsService.processAndCacheReport(quarter, year, forceRefresh);
          }

          const result = {
            period: `${year} ${quarter}`,
            report_details: {
              quarter: report!.quarter,
              year: report!.year,
              image_count: report!.imageUrls.length,
            },
            financial_data: report!.extractedData
              ? {
                  revenue: report!.extractedData.revenue,
                  expenses: report!.extractedData.expenses,
                  net_income: report!.extractedData.netIncome,
                  gross_profit: report!.extractedData.grossProfit,
                  operating_income: report!.extractedData.operatingIncome,
                  assets: report!.extractedData.assets,
                  liabilities: report!.extractedData.liabilities,
                  equity: report!.extractedData.equity,
                  cash_flow: report!.extractedData.cashFlow,
                  additional_metrics: report!.extractedData.customMetrics,
                }
              : null,
            raw_text_preview: report!.extractedData ? report!.extractedData.rawText : 'No data extracted yet',
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error retrieving financial report: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    this.server.tool(
      'compareFinancialReports',
      'Compare financial metrics across multiple quarters',
      {
        quarters: z
          .array(
            z.object({
              quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
              year: z.number().min(2024).max(2025),
            }),
          )
          .min(2)
          .max(5)
          .describe('Array of quarters to compare (2-5 quarters)'),
        metrics: z.array(z.string()).optional().describe('Specific metrics to compare (leave empty for all)'),
      },
      async ({ quarters, metrics }) => {
        try {
          // Process all reports
          const reports = await Promise.all(
            quarters.map(async (q) => {
              const report = await financialReportsService.processAndCacheReport(q.quarter, q.year);
              return { quarter: q, report };
            }),
          );

          const validReports = reports.filter((r) => r.report !== null && r.report.extractedData);

          if (validReports.length === 0) {
            return {
              content: [
                {
                  text: JSON.stringify(
                    {
                      error: 'No valid reports found',
                      message: 'Could not find or extract data from any of the specified quarters',
                      requested_quarters: quarters,
                    },
                    null,
                    2,
                  ),
                  type: 'text',
                },
              ],
            };
          }

          // Default metrics if none specified
          const metricsToCompare =
            metrics && metrics.length > 0
              ? metrics
              : ['revenue', 'expenses', 'netIncome', 'assets', 'eth_value', 'ens_value', 'usdc_holdings'];

          // Build comparison data
          const comparison: any = {
            periods: validReports.map((r) => `${r.quarter.year} ${r.quarter.quarter}`),
            metrics_comparison: {},
            available_metrics: new Set<string>(),
          };

          // Collect all available metrics
          validReports.forEach(({ report }) => {
            if (report?.extractedData) {
              // Standard metrics
              Object.keys(report.extractedData).forEach((key) => {
                // @ts-ignore
                if (key !== 'rawText' && key !== 'customMetrics' && report.extractedData![key as keyof ExtractedFinancialData]) {
                  comparison.available_metrics.add(key);
                }
              });
              // Custom metrics
              if (report.extractedData.customMetrics) {
                Object.keys(report.extractedData.customMetrics).forEach((key) => {
                  comparison.available_metrics.add(key);
                });
              }
            }
          });

          // Compare each metric
          for (const metric of metricsToCompare) {
            comparison.metrics_comparison[metric] = validReports.map(({ quarter, report }) => {
              let value = null;

              if (report?.extractedData) {
                // Check standard metrics
                if (metric in report.extractedData && metric !== 'customMetrics' && metric !== 'rawText') {
                  // @ts-ignore
                  value = report.extractedData[metric as keyof ExtractedFinancialData];
                }
                // Check custom metrics
                else if (report.extractedData.customMetrics && metric in report.extractedData.customMetrics) {
                  value = report.extractedData.customMetrics[metric];
                }
              }

              return {
                period: `${quarter.year} ${quarter.quarter}`,
                value: value,
                formatted:
                  value !== null ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A',
              };
            });
          }

          // Calculate growth rates for metrics with at least 2 valid values
          comparison.growth_rates = {};
          for (const metric of metricsToCompare) {
            const values = comparison.metrics_comparison[metric]
              .map((item: any) => item.value)
              .filter((v: any) => v !== null && v !== undefined);

            if (values.length >= 2) {
              const firstValue = values[0];
              const lastValue = values[values.length - 1];

              comparison.growth_rates[metric] = {
                absolute_change: lastValue - firstValue,
                percentage_change: firstValue !== 0 ? ((lastValue - firstValue) / Math.abs(firstValue)) * 100 : null,
                period: `${validReports[0].quarter.year} ${validReports[0].quarter.quarter} to ${validReports[validReports.length - 1].quarter.year} ${validReports[validReports.length - 1].quarter.quarter}`,
                trend: lastValue > firstValue ? 'increasing' : lastValue < firstValue ? 'decreasing' : 'stable',
              };
            }
          }

          // Convert Set to Array for JSON serialization
          comparison.available_metrics = Array.from(comparison.available_metrics);

          // Add summary
          comparison.summary = {
            reports_analyzed: validReports.length,
            metrics_compared: Object.keys(comparison.metrics_comparison).length,
            metrics_with_growth_data: Object.keys(comparison.growth_rates).length,
          };

          return {
            content: [{ text: JSON.stringify(comparison, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error comparing financial reports: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // GitHub Issue Management Tools

    // Create a new GitHub issue
    this.server.tool(
      'createGitHubIssue',
      'Create a new issue in a GitHub repository with full support for assignees, labels, and milestones',
      {
        owner: z.string().describe('The repository owner (username or organization)'),
        repo: z.string().describe('The repository name'),
        title: z.string().describe('The issue title'),
        body: z.string().optional().describe('The issue description/body in markdown format'),
        assignees: z.array(z.string()).optional().describe('Array of GitHub usernames to assign to the issue'),
        labels: z.array(z.string()).optional().describe('Array of label names to apply to the issue'),
        milestone: z.number().optional().describe('Milestone number to assign to the issue'),
        addToProject: z.boolean().optional().default(false).describe('Whether to add the issue to the default project board'),
      },
      async ({ owner, repo, title, body, assignees, labels, milestone, addToProject }) => {
        try {
          // Add MCP co-author attribution to issue body
          const bodyWithCoAuthor = body
            ? `${body}\n\nCo-authored-by: mcp-agent <mcp-agent@protonmail.com>`
            : 'Co-authored-by: mcp-agent <mcp-agent@protonmail.com>';

          // Create the issue
          const issue = await githubApi.createIssue(owner, repo, title, bodyWithCoAuthor, assignees, labels, milestone);

          let projectItemId = null;
          if (addToProject) {
            try {
              // Add the issue to the default project if specified
              const projectItem = await githubApi.addIssueToProject(PROJECT_BOARD_ID, issue.id);
              projectItemId = projectItem.itemId;
            } catch (projError: any) {
              console.error(`Failed to add issue to project: ${projError.message}`);
            }
          }

          const result = {
            issue: {
              id: issue.id,
              number: issue.number,
              url: issue.url,
              title,
              repository: `${owner}/${repo}`,
            },
            project: addToProject
              ? {
                  projectId: PROJECT_BOARD_ID,
                  itemId: projectItemId,
                  status: projectItemId ? 'added' : 'failed to add',
                }
              : null,
            message: `Issue #${issue.number} created successfully${addToProject && projectItemId ? ' and added to project board' : ''}`,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error creating issue: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Comment on a GitHub issue
    this.server.tool(
      'commentOnGitHubIssue',
      'Add a comment to an existing GitHub issue',
      {
        owner: z.string().describe('The repository owner (username or organization)'),
        repo: z.string().describe('The repository name'),
        issueNumber: z.number().describe('The issue number to comment on'),
        body: z.string().describe('The comment body in markdown format'),
      },
      async ({ owner, repo, issueNumber, body }) => {
        try {
          // Add MCP co-author attribution to comment body
          const bodyWithCoAuthor = `${body}\n\nCo-authored-by: mcp-agent <mcp-agent@protonmail.com>`;

          const comment = await githubApi.commentOnIssue(owner, repo, issueNumber, bodyWithCoAuthor);

          const result = {
            comment: {
              id: comment.id,
              url: comment.url,
            },
            issue: {
              number: issueNumber,
              repository: `${owner}/${repo}`,
            },
            message: `Comment added successfully to issue #${issueNumber}`,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error commenting on issue: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Update issue assignees
    this.server.tool(
      'updateIssueAssignees',
      'Update the assignees for a GitHub issue',
      {
        owner: z.string().describe('The repository owner (username or organization)'),
        repo: z.string().describe('The repository name'),
        issueNumber: z.number().describe('The issue number to update'),
        assignees: z.array(z.string()).describe('Array of GitHub usernames to assign (replaces existing assignees)'),
      },
      async ({ owner, repo, issueNumber, assignees }) => {
        try {
          await githubApi.updateIssueAssignees(owner, repo, issueNumber, assignees);

          const result = {
            issue: {
              number: issueNumber,
              repository: `${owner}/${repo}`,
            },
            assignees,
            message: `Assignees updated successfully for issue #${issueNumber}`,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error updating assignees: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Update issue labels
    this.server.tool(
      'updateIssueLabels',
      'Update the labels for a GitHub issue',
      {
        owner: z.string().describe('The repository owner (username or organization)'),
        repo: z.string().describe('The repository name'),
        issueNumber: z.number().describe('The issue number to update'),
        labels: z.array(z.string()).describe('Array of label names to apply (replaces existing labels)'),
      },
      async ({ owner, repo, issueNumber, labels }) => {
        try {
          await githubApi.updateIssueLabels(owner, repo, issueNumber, labels);

          const result = {
            issue: {
              number: issueNumber,
              repository: `${owner}/${repo}`,
            },
            labels,
            message: `Labels updated successfully for issue #${issueNumber}`,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error updating labels: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Close a GitHub issue
    this.server.tool(
      'closeIssue',
      'Close a GitHub issue with an optional reason',
      {
        owner: z.string().describe('The repository owner (username or organization)'),
        repo: z.string().describe('The repository name'),
        issueNumber: z.number().describe('The issue number to close'),
        reason: z.enum(['COMPLETED', 'NOT_PLANNED']).optional().default('COMPLETED').describe('Reason for closing the issue'),
      },
      async ({ owner, repo, issueNumber, reason }) => {
        try {
          await githubApi.closeIssue(owner, repo, issueNumber, reason);

          const result = {
            issue: {
              number: issueNumber,
              repository: `${owner}/${repo}`,
            },
            reason,
            message: `Issue #${issueNumber} closed successfully with reason: ${reason}`,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error closing issue: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Reopen a GitHub issue
    this.server.tool(
      'reopenIssue',
      'Reopen a closed GitHub issue',
      {
        owner: z.string().describe('The repository owner (username or organization)'),
        repo: z.string().describe('The repository name'),
        issueNumber: z.number().describe('The issue number to reopen'),
      },
      async ({ owner, repo, issueNumber }) => {
        try {
          await githubApi.reopenIssue(owner, repo, issueNumber);

          const result = {
            issue: {
              number: issueNumber,
              repository: `${owner}/${repo}`,
            },
            message: `Issue #${issueNumber} reopened successfully`,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error reopening issue: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Update issue title and/or body
    this.server.tool(
      'updateIssue',
      'Update the title and/or body of a GitHub issue',
      {
        owner: z.string().describe('The repository owner (username or organization)'),
        repo: z.string().describe('The repository name'),
        issueNumber: z.number().describe('The issue number to update'),
        title: z.string().optional().describe('New title for the issue (leave empty to keep current title)'),
        body: z.string().optional().describe('New body for the issue (leave empty to keep current body)'),
      },
      async ({ owner, repo, issueNumber, title, body }) => {
        try {
          await githubApi.updateIssue(owner, repo, issueNumber, title, body);

          const updates: string[] = [];
          if (title) updates.push('title');
          if (body !== undefined) updates.push('body');

          const result = {
            issue: {
              number: issueNumber,
              repository: `${owner}/${repo}`,
            },
            updated_fields: updates,
            message: `Issue #${issueNumber} updated successfully (${updates.join(', ')})`,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error updating issue: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Get issue details
    this.server.tool(
      'getIssueDetails',
      'Get detailed information about a specific GitHub issue',
      {
        owner: z.string().describe('The repository owner (username or organization)'),
        repo: z.string().describe('The repository name'),
        issueNumber: z.number().describe('The issue number to get details for'),
      },
      async ({ owner, repo, issueNumber }) => {
        try {
          const issue = await githubApi.getIssueByNumber(owner, repo, issueNumber);

          const result = {
            issue: {
              ...issue,
              repository: `${owner}/${repo}`,
            },
            message: `Details retrieved for issue #${issueNumber}`,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error getting issue details: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Add existing issue to project board
    this.server.tool(
      'addIssueToProject',
      'Add an existing GitHub issue or pull request to the project board',
      {
        owner: z.string().describe('The repository owner (username or organization)'),
        repo: z.string().describe('The repository name'),
        issueNumber: z.number().describe('The issue or pull request number to add'),
        initialStatus: z
          .enum(PROJECT_STATUSES)
          .optional()
          .describe('Initial status to set for the item. Options: ' + PROJECT_STATUSES.join(', ')),
      },
      async ({ owner, repo, issueNumber, initialStatus }) => {
        try {
          // Get the issue/PR ID
          const contentId = await githubApi.getIssueIdByNumber(owner, repo, issueNumber);

          // Add to project
          const projectItem = await githubApi.addIssueToProject(PROJECT_BOARD_ID, contentId);

          let statusUpdate = null;
          if (initialStatus) {
            // Set the initial status using our helper method
            const statusResult = await this.setProjectItemStatus(githubApi, PROJECT_BOARD_ID, projectItem.itemId, initialStatus);
            statusUpdate = {
              success: statusResult.success,
              value: statusResult.success ? initialStatus : null,
              error: statusResult.error || null,
            };
          }

          const result = {
            projectId: PROJECT_BOARD_ID,
            itemId: projectItem.itemId,
            issue: {
              number: issueNumber,
              repository: `${owner}/${repo}`,
            },
            statusUpdate,
            message: `Issue #${issueNumber} added to project successfully${
              statusUpdate?.success
                ? ` with status '${statusUpdate.value}'`
                : statusUpdate?.error
                  ? ` (status update failed: ${statusUpdate.error})`
                  : ''
            }`,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error adding issue to project: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // GitHub Pull Request Management Tools

    // Create a new pull request
    this.server.tool(
      'createPullRequest',
      'Create a new pull request in a GitHub repository',
      {
        owner: z.string().describe('Repository owner (username or organization)'),
        repo: z.string().describe('Repository name'),
        title: z.string().describe('Pull request title'),
        head: z.string().describe('The name of the branch where your changes are implemented (source branch)'),
        base: z.string().describe("The name of the branch you want the changes pulled into (target branch, usually 'main' or 'master')"),
        body: z.string().optional().describe('Pull request description in markdown format'),
        draft: z.boolean().optional().default(false).describe('Create as a draft pull request'),
        maintainerCanModify: z.boolean().optional().default(true).describe('Allow maintainers to modify the pull request'),
      },
      async ({ owner, repo, title, head, base, body, draft, maintainerCanModify }) => {
        const githubApi = new GitHubApiService(this.props.accessToken);

        try {
          // Add MCP co-author attribution to PR body
          const bodyWithCoAuthor = body
            ? `${body}\n\nCo-authored-by: mcp-agent <mcp-agent@protonmail.com>`
            : 'Co-authored-by: mcp-agent <mcp-agent@protonmail.com>';

          const pr = await githubApi.createPullRequest(owner, repo, title, head, base, bodyWithCoAuthor, draft, maintainerCanModify);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    pull_request: {
                      id: pr.id,
                      number: pr.number,
                      url: pr.url,
                      title,
                      head_branch: head,
                      base_branch: base,
                      is_draft: draft,
                      mergeable_state: pr.mergeableState,
                      repository: `${owner}/${repo}`,
                    },
                    message: `Pull request #${pr.number} created successfully`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating pull request: ${error.message}`,
              },
            ],
          };
        }
      },
    );

    // Comment on a pull request
    this.server.tool(
      'commentOnPullRequest',
      'Add a comment to an existing GitHub pull request',
      {
        owner: z.string().describe('Repository owner (username or organization)'),
        repo: z.string().describe('Repository name'),
        prNumber: z.number().describe('Pull request number to comment on'),
        body: z.string().describe('Comment body in markdown format'),
      },
      async ({ owner, repo, prNumber, body }) => {
        const githubApi = new GitHubApiService(this.props.accessToken);

        try {
          // Add MCP co-author attribution to comment body
          const bodyWithCoAuthor = `${body}\n\nCo-authored-by: mcp-agent <mcp-agent@protonmail.com>`;

          const comment = await githubApi.commentOnPullRequest(owner, repo, prNumber, bodyWithCoAuthor);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    comment: {
                      id: comment.id,
                      url: comment.url,
                    },
                    pull_request: {
                      number: prNumber,
                      repository: `${owner}/${repo}`,
                    },
                    message: `Comment added successfully to pull request #${prNumber}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error commenting on pull request: ${error.message}`,
              },
            ],
          };
        }
      },
    );

    // Get pull request details
    this.server.tool(
      'getPullRequestDetails',
      'Get detailed information about a specific GitHub pull request',
      {
        owner: z.string().describe('Repository owner (username or organization)'),
        repo: z.string().describe('Repository name'),
        prNumber: z.number().describe('Pull request number to get details for'),
      },
      async ({ owner, repo, prNumber }) => {
        const githubApi = new GitHubApiService(this.props.accessToken);

        try {
          const pr = await githubApi.getPullRequestDetails(owner, repo, prNumber);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    pull_request: {
                      id: pr.id,
                      number: pr.number,
                      title: pr.title,
                      body: pr.body,
                      state: pr.state,
                      is_draft: pr.isDraft,
                      author: pr.author,
                      base_branch: pr.baseRefName,
                      head_branch: pr.headRefName,
                      mergeable: pr.mergeable,
                      merge_state: pr.mergeStateStatus,
                      review_decision: pr.reviewDecision,
                      reviews: pr.reviews,
                      comment_count: pr.comments.totalCount,
                      created_at: pr.createdAt,
                      updated_at: pr.updatedAt,
                      url: pr.url,
                      repository: `${owner}/${repo}`,
                    },
                    message: `Details retrieved for pull request #${prNumber}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting pull request details: ${error.message}`,
              },
            ],
          };
        }
      },
    );

    // Git Repository Management Tools

    // Get repository file contents
    this.server.tool(
      'getRepositoryFile',
      'Read the contents of a specific file from a GitHub repository',
      {
        owner: z.string().describe('Repository owner (username or organization)'),
        repo: z.string().describe('Repository name'),
        path: z.string().describe('File path within the repository'),
        branch: z.string().optional().describe('Branch name to read from (defaults to default branch)'),
      },
      async ({ owner, repo, path, branch }) => {
        const githubApi = new GitHubApiService(this.props.accessToken);

        try {
          const file = await githubApi.getRepositoryFile(owner, repo, path, branch);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    file: {
                      path: file.path,
                      content: file.content,
                      encoding: file.encoding,
                      size: file.size,
                      sha: file.sha,
                      type: file.type,
                      download_url: file.downloadUrl,
                      repository: `${owner}/${repo}`,
                      branch: branch || 'default',
                    },
                    message: `File '${path}' retrieved successfully from ${owner}/${repo}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error reading repository file: ${error.message}`,
              },
            ],
          };
        }
      },
    );

    // Get repository directory tree
    this.server.tool(
      'getRepositoryTree',
      'Browse the file and directory structure of a GitHub repository',
      {
        owner: z.string().describe('Repository owner (username or organization)'),
        repo: z.string().describe('Repository name'),
        path: z.string().optional().describe('Directory path to browse (defaults to root)'),
        branch: z.string().optional().describe('Branch name to browse (defaults to default branch)'),
        recursive: z.boolean().optional().default(false).describe('Include subdirectories recursively'),
      },
      async ({ owner, repo, path, branch, recursive }) => {
        const githubApi = new GitHubApiService(this.props.accessToken);

        try {
          const tree = await githubApi.getRepositoryTree(owner, repo, path || '', branch, recursive);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    repository: `${owner}/${repo}`,
                    branch: branch || 'default',
                    path: tree.path,
                    sha: tree.sha,
                    total_items: tree.tree.length,
                    tree: tree.tree.map((item) => ({
                      path: item.path,
                      type: item.type,
                      size: item.size,
                      mode: item.mode,
                      sha: item.sha.substring(0, 7),
                      url: item.url,
                    })),
                    message: `Directory tree retrieved for '${tree.path || 'root'}' in ${owner}/${repo}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error reading repository tree: ${error.message}`,
              },
            ],
          };
        }
      },
    );

    // List all branches in repository
    this.server.tool(
      'listRepositoryBranches',
      'List all branches in a GitHub repository with their commit information',
      {
        owner: z.string().describe('Repository owner (username or organization)'),
        repo: z.string().describe('Repository name'),
        includeProtected: z.boolean().optional().default(false).describe('Include branch protection status'),
      },
      async ({ owner, repo, includeProtected }) => {
        const githubApi = new GitHubApiService(this.props.accessToken);

        try {
          const branches = await githubApi.listBranches(owner, repo, includeProtected);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    repository: `${owner}/${repo}`,
                    total_branches: branches.length,
                    branches: branches.map((branch) => ({
                      name: branch.name,
                      sha: branch.sha,
                      protected: branch.protected,
                      url: branch.url,
                      last_commit: {
                        sha: branch.lastCommit.sha,
                        message: branch.lastCommit.message,
                        author: branch.lastCommit.author,
                        date: branch.lastCommit.date,
                      },
                    })),
                    message: `Found ${branches.length} branches in ${owner}/${repo}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error listing repository branches: ${error.message}`,
              },
            ],
          };
        }
      },
    );

    // Get detailed information about a specific branch
    this.server.tool(
      'getBranchInfo',
      'Get detailed information about a specific branch including commit status and protection',
      {
        owner: z.string().describe('Repository owner (username or organization)'),
        repo: z.string().describe('Repository name'),
        branch: z.string().describe('Branch name to get information for'),
      },
      async ({ owner, repo, branch }) => {
        const githubApi = new GitHubApiService(this.props.accessToken);

        try {
          const branchInfo = await githubApi.getBranchInfo(owner, repo, branch);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    branch: {
                      name: branchInfo.name,
                      sha: branchInfo.sha,
                      protected: branchInfo.protected,
                      url: branchInfo.url,
                      ahead: branchInfo.ahead,
                      behind: branchInfo.behind,
                      base_branch: branchInfo.baseBranch,
                      last_commit: branchInfo.lastCommit,
                      repository: `${owner}/${repo}`,
                    },
                    message: `Branch information retrieved for '${branch}' in ${owner}/${repo}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting branch information: ${error.message}`,
              },
            ],
          };
        }
      },
    );

    // Create a new branch
    this.server.tool(
      'createBranch',
      'Create a new branch in a GitHub repository from a base branch',
      {
        owner: z.string().describe('Repository owner (username or organization)'),
        repo: z.string().describe('Repository name'),
        branchName: z.string().describe("Name for the new branch (e.g., 'feature/auth-improvements')"),
        baseBranch: z.string().optional().default('main').describe("Base branch to create from (defaults to 'main')"),
        description: z.string().optional().describe('Optional description for the branch'),
      },
      async ({ owner, repo, branchName, baseBranch, description }) => {
        const githubApi = new GitHubApiService(this.props.accessToken);

        try {
          const branch = await githubApi.createBranch(owner, repo, branchName, baseBranch, description);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    branch: {
                      name: branch.name,
                      sha: branch.sha,
                      url: branch.url,
                      ref: branch.ref,
                      base_branch: branch.baseBranch,
                      repository: `${owner}/${repo}`,
                      description: description || null,
                    },
                    message: `Branch '${branchName}' created successfully from '${baseBranch}' in ${owner}/${repo}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error creating branch: ${error.message}`,
              },
            ],
          };
        }
      },
    );

    // Commit code changes to a branch
    this.server.tool(
      'commitChanges',
      'Commit multiple file changes to a GitHub repository branch',
      {
        owner: z.string().describe('Repository owner (username or organization)'),
        repo: z.string().describe('Repository name'),
        branch: z.string().describe('Branch name to commit to (must not be a protected branch)'),
        message: z.string().describe('Commit message describing the changes'),
        changes: z
          .array(
            z.object({
              path: z.string().describe('File path within the repository'),
              content: z.string().describe('New file content'),
              operation: z.enum(['create', 'update']).describe("Operation type: 'create' for new files, 'update' for existing files"),
              encoding: z.string().optional().default('utf-8').describe("File encoding (defaults to 'utf-8')"),
            }),
          )
          .describe('Array of file changes to commit'),
      },
      async ({ owner, repo, branch, message, changes }) => {
        const githubApi = new GitHubApiService(this.props.accessToken);

        try {
          const result = await githubApi.commitChanges(owner, repo, branch, message, changes);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    commit: {
                      sha: result.commit.sha,
                      url: result.commit.url,
                      message: result.commit.message,
                      author: result.commit.author,
                      branch: result.branch,
                      repository: `${owner}/${repo}`,
                    },
                    changes: {
                      files_changed: result.filesChanged,
                      operations: changes.map((c) => ({
                        path: c.path,
                        operation: c.operation,
                      })),
                    },
                    message: `Successfully committed ${result.filesChanged} file changes to branch '${branch}' in ${owner}/${repo}`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: 'text',
                text: `Error committing changes: ${error.message}`,
              },
            ],
          };
        }
      },
    );

    // Project Board Assignment Management Tools

    // Assign users to a project board item
    this.server.tool(
      'assignProjectBoardItem',
      'Assign users to a project board item (works for both custom assignee fields and underlying GitHub issues)',
      {
        itemId: z.string().describe('The project item ID (can be obtained from getProjectBoardDetails)'),
        usernames: z.array(z.string()).describe('Array of GitHub usernames to assign to the item'),
      },
      async ({ itemId, usernames }) => {
        const projectId = PROJECT_BOARD_ID;

        try {
          await githubApi.assignProjectBoardItem(projectId, itemId, usernames);

          const result = {
            projectId,
            itemId,
            assignees: usernames,
            message: `Successfully assigned ${usernames.join(', ')} to project board item`,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error assigning users to project board item: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Remove assignees from a project board item
    this.server.tool(
      'unassignProjectBoardItem',
      'Remove specific assignees from a project board item',
      {
        itemId: z.string().describe('The project item ID (can be obtained from getProjectBoardDetails)'),
        usernames: z.array(z.string()).describe('Array of GitHub usernames to remove from the item'),
      },
      async ({ itemId, usernames }) => {
        const projectId = PROJECT_BOARD_ID;

        try {
          await githubApi.unassignProjectBoardItem(projectId, itemId, usernames);

          const result = {
            projectId,
            itemId,
            removedAssignees: usernames,
            message: `Successfully removed ${usernames.join(', ')} from project board item`,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error removing assignees from project board item: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Add labels to a project board item
    this.server.tool(
      'labelProjectBoardItem',
      'Add labels to a project board item (works for GitHub issues in projects)',
      {
        itemId: z.string().describe('The project item ID (can be obtained from getProjectBoardDetails)'),
        labels: z.array(z.string()).describe('Array of label names to apply to the item'),
      },
      async ({ itemId, labels }) => {
        const projectId = PROJECT_BOARD_ID;

        try {
          await githubApi.labelProjectBoardItem(projectId, itemId, labels);

          const result = {
            projectId,
            itemId,
            labels,
            message: `Successfully added labels ${labels.join(', ')} to project board item`,
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error adding labels to project board item: ${error.message}`, type: 'text' }],
          };
        }
      },
    );

    // Get available assignees for the project
    this.server.tool('getProjectAssignableUsers', 'Get a list of users who can be assigned to project board items', {}, async () => {
      const projectId = PROJECT_BOARD_ID;

      try {
        const users = await githubApi.getProjectAssignableUsers(projectId);

        const result = {
          projectId,
          total_assignable_users: users.length,
          users: users.map((user) => ({
            login: user.login,
            name: user.name,
            avatar_url: user.avatarUrl,
          })),
          message: `Found ${users.length} assignable users for the project`,
        };

        return {
          content: [{ text: JSON.stringify(result, null, 2), type: 'text' }],
        };
      } catch (error: any) {
        return {
          content: [{ text: `Error getting assignable users: ${error.message}`, type: 'text' }],
        };
      }
    });
  }
}

export default new OAuthProvider({
  apiHandler: MyMCP.mount('/sse') as any,
  apiRoute: '/sse',
  authorizeEndpoint: '/authorize',
  clientRegistrationEndpoint: '/register',
  defaultHandler: GitHubHandler as any,
  tokenEndpoint: '/token',
});
