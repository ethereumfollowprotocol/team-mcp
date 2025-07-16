import { Octokit } from "octokit";
import type {
	GitHubRepository,
	GitHubCommit,
	GitHubIssue,
	GitHubPullRequest,
	GitHubContributor,
	RepositoryActivity,
	OrganizationSummary,
	GitHubApiOptions,
} from "./types";

export class GitHubApiService {
	private octokit: Octokit;
	private cache: Map<string, { data: any; timestamp: number }> = new Map();
	private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

	constructor(accessToken: string) {
		this.octokit = new Octokit({ auth: accessToken });
	}

	private getCacheKey(method: string, params: any): string {
		return `${method}:${JSON.stringify(params)}`;
	}

	private getFromCache<T>(key: string): T | null {
		const cached = this.cache.get(key);
		if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
			return cached.data as T;
		}
		return null;
	}

	private setCache(key: string, data: any): void {
		this.cache.set(key, { data, timestamp: Date.now() });
	}

	private async paginate<T>(
		endpoint: any,
		params: any,
		maxPages: number = 10
	): Promise<T[]> {
		const results: T[] = [];
		let page = 1;
		
		while (page <= maxPages) {
			const response = await endpoint({
				...params,
				per_page: 100,
				page,
			});
			
			const data = response.data;
			if (!Array.isArray(data) || data.length === 0) {
				break;
			}
			
			results.push(...data);
			
			if (data.length < 100) {
				break;
			}
			
			page++;
		}
		
		return results;
	}

	async getOrganizationRepositories(
		org: string,
		includePrivate: boolean = true
	): Promise<GitHubRepository[]> {
		const cacheKey = this.getCacheKey("getOrganizationRepositories", { org, includePrivate });
		const cached = this.getFromCache<GitHubRepository[]>(cacheKey);
		if (cached) return cached;

		try {
			const repos = await this.paginate<GitHubRepository>(
				this.octokit.rest.repos.listForOrg,
				{
					org,
					type: includePrivate ? "all" : "public",
					sort: "updated",
					direction: "desc",
				}
			);

			this.setCache(cacheKey, repos);
			return repos;
		} catch (error: any) {
			throw new Error(`Failed to fetch repositories for organization ${org}: ${error.message}`);
		}
	}

	async getRecentCommits(
		owner: string,
		repo: string,
		since?: string,
		branch?: string
	): Promise<GitHubCommit[]> {
		const cacheKey = this.getCacheKey("getRecentCommits", { owner, repo, since, branch });
		const cached = this.getFromCache<GitHubCommit[]>(cacheKey);
		if (cached) return cached;

		try {
			const params: any = {
				owner,
				repo,
				per_page: 100,
			};

			if (since) params.since = since;
			if (branch) params.sha = branch;

			const commits = await this.paginate<GitHubCommit>(
				this.octokit.rest.repos.listCommits,
				params,
				5 // Limit to 5 pages for performance
			);

			this.setCache(cacheKey, commits);
			return commits;
		} catch (error: any) {
			console.error(`Failed to fetch commits for ${owner}/${repo}:`, error.message);
			return [];
		}
	}

	async getRepositoryIssues(
		owner: string,
		repo: string,
		state: "open" | "closed" | "all" = "all",
		since?: string
	): Promise<GitHubIssue[]> {
		const cacheKey = this.getCacheKey("getRepositoryIssues", { owner, repo, state, since });
		const cached = this.getFromCache<GitHubIssue[]>(cacheKey);
		if (cached) return cached;

		try {
			const params: any = {
				owner,
				repo,
				state,
				sort: "updated",
				direction: "desc",
			};

			if (since) params.since = since;

			const issues = await this.paginate<GitHubIssue>(
				this.octokit.rest.issues.listForRepo,
				params,
				3 // Limit to 3 pages for performance
			);

			this.setCache(cacheKey, issues);
			return issues;
		} catch (error: any) {
			console.error(`Failed to fetch issues for ${owner}/${repo}:`, error.message);
			return [];
		}
	}

	async getRepositoryPullRequests(
		owner: string,
		repo: string,
		state: "open" | "closed" | "all" = "all"
	): Promise<GitHubPullRequest[]> {
		const cacheKey = this.getCacheKey("getRepositoryPullRequests", { owner, repo, state });
		const cached = this.getFromCache<GitHubPullRequest[]>(cacheKey);
		if (cached) return cached;

		try {
			const prs = await this.paginate<GitHubPullRequest>(
				this.octokit.rest.pulls.list,
				{
					owner,
					repo,
					state,
					sort: "updated",
					direction: "desc",
				},
				3 // Limit to 3 pages for performance
			);

			this.setCache(cacheKey, prs);
			return prs;
		} catch (error: any) {
			console.error(`Failed to fetch pull requests for ${owner}/${repo}:`, error.message);
			return [];
		}
	}

	async getContributors(owner: string, repo: string): Promise<GitHubContributor[]> {
		const cacheKey = this.getCacheKey("getContributors", { owner, repo });
		const cached = this.getFromCache<GitHubContributor[]>(cacheKey);
		if (cached) return cached;

		try {
			const contributors = await this.paginate<GitHubContributor>(
				this.octokit.rest.repos.listContributors,
				{
					owner,
					repo,
				},
				2 // Limit to 2 pages for performance
			);

			this.setCache(cacheKey, contributors);
			return contributors;
		} catch (error: any) {
			console.error(`Failed to fetch contributors for ${owner}/${repo}:`, error.message);
			return [];
		}
	}

	async getRepositoryActivity(
		repository: GitHubRepository,
		daysSince: number = 7
	): Promise<RepositoryActivity> {
		const sinceDate = new Date(Date.now() - daysSince * 24 * 60 * 60 * 1000).toISOString();
		
		const [commits, issues, prs, contributors] = await Promise.all([
			this.getRecentCommits(repository.owner.login, repository.name, sinceDate),
			this.getRepositoryIssues(repository.owner.login, repository.name, "open"),
			this.getRepositoryPullRequests(repository.owner.login, repository.name, "open"),
			this.getContributors(repository.owner.login, repository.name),
		]);

		const openIssues = issues.filter(issue => !issue.pull_request);
		const openPrs = prs;

		return {
			repository,
			recent_commits: commits.slice(0, 10), // Limit to 10 most recent commits
			commit_count: commits.length,
			contributor_count: contributors.length,
			top_contributors: contributors.slice(0, 5), // Top 5 contributors
			open_issues: openIssues.length,
			open_prs: openPrs.length,
			last_activity: commits.length > 0 ? commits[0].commit.committer.date : repository.updated_at,
		};
	}

	async getOrganizationActivity(
		org: string,
		daysSince: number = 7,
		includePrivate: boolean = true
	): Promise<OrganizationSummary> {
		const repos = await this.getOrganizationRepositories(org, includePrivate);
		const activities: RepositoryActivity[] = [];

		// Process repositories in batches to avoid rate limits
		const batchSize = 5;
		for (let i = 0; i < repos.length; i += batchSize) {
			const batch = repos.slice(i, i + batchSize);
			const batchActivities = await Promise.all(
				batch.map(repo => this.getRepositoryActivity(repo, daysSince))
			);
			activities.push(...batchActivities);
		}

		// Filter to only include repositories with recent activity
		const activeRepos = activities.filter(activity => activity.commit_count > 0);
		const totalCommits = activeRepos.reduce((sum, activity) => sum + activity.commit_count, 0);

		const summary = `${activeRepos.length} out of ${repos.length} repositories had activity in the last ${daysSince} days with ${totalCommits} total commits.`;

		return {
			organization: org,
			repositories: activeRepos.sort((a, b) => b.commit_count - a.commit_count),
			total_repos: repos.length,
			active_repos: activeRepos.length,
			total_commits: totalCommits,
			summary,
		};
	}

	async searchIssuesAndPRs(
		org: string,
		query: string,
		state: "open" | "closed" | "all" = "all"
	): Promise<{ issues: GitHubIssue[]; pull_requests: GitHubPullRequest[] }> {
		const cacheKey = this.getCacheKey("searchIssuesAndPRs", { org, query, state });
		const cached = this.getFromCache<{ issues: GitHubIssue[]; pull_requests: GitHubPullRequest[] }>(cacheKey);
		if (cached) return cached;

		try {
			const searchQuery = `org:${org} ${query} ${state !== "all" ? `state:${state}` : ""}`;
			
			const [issuesResponse, prsResponse] = await Promise.all([
				this.octokit.rest.search.issuesAndPullRequests({
					q: `${searchQuery} type:issue`,
					per_page: 100,
				}),
				this.octokit.rest.search.issuesAndPullRequests({
					q: `${searchQuery} type:pr`,
					per_page: 100,
				}),
			]);

			const result = {
				issues: issuesResponse.data.items.filter(item => !item.pull_request) as GitHubIssue[],
				pull_requests: prsResponse.data.items as any[] as GitHubPullRequest[],
			};

			this.setCache(cacheKey, result);
			return result;
		} catch (error: any) {
			throw new Error(`Failed to search issues and PRs in organization ${org}: ${error.message}`);
		}
	}
}