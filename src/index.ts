import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { Octokit } from "octokit";
import { z } from "zod";
import { GitHubHandler } from "./github-handler";
import { GitHubApiService } from "./github-api-service";

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = {
  login: string;
  name: string;
  email: string;
  accessToken: string;
};

const ALLOWED_USERNAMES = new Set<string>([
  // Add GitHub usernames of users who should have access to the image generation tool
  // For example: 'yourusername', 'coworkerusername'
]);

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: "Github OAuth Proxy Demo",
    version: "1.0.0",
  });

  async init() {
    // Initialize GitHub API service
    const githubApi = new GitHubApiService(this.props.accessToken);

    // Use the upstream access token to facilitate tools
    this.server.tool("userInfoOctokit", "Get user info from GitHub, via Octokit", {}, async () => {
      const octokit = new Octokit({ auth: this.props.accessToken });
      return {
        content: [
          {
            text: JSON.stringify(await octokit.rest.users.getAuthenticated()),
            type: "text",
          },
        ],
      };
    });

    // List repositories for a GitHub organization
    this.server.tool(
      "listOrganizationRepos",
      "List all repositories for a GitHub organization with filtering options",
      {
        organization: z.string().describe("The GitHub organization name"),
        includePrivate: z.boolean().optional().default(true).describe("Include private repositories"),
        sortBy: z.enum(["name", "updated", "created", "pushed"]).optional().default("updated").describe("Sort repositories by"),
        limit: z.number().optional().default(50).describe("Maximum number of repositories to return"),
      },
      async ({ organization, includePrivate, sortBy, limit }) => {
        try {
          const repos = await githubApi.getOrganizationRepositories(organization, includePrivate);

          // Sort repositories
          let sortedRepos = repos;
          if (sortBy === "name") {
            sortedRepos = repos.sort((a, b) => a.name.localeCompare(b.name));
          } else if (sortBy === "created") {
            sortedRepos = repos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          } else if (sortBy === "pushed") {
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
            content: [{ text: JSON.stringify(summary, null, 2), type: "text" }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: "text" }],
          };
        }
      },
    );

    // Get recent activity for GitHub organization repositories
    this.server.tool(
      "getRecentActivity",
      "Get recent activity for repositories in a GitHub organization, showing commits, issues, and PRs from the last N days",
      {
        organization: z.string().describe("The GitHub organization name"),
        days: z.number().optional().default(7).describe("Number of days to look back for activity"),
        includePrivate: z.boolean().optional().default(true).describe("Include private repositories"),
        limit: z.number().optional().default(20).describe("Maximum number of repositories to show"),
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
                      message: repo.recent_commits[0].commit.message.split("\n")[0],
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
            content: [{ text: JSON.stringify(result, null, 2), type: "text" }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: "text" }],
          };
        }
      },
    );

    // Search for issues and pull requests in a GitHub organization
    this.server.tool(
      "searchIssuesAndPRs",
      "Search for issues and pull requests across all repositories in a GitHub organization",
      {
        organization: z.string().describe("The GitHub organization name"),
        query: z.string().describe("Search query (e.g., 'bug', 'feature', 'urgent', author:username)"),
        state: z.enum(["open", "closed", "all"]).optional().default("all").describe("Filter by state"),
        limit: z.number().optional().default(50).describe("Maximum number of results to return"),
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
              repository: issue.html_url.split("/").slice(-4, -2).join("/"),
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
              repository: pr.html_url.split("/").slice(-4, -2).join("/"),
            })),
          };

          return {
            content: [{ text: JSON.stringify(result, null, 2), type: "text" }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: "text" }],
          };
        }
      },
    );

    // Get detailed information about a specific repository
    this.server.tool(
      "getRepositoryDetails",
      "Get detailed information about a specific repository including recent commits, issues, and pull requests",
      {
        owner: z.string().describe("The repository owner (username or organization)"),
        repo: z.string().describe("The repository name"),
        includeCommits: z.boolean().optional().default(true).describe("Include recent commits"),
        includeIssues: z.boolean().optional().default(true).describe("Include recent issues"),
        includePRs: z.boolean().optional().default(true).describe("Include recent pull requests"),
        days: z.number().optional().default(30).describe("Number of days to look back for activity"),
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
            includeIssues ? githubApi.getRepositoryIssues(owner, repo, "all", sinceDate) : [],
            includePRs ? githubApi.getRepositoryPullRequests(owner, repo, "all") : [],
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
              message: commit.commit.message.split("\n")[0],
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
            content: [{ text: JSON.stringify(result, null, 2), type: "text" }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: "text" }],
          };
        }
      },
    );

    // Get detailed commit history for a repository
    this.server.tool(
      "getCommitHistory",
      "Get detailed commit history for a specific repository with filtering options",
      {
        owner: z.string().describe("The repository owner (username or organization)"),
        repo: z.string().describe("The repository name"),
        since: z.string().optional().describe("Only show commits after this date (ISO 8601 format)"),
        until: z.string().optional().describe("Only show commits before this date (ISO 8601 format)"),
        branch: z.string().optional().describe("Branch to get commits from (defaults to default branch)"),
        author: z.string().optional().describe("Filter commits by author username or email"),
        limit: z.number().optional().default(50).describe("Maximum number of commits to return"),
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
            branch: branch || "default",
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
            content: [{ text: JSON.stringify(result, null, 2), type: "text" }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: "text" }],
          };
        }
      },
    );

    // Get contributor statistics for a repository
    this.server.tool(
      "getContributorStats",
      "Get detailed contributor statistics for a specific repository",
      {
        owner: z.string().describe("The repository owner (username or organization)"),
        repo: z.string().describe("The repository name"),
        limit: z.number().optional().default(50).describe("Maximum number of contributors to return"),
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
            content: [{ text: JSON.stringify(result, null, 2), type: "text" }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: "text" }],
          };
        }
      },
    );

    // List organization projects (GitHub Projects v2)
    this.server.tool(
      "listOrganizationProjects",
      "List all GitHub Projects v2 for a specific organization",
      {
        organization: z.string().describe("The GitHub organization name"),
        includePrivate: z.boolean().optional().default(true).describe("Include private projects"),
        limit: z.number().optional().default(50).describe("Maximum number of projects to return"),
      },
      async ({ organization, includePrivate, limit }) => {
        try {
          const projects = await githubApi.getOrganizationProjects(organization);
          
          // Filter by visibility if needed
          let filteredProjects = projects;
          if (!includePrivate) {
            filteredProjects = projects.filter(project => project.visibility === "PUBLIC");
          }
          
          // Limit results
          const limitedProjects = filteredProjects.slice(0, limit);
          
          const result = {
            organization,
            total_projects: filteredProjects.length,
            showing: limitedProjects.length,
            projects: limitedProjects.map(project => ({
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
            content: [{ text: JSON.stringify(result, null, 2), type: "text" }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: "text" }],
          };
        }
      },
    );

    // Get detailed project information including all tasks
    this.server.tool(
      "getProjectDetails",
      "Get detailed information about a GitHub Projects v2 board including all tasks, fields, and status",
      {
        projectId: z.string().describe("The GitHub project ID (can be obtained from listOrganizationProjects)"),
        includeFields: z.boolean().optional().default(true).describe("Include custom field information"),
        includeItems: z.boolean().optional().default(true).describe("Include all project items (issues, PRs, draft issues)"),
        limit: z.number().optional().default(100).describe("Maximum number of items to return"),
      },
      async ({ projectId, includeFields, includeItems, limit }) => {
        try {
          const projectDetails = await githubApi.getProjectDetails(projectId);
          
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
            fields: includeFields ? projectDetails.fields.map(field => ({
              id: field.id,
              name: field.name,
              data_type: field.dataType,
              options: field.options,
            })) : [],
            items: includeItems ? projectDetails.items.slice(0, limit).map(item => ({
              id: item.id,
              type: item.type,
              title: item.content.title,
              url: item.content.url,
              number: item.content.number,
              state: item.content.state,
              body: item.content.body ? item.content.body.substring(0, 500) + (item.content.body.length > 500 ? "..." : "") : null,
              author: item.content.author,
              assignees: item.content.assignees,
              labels: item.content.labels,
              created_at: item.content.createdAt,
              updated_at: item.content.updatedAt,
              field_values: item.fieldValues.map(fv => ({
                field_name: fv.field.name,
                field_type: fv.field.type,
                value: fv.value,
              })),
            })) : [],
            showing_items: includeItems ? Math.min(limit, projectDetails.items.length) : 0,
          };
          
          return {
            content: [{ text: JSON.stringify(result, null, 2), type: "text" }],
          };
        } catch (error: any) {
          return {
            content: [{ text: `Error: ${error.message}`, type: "text" }],
          };
        }
      },
    );

    // Dynamically add tools based on the user's login. In this case, I want to limit
    // access to team meetings tool to just me
    if (ALLOWED_USERNAMES.has(this.props.login)) {
      this.server.tool(
        "generateImage",
        "Generate an image using the `flux-1-schnell` model. Works best with 8 steps.",
        {
          prompt: z.string().describe("A text description of the image you want to generate."),
          steps: z
            .number()
            .min(4)
            .max(8)
            .default(4)
            .describe(
              "The number of diffusion steps; higher values can improve quality but take longer. Must be between 4 and 8, inclusive.",
            ),
        },
        async ({ prompt, steps }) => {
          const response = await this.env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
            prompt,
            steps,
          });

          return {
            content: [{ data: response.image!, mimeType: "image/jpeg", type: "image" }],
          };
        },
      );
    }
  }
}

export default new OAuthProvider({
  apiHandler: MyMCP.mount("/sse") as any,
  apiRoute: "/sse",
  authorizeEndpoint: "/authorize",
  clientRegistrationEndpoint: "/register",
  defaultHandler: GitHubHandler as any,
  tokenEndpoint: "/token",
});
