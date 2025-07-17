export interface GitHubRepository {
	id: number;
	name: string;
	full_name: string;
	owner: {
		login: string;
		type: string;
	};
	private: boolean;
	html_url: string;
	description: string | null;
	fork: boolean;
	created_at: string;
	updated_at: string;
	pushed_at: string;
	clone_url: string;
	stargazers_count: number;
	watchers_count: number;
	language: string | null;
	forks_count: number;
	open_issues_count: number;
	default_branch: string;
	archived: boolean;
	disabled: boolean;
}

export interface GitHubCommit {
	sha: string;
	commit: {
		author: {
			name: string;
			email: string;
			date: string;
		};
		committer: {
			name: string;
			email: string;
			date: string;
		};
		message: string;
		tree: {
			sha: string;
		};
	};
	author: {
		login: string;
		avatar_url: string;
	} | null;
	committer: {
		login: string;
		avatar_url: string;
	} | null;
	html_url: string;
}

export interface GitHubIssue {
	id: number;
	number: number;
	title: string;
	body: string | null;
	user: {
		login: string;
		avatar_url: string;
	};
	state: "open" | "closed";
	created_at: string;
	updated_at: string;
	closed_at: string | null;
	html_url: string;
	labels: Array<{
		name: string;
		color: string;
	}>;
	assignees: Array<{
		login: string;
		avatar_url: string;
	}>;
	pull_request?: {
		html_url: string;
		diff_url: string;
		patch_url: string;
	};
}

export interface GitHubPullRequest {
	id: number;
	number: number;
	title: string;
	body: string | null;
	user: {
		login: string;
		avatar_url: string;
	};
	state: "open" | "closed";
	created_at: string;
	updated_at: string;
	closed_at: string | null;
	merged_at: string | null;
	html_url: string;
	head: {
		ref: string;
		sha: string;
	};
	base: {
		ref: string;
		sha: string;
	};
	draft: boolean;
	merged: boolean;
}

export interface GitHubContributor {
	login: string;
	avatar_url: string;
	contributions: number;
	type: string;
}

export interface RepositoryActivity {
	repository: GitHubRepository;
	recent_commits: GitHubCommit[];
	commit_count: number;
	contributor_count: number;
	top_contributors: GitHubContributor[];
	open_issues: number;
	open_prs: number;
	last_activity: string;
}

export interface OrganizationSummary {
	organization: string;
	repositories: RepositoryActivity[];
	total_repos: number;
	active_repos: number;
	total_commits: number;
	summary: string;
}

export interface GitHubApiOptions {
	per_page?: number;
	page?: number;
	since?: string;
	until?: string;
	sort?: "created" | "updated" | "pushed" | "full_name";
	direction?: "asc" | "desc";
	state?: "open" | "closed" | "all";
}

export interface GitHubProjectV2 {
	id: string;
	number: number;
	title: string;
	url: string;
	description: string | null;
	visibility: "PUBLIC" | "PRIVATE";
	closed: boolean;
	owner: {
		login: string;
		type: string;
	};
	createdAt: string;
	updatedAt: string;
	itemsCount: number;
}

export interface GitHubProjectV2Item {
	id: string;
	type: "ISSUE" | "PULL_REQUEST" | "DRAFT_ISSUE";
	content: {
		id: string;
		title: string;
		url: string;
		number?: number;
		state?: "OPEN" | "CLOSED" | "MERGED";
		body?: string;
		author?: {
			login: string;
			avatarUrl: string;
		};
		assignees?: Array<{
			login: string;
			avatarUrl: string;
		}>;
		labels?: Array<{
			name: string;
			color: string;
		}>;
		createdAt: string;
		updatedAt: string;
	};
	fieldValues: Array<{
		field: {
			name: string;
			type: "TEXT" | "SINGLE_SELECT" | "NUMBER" | "DATE" | "ITERATION";
		};
		value: string | number | null;
	}>;
}

export interface GitHubProjectV2Field {
	id: string;
	name: string;
	dataType: "TEXT" | "SINGLE_SELECT" | "NUMBER" | "DATE" | "ITERATION";
	options?: Array<{
		id: string;
		name: string;
		color?: string;
	}>;
}

export interface GitHubProjectV2Details {
	project: GitHubProjectV2;
	fields: GitHubProjectV2Field[];
	items: GitHubProjectV2Item[];
	totalItemsCount: number;
	summary: {
		totalItems: number;
		openIssues: number;
		closedIssues: number;
		openPRs: number;
		mergedPRs: number;
		draftItems: number;
	};
}