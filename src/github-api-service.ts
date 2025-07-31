import { Octokit } from "octokit";
import type {
  GitHubRepository,
  GitHubCommit,
  GitHubIssue,
  GitHubPullRequest,
  GitHubContributor,
  RepositoryActivity,
  OrganizationSummary,
  GitHubProjectV2,
  GitHubProjectV2Details,
} from "./types";

export class GitHubApiService {
  private _octokit: Octokit;

  get octokit(): Octokit {
    return this._octokit;
  }
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(accessToken: string) {
    this._octokit = new Octokit({ auth: accessToken });
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

  private async paginate<T>(endpoint: any, params: any, maxPages: number = 10): Promise<T[]> {
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

  async getOrganizationRepositories(org: string, includePrivate: boolean = true): Promise<GitHubRepository[]> {
    const cacheKey = this.getCacheKey("getOrganizationRepositories", { org, includePrivate });
    const cached = this.getFromCache<GitHubRepository[]>(cacheKey);
    if (cached) return cached;

    try {
      const repos = await this.paginate<GitHubRepository>(this._octokit.rest.repos.listForOrg, {
        org,
        type: includePrivate ? "all" : "public",
        sort: "updated",
        direction: "desc",
      });

      this.setCache(cacheKey, repos);
      return repos;
    } catch (error: any) {
      throw new Error(`Failed to fetch repositories for organization ${org}: ${error.message}`);
    }
  }

  async getRecentCommits(owner: string, repo: string, since?: string, branch?: string): Promise<GitHubCommit[]> {
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
        this._octokit.rest.repos.listCommits,
        params,
        5, // Limit to 5 pages for performance
      );

      this.setCache(cacheKey, commits);
      return commits;
    } catch (error: any) {
      console.error(`Failed to fetch commits for ${owner}/${repo}:`, error.message);
      return [];
    }
  }

  async getRepositoryIssues(owner: string, repo: string, state: "open" | "closed" | "all" = "all", since?: string): Promise<GitHubIssue[]> {
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
        this._octokit.rest.issues.listForRepo,
        params,
        3, // Limit to 3 pages for performance
      );

      this.setCache(cacheKey, issues);
      return issues;
    } catch (error: any) {
      console.error(`Failed to fetch issues for ${owner}/${repo}:`, error.message);
      return [];
    }
  }

  async getRepositoryPullRequests(owner: string, repo: string, state: "open" | "closed" | "all" = "all"): Promise<GitHubPullRequest[]> {
    const cacheKey = this.getCacheKey("getRepositoryPullRequests", { owner, repo, state });
    const cached = this.getFromCache<GitHubPullRequest[]>(cacheKey);
    if (cached) return cached;

    try {
      const prs = await this.paginate<GitHubPullRequest>(
        this._octokit.rest.pulls.list,
        {
          owner,
          repo,
          state,
          sort: "updated",
          direction: "desc",
        },
        3, // Limit to 3 pages for performance
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
        this._octokit.rest.repos.listContributors,
        {
          owner,
          repo,
        },
        2, // Limit to 2 pages for performance
      );

      this.setCache(cacheKey, contributors);
      return contributors;
    } catch (error: any) {
      console.error(`Failed to fetch contributors for ${owner}/${repo}:`, error.message);
      return [];
    }
  }

  async getRepositoryActivity(repository: GitHubRepository, daysSince: number = 7): Promise<RepositoryActivity> {
    const sinceDate = new Date(Date.now() - daysSince * 24 * 60 * 60 * 1000).toISOString();

    const [commits, issues, prs, contributors] = await Promise.all([
      this.getRecentCommits(repository.owner.login, repository.name, sinceDate),
      this.getRepositoryIssues(repository.owner.login, repository.name, "open"),
      this.getRepositoryPullRequests(repository.owner.login, repository.name, "open"),
      this.getContributors(repository.owner.login, repository.name),
    ]);

    const openIssues = issues.filter((issue) => !issue.pull_request);
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

  async getOrganizationActivity(org: string, daysSince: number = 7, includePrivate: boolean = true): Promise<OrganizationSummary> {
    const repos = await this.getOrganizationRepositories(org, includePrivate);
    const activities: RepositoryActivity[] = [];

    // Process repositories in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < repos.length; i += batchSize) {
      const batch = repos.slice(i, i + batchSize);
      const batchActivities = await Promise.all(batch.map((repo) => this.getRepositoryActivity(repo, daysSince)));
      activities.push(...batchActivities);
    }

    // Filter to only include repositories with recent activity
    const activeRepos = activities.filter((activity) => activity.commit_count > 0);
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
    state: "open" | "closed" | "all" = "all",
  ): Promise<{ issues: GitHubIssue[]; pull_requests: GitHubPullRequest[] }> {
    const cacheKey = this.getCacheKey("searchIssuesAndPRs", { org, query, state });
    const cached = this.getFromCache<{ issues: GitHubIssue[]; pull_requests: GitHubPullRequest[] }>(cacheKey);
    if (cached) return cached;

    try {
      const searchQuery = `org:${org} ${query} ${state !== "all" ? `state:${state}` : ""}`;

      const [issuesResponse, prsResponse] = await Promise.all([
        this._octokit.rest.search.issuesAndPullRequests({
          q: `${searchQuery} type:issue`,
          per_page: 100,
        }),
        this._octokit.rest.search.issuesAndPullRequests({
          q: `${searchQuery} type:pr`,
          per_page: 100,
        }),
      ]);

      const result = {
        issues: issuesResponse.data.items.filter((item) => !item.pull_request) as GitHubIssue[],
        pull_requests: prsResponse.data.items as any[] as GitHubPullRequest[],
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error: any) {
      throw new Error(`Failed to search issues and PRs in organization ${org}: ${error.message}`);
    }
  }

  // GitHub Projects v2 API methods using GraphQL
  async getOrganizationProjects(org: string): Promise<GitHubProjectV2[]> {
    const cacheKey = this.getCacheKey("getOrganizationProjects", { org });
    const cached = this.getFromCache<GitHubProjectV2[]>(cacheKey);
    if (cached) return cached;

    try {
      const query = `
				query($org: String!) {
					organization(login: $org) {
						projectsV2(first: 100) {
							nodes {
								id
								number
								title
								url
								public
								closed
								createdAt
								updatedAt
								items(first: 1) {
									totalCount
								}
							}
						}
					}
				}
			`;

      const response = await this._octokit.graphql<{
        organization: {
          projectsV2: {
            nodes: Array<{
              id: string;
              number: number;
              title: string;
              url: string;
              public: boolean;
              closed: boolean;
              createdAt: string;
              updatedAt: string;
              items: {
                totalCount: number;
              };
            }>;
          };
        };
      }>(query, { org });

      const projects: GitHubProjectV2[] = response.organization.projectsV2.nodes.map((project) => ({
        id: project.id,
        number: project.number,
        title: project.title,
        url: project.url,
        description: null, // ProjectV2 doesn't have description field
        visibility: project.public ? "PUBLIC" : "PRIVATE",
        closed: project.closed,
        owner: {
          login: org, // Use the org parameter since owner info isn't available in ProjectV2
          type: "Organization",
        },
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        itemsCount: project.items.totalCount,
      }));

      this.setCache(cacheKey, projects);
      return projects;
    } catch (error: any) {
      throw new Error(`Failed to fetch projects for organization ${org}: ${error.message}`);
    }
  }

  async getProjectDetails(projectId: string): Promise<GitHubProjectV2Details> {
    const cacheKey = this.getCacheKey("getProjectDetails", { projectId });
    const cached = this.getFromCache<GitHubProjectV2Details>(cacheKey);
    if (cached) return cached;

    try {
      const query = `
				query($projectId: ID!) {
					node(id: $projectId) {
						... on ProjectV2 {
							id
							number
							title
							url
							public
							closed
							createdAt
							updatedAt
							fields(first: 20) {
								nodes {
									... on ProjectV2Field {
										id
										name
										dataType
									}
									... on ProjectV2SingleSelectField {
										id
										name
										dataType
										options {
											id
											name
											color
										}
									}
									... on ProjectV2IterationField {
										id
										name
										dataType
									}
								}
							}
							items(first: 100) {
								totalCount
								nodes {
									id
									type
									content {
										... on Issue {
											id
											title
											url
											number
											state
											body
											author {
												login
												avatarUrl
											}
											assignees(first: 10) {
												nodes {
													login
													avatarUrl
												}
											}
											labels(first: 10) {
												nodes {
													name
													color
												}
											}
											createdAt
											updatedAt
										}
										... on PullRequest {
											id
											title
											url
											number
											state
											body
											author {
												login
												avatarUrl
											}
											assignees(first: 10) {
												nodes {
													login
													avatarUrl
												}
											}
											labels(first: 10) {
												nodes {
													name
													color
												}
											}
											createdAt
											updatedAt
										}
										... on DraftIssue {
											id
											title
											body
											createdAt
											updatedAt
										}
									}
									fieldValues(first: 20) {
										nodes {
											... on ProjectV2ItemFieldTextValue {
												field {
													... on ProjectV2Field {
														name
														dataType
													}
												}
												text
											}
											... on ProjectV2ItemFieldSingleSelectValue {
												field {
													... on ProjectV2SingleSelectField {
														name
														dataType
													}
												}
												name
											}
											... on ProjectV2ItemFieldNumberValue {
												field {
													... on ProjectV2Field {
														name
														dataType
													}
												}
												number
											}
											... on ProjectV2ItemFieldDateValue {
												field {
													... on ProjectV2Field {
														name
														dataType
													}
												}
												date
											}
											... on ProjectV2ItemFieldUserValue {
												field {
													... on ProjectV2Field {
														name
														dataType
													}
												}
												users(first: 10) {
													nodes {
														login
														name
														avatarUrl
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
			`;

      const response = await this._octokit.graphql<{
        node: {
          id: string;
          number: number;
          title: string;
          url: string;
          public: boolean;
          closed: boolean;
          createdAt: string;
          updatedAt: string;
          fields: {
            nodes: Array<{
              id: string;
              name: string;
              dataType: string;
              options?: Array<{
                id: string;
                name: string;
                color?: string;
              }>;
            }>;
          };
          items: {
            totalCount: number;
            nodes: Array<{
              id: string;
              type: "ISSUE" | "PULL_REQUEST" | "DRAFT_ISSUE";
              content: {
                id: string;
                title: string;
                url?: string;
                number?: number;
                state?: "OPEN" | "CLOSED" | "MERGED";
                body?: string;
                author?: {
                  login: string;
                  avatarUrl: string;
                } | null;
                assignees?: {
                  nodes: Array<{
                    login: string;
                    avatarUrl: string;
                  }>;
                } | null;
                labels?: {
                  nodes: Array<{
                    name: string;
                    color: string;
                  }>;
                } | null;
                createdAt: string;
                updatedAt: string;
              };
              fieldValues: {
                nodes: Array<{
                  field?: {
                    name: string;
                    dataType: string;
                  };
                  text?: string;
                  name?: string;
                  number?: number;
                  date?: string;
                  users?: {
                    nodes: Array<{
                      login: string;
                      name: string;
                      avatarUrl: string;
                    }>;
                  };
                }>;
              };
            }>;
          };
        };
      }>(query, { projectId });

      const project = response.node;

      const projectDetails: GitHubProjectV2Details = {
        project: {
          id: project.id,
          number: project.number,
          title: project.title,
          url: project.url,
          description: null, // ProjectV2 doesn't have description field
          visibility: project.public ? "PUBLIC" : "PRIVATE",
          closed: project.closed,
          owner: {
            login: "unknown", // Owner info not available in this query
            type: "Organization",
          },
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          itemsCount: project.items.totalCount,
        },
        fields: project.fields.nodes
          .filter((field) => field && field.name)
          .map((field) => ({
            id: field.id,
            name: field.name,
            dataType: field.dataType as "TEXT" | "SINGLE_SELECT" | "NUMBER" | "DATE" | "ITERATION",
            options: field.options,
          })),
        items: project.items.nodes.map((item) => {
          // Get assignees from regular issue/PR assignees field
          let assignees = item.content.assignees?.nodes || [];

          // Also check for assignees in custom fields
          const assigneeField = item.fieldValues.nodes.find(
            (fv) => fv.field && fv.field.name.toLowerCase().includes("assignee") && fv.users,
          );

          if (assigneeField && assigneeField.users) {
            // Convert custom field users to assignees format
            const customAssignees = assigneeField.users.nodes.map((user) => ({
              login: user.login,
              avatarUrl: user.avatarUrl,
            }));

            // Merge with existing assignees (avoiding duplicates)
            const allAssignees = [...assignees];
            customAssignees.forEach((customAssignee) => {
              if (!allAssignees.find((a) => a.login === customAssignee.login)) {
                allAssignees.push(customAssignee);
              }
            });
            assignees = allAssignees;
          }

          return {
            id: item.id,
            type: item.type,
            content: {
              id: item.content.id,
              title: item.content.title,
              url: item.content.url || "",
              number: item.content.number,
              state: item.content.state,
              body: item.content.body,
              author: item.content.author || undefined,
              assignees: assignees,
              labels: item.content.labels?.nodes || [],
              createdAt: item.content.createdAt,
              updatedAt: item.content.updatedAt,
            },
            fieldValues: item.fieldValues.nodes
              .filter((fieldValue) => fieldValue.field && fieldValue.field.name)
              .map((fieldValue) => {
                let value = fieldValue.text || fieldValue.name || fieldValue.number || fieldValue.date || null;

                // Handle user fields (assignees)
                if (fieldValue.users && fieldValue.users.nodes.length > 0) {
                  value = fieldValue.users.nodes.map((user) => user.login).join(", ");

                  // This is handled above in the main assignees extraction
                }

                return {
                  field: {
                    name: fieldValue.field!.name,
                    type: fieldValue.field!.dataType as "TEXT" | "SINGLE_SELECT" | "NUMBER" | "DATE" | "ITERATION",
                  },
                  value: value,
                };
              }),
          };
        }),
        totalItemsCount: project.items.totalCount,
        summary: {
          totalItems: project.items.totalCount,
          openIssues: project.items.nodes.filter((item) => item.type === "ISSUE" && item.content.state === "OPEN").length,
          closedIssues: project.items.nodes.filter((item) => item.type === "ISSUE" && item.content.state === "CLOSED").length,
          openPRs: project.items.nodes.filter((item) => item.type === "PULL_REQUEST" && item.content.state === "OPEN").length,
          mergedPRs: project.items.nodes.filter((item) => item.type === "PULL_REQUEST" && item.content.state === "MERGED").length,
          draftItems: project.items.nodes.filter((item) => item.type === "DRAFT_ISSUE").length,
        },
      };

      this.setCache(cacheKey, projectDetails);
      return projectDetails;
    } catch (error: any) {
      throw new Error(`Failed to fetch project details for project ${projectId}: ${error.message}`);
    }
  }

  // Create a new issue in a repository
  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body?: string,
    assignees?: string[],
    labels?: string[],
    milestone?: number
  ): Promise<{ id: string; number: number; url: string }> {
    try {
      // First, get the repository ID
      const repoQuery = `
        query($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
            id
          }
        }
      `;

      const repoResponse = await this._octokit.graphql<{
        repository: { id: string };
      }>(repoQuery, { owner, name: repo });

      const repositoryId = repoResponse.repository.id;

      // Get label IDs if labels are provided
      let labelIds: string[] = [];
      if (labels && labels.length > 0) {
        const labelQuery = `
          query($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
              labels(first: 100) {
                nodes {
                  id
                  name
                }
              }
            }
          }
        `;

        const labelResponse = await this._octokit.graphql<{
          repository: {
            labels: {
              nodes: Array<{ id: string; name: string }>;
            };
          };
        }>(labelQuery, { owner, name: repo });

        const availableLabels = labelResponse.repository.labels.nodes;
        labelIds = labels
          .map(labelName => {
            const label = availableLabels.find(l => l.name.toLowerCase() === labelName.toLowerCase());
            return label?.id;
          })
          .filter((id): id is string => id !== undefined);
      }

      // Get assignee IDs if assignees are provided
      let assigneeIds: string[] = [];
      if (assignees && assignees.length > 0) {
        // Use multiple individual user queries since GitHub doesn't have a bulk users query
        const assigneePromises = assignees.map(async (login) => {
          const assigneeQuery = `
            query($login: String!) {
              user(login: $login) {
                id
                login
              }
            }
          `;

          try {
            const assigneeResponse = await this._octokit.graphql<{
              user: { id: string; login: string };
            }>(assigneeQuery, { login });

            return assigneeResponse.user.id;
          } catch (error) {
            console.warn(`Failed to find user ${login}:`, error);
            return null;
          }
        });

        const results = await Promise.all(assigneePromises);
        assigneeIds = results.filter((id): id is string => id !== null);
      }

      // Get milestone ID if milestone number is provided
      let milestoneId: string | undefined;
      if (milestone !== undefined) {
        const milestoneQuery = `
          query($owner: String!, $name: String!, $number: Int!) {
            repository(owner: $owner, name: $name) {
              milestone(number: $number) {
                id
              }
            }
          }
        `;

        try {
          const milestoneResponse = await this._octokit.graphql<{
            repository: {
              milestone: { id: string };
            };
          }>(milestoneQuery, { owner, name: repo, number: milestone });

          milestoneId = milestoneResponse.repository.milestone.id;
        } catch (error) {
          console.warn(`Milestone ${milestone} not found, proceeding without milestone`);
        }
      }

      // Create the issue
      const createIssueMutation = `
        mutation($input: CreateIssueInput!) {
          createIssue(input: $input) {
            issue {
              id
              number
              url
              title
              body
              state
              author {
                login
              }
              assignees(first: 10) {
                nodes {
                  login
                }
              }
              labels(first: 10) {
                nodes {
                  name
                  color
                }
              }
              milestone {
                title
                number
              }
            }
          }
        }
      `;

      const input: any = {
        repositoryId,
        title,
      };

      if (body) input.body = body;
      if (assigneeIds.length > 0) input.assigneeIds = assigneeIds;
      if (labelIds.length > 0) input.labelIds = labelIds;
      if (milestoneId) input.milestoneId = milestoneId;

      const response = await this._octokit.graphql<{
        createIssue: {
          issue: {
            id: string;
            number: number;
            url: string;
            title: string;
            body: string;
            state: string;
            author: { login: string };
            assignees: { nodes: Array<{ login: string }> };
            labels: { nodes: Array<{ name: string; color: string }> };
            milestone: { title: string; number: number } | null;
          };
        };
      }>(createIssueMutation, { input });

      return {
        id: response.createIssue.issue.id,
        number: response.createIssue.issue.number,
        url: response.createIssue.issue.url,
      };
    } catch (error: any) {
      throw new Error(`Failed to create issue in ${owner}/${repo}: ${error.message}`);
    }
  }

  // Add an issue or pull request to a project board
  async addIssueToProject(projectId: string, contentId: string): Promise<{ itemId: string }> {
    try {
      const mutation = `
        mutation($projectId: ID!, $contentId: ID!) {
          addProjectV2ItemById(input: {
            projectId: $projectId,
            contentId: $contentId
          }) {
            item {
              id
              type
              content {
                __typename
                ... on Issue {
                  id
                  number
                  title
                  url
                }
                ... on PullRequest {
                  id
                  number
                  title
                  url
                }
              }
            }
          }
        }
      `;

      const response = await this._octokit.graphql<{
        addProjectV2ItemById: {
          item: {
            id: string;
            type: string;
            content: {
              __typename: string;
              id: string;
              number: number;
              title: string;
              url: string;
            };
          };
        };
      }>(mutation, { projectId, contentId });

      return { itemId: response.addProjectV2ItemById.item.id };
    } catch (error: any) {
      // Check if the error is because the item already exists
      if (error.message.includes("already exists") || error.message.includes("Item already exists")) {
        // Try to find the existing item
        const projectDetails = await this.getProjectDetails(projectId);
        const existingItem = projectDetails.items.find(item => item.content.id === contentId);
        if (existingItem) {
          return { itemId: existingItem.id };
        }
      }
      throw new Error(`Failed to add issue to project ${projectId}: ${error.message}`);
    }
  }

  // Update a project item's field value
  async updateProjectItemField(
    projectId: string,
    itemId: string,
    fieldId: string,
    value: { text?: string; number?: number; date?: string; singleSelectOptionId?: string; iterationId?: string },
  ): Promise<boolean> {
    try {
      const mutation = `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
          updateProjectV2ItemFieldValue(input: {
            projectId: $projectId,
            itemId: $itemId,
            fieldId: $fieldId,
            value: $value
          }) {
            projectV2Item {
              id
            }
          }
        }
      `;

      console.log(`Updating project item field: ${itemId} with field ${fieldId} and value ${JSON.stringify(value)}`);

      await this._octokit.graphql(mutation, {
        projectId,
        itemId,
        fieldId,
        value,
      });

      return true;
    } catch (error: any) {
      throw new Error(`Failed to update project item field: ${error.message}`);
    }
  }

  // Create a draft issue directly in a project
  async createProjectDraftIssue(projectId: string, title: string, body?: string): Promise<{ itemId: string }> {
    try {
      const mutation = `
        mutation($projectId: ID!, $title: String!, $body: String) {
          addProjectV2DraftIssue(input: {
            projectId: $projectId,
            title: $title,
            body: $body
          }) {
            projectItem {
              id
            }
          }
        }
      `;

      const response = await this._octokit.graphql<{
        addProjectV2DraftIssue: {
          projectItem: {
            id: string;
          };
        };
      }>(mutation, { projectId, title, body: body || "" });

      return { itemId: response.addProjectV2DraftIssue.projectItem.id };
    } catch (error: any) {
      throw new Error(`Failed to create draft issue in project ${projectId}: ${error.message}`);
    }
  }

  // Helper method to get issue/PR ID by number
  async getIssueIdByNumber(owner: string, repo: string, number: number): Promise<string> {
    try {
      const query = `
        query($owner: String!, $name: String!, $number: Int!) {
          repository(owner: $owner, name: $name) {
            issue(number: $number) {
              id
            }
          }
        }
      `;

      const response = await this._octokit.graphql<{
        repository: {
          issue: {
            id: string;
          };
        };
      }>(query, { owner, name: repo, number });

      return response.repository.issue.id;
    } catch (error: any) {
      // If issue not found, try pull request
      try {
        const prQuery = `
          query($owner: String!, $name: String!, $number: Int!) {
            repository(owner: $owner, name: $name) {
              pullRequest(number: $number) {
                id
              }
            }
          }
        `;

        const prResponse = await this._octokit.graphql<{
          repository: {
            pullRequest: {
              id: string;
            };
          };
        }>(prQuery, { owner, name: repo, number });

        return prResponse.repository.pullRequest.id;
      } catch (prError: any) {
        throw new Error(`Failed to find issue or PR #${number} in ${owner}/${repo}: ${error.message}`);
      }
    }
  }

  // Comment on a GitHub issue
  async commentOnIssue(owner: string, repo: string, issueNumber: number, body: string): Promise<{ id: string; url: string }> {
    try {
      // First get the issue ID
      const issueId = await this.getIssueIdByNumber(owner, repo, issueNumber);

      const mutation = `
        mutation($issueId: ID!, $body: String!) {
          addComment(input: {
            subjectId: $issueId,
            body: $body
          }) {
            commentEdge {
              node {
                id
                url
                body
                author {
                  login
                }
                createdAt
              }
            }
          }
        }
      `;

      const response = await this._octokit.graphql<{
        addComment: {
          commentEdge: {
            node: {
              id: string;
              url: string;
              body: string;
              author: { login: string };
              createdAt: string;
            };
          };
        };
      }>(mutation, { issueId, body });

      return {
        id: response.addComment.commentEdge.node.id,
        url: response.addComment.commentEdge.node.url,
      };
    } catch (error: any) {
      throw new Error(`Failed to comment on issue #${issueNumber} in ${owner}/${repo}: ${error.message}`);
    }
  }

  // Update issue assignees
  async updateIssueAssignees(owner: string, repo: string, issueNumber: number, assignees: string[]): Promise<boolean> {
    try {
      // Get the issue ID
      const issueId = await this.getIssueIdByNumber(owner, repo, issueNumber);

      // Get assignee IDs
      let assigneeIds: string[] = [];
      if (assignees.length > 0) {
        // Use multiple individual user queries since GitHub doesn't have a bulk users query
        const assigneePromises = assignees.map(async (login) => {
          const assigneeQuery = `
            query($login: String!) {
              user(login: $login) {
                id
                login
              }
            }
          `;

          try {
            const assigneeResponse = await this._octokit.graphql<{
              user: { id: string; login: string };
            }>(assigneeQuery, { login });

            return assigneeResponse.user.id;
          } catch (error) {
            console.warn(`Failed to find user ${login}:`, error);
            return null;
          }
        });

        const results = await Promise.all(assigneePromises);
        assigneeIds = results.filter((id): id is string => id !== null);
      }

      const mutation = `
        mutation($issueId: ID!, $assigneeIds: [ID!]!) {
          updateIssue(input: {
            id: $issueId,
            assigneeIds: $assigneeIds
          }) {
            issue {
              id
              assignees(first: 10) {
                nodes {
                  login
                }
              }
            }
          }
        }
      `;

      await this._octokit.graphql(mutation, { issueId, assigneeIds });
      return true;
    } catch (error: any) {
      throw new Error(`Failed to update assignees for issue #${issueNumber} in ${owner}/${repo}: ${error.message}`);
    }
  }

  // Update issue labels
  async updateIssueLabels(owner: string, repo: string, issueNumber: number, labels: string[]): Promise<boolean> {
    try {
      // Get the issue ID
      const issueId = await this.getIssueIdByNumber(owner, repo, issueNumber);

      // Get label IDs
      let labelIds: string[] = [];
      if (labels.length > 0) {
        const labelQuery = `
          query($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
              labels(first: 100) {
                nodes {
                  id
                  name
                }
              }
            }
          }
        `;

        const labelResponse = await this._octokit.graphql<{
          repository: {
            labels: {
              nodes: Array<{ id: string; name: string }>;
            };
          };
        }>(labelQuery, { owner, name: repo });

        const availableLabels = labelResponse.repository.labels.nodes;
        labelIds = labels
          .map(labelName => {
            const label = availableLabels.find(l => l.name.toLowerCase() === labelName.toLowerCase());
            return label?.id;
          })
          .filter((id): id is string => id !== undefined);
      }

      const mutation = `
        mutation($issueId: ID!, $labelIds: [ID!]!) {
          updateIssue(input: {
            id: $issueId,
            labelIds: $labelIds
          }) {
            issue {
              id
              labels(first: 10) {
                nodes {
                  name
                  color
                }
              }
            }
          }
        }
      `;

      await this._octokit.graphql(mutation, { issueId, labelIds });
      return true;
    } catch (error: any) {
      throw new Error(`Failed to update labels for issue #${issueNumber} in ${owner}/${repo}: ${error.message}`);
    }
  }

  // Close an issue
  async closeIssue(owner: string, repo: string, issueNumber: number, reason?: 'COMPLETED' | 'NOT_PLANNED'): Promise<boolean> {
    try {
      // Get the issue ID
      const issueId = await this.getIssueIdByNumber(owner, repo, issueNumber);

      const mutation = `
        mutation($issueId: ID!, $reason: IssueClosedStateReason) {
          closeIssue(input: {
            issueId: $issueId,
            stateReason: $reason
          }) {
            issue {
              id
              state
              stateReason
            }
          }
        }
      `;

      await this._octokit.graphql(mutation, { 
        issueId, 
        reason: reason || 'COMPLETED'
      });
      return true;
    } catch (error: any) {
      throw new Error(`Failed to close issue #${issueNumber} in ${owner}/${repo}: ${error.message}`);
    }
  }

  // Reopen an issue
  async reopenIssue(owner: string, repo: string, issueNumber: number): Promise<boolean> {
    try {
      // Get the issue ID
      const issueId = await this.getIssueIdByNumber(owner, repo, issueNumber);

      const mutation = `
        mutation($issueId: ID!) {
          reopenIssue(input: {
            issueId: $issueId
          }) {
            issue {
              id
              state
            }
          }
        }
      `;

      await this._octokit.graphql(mutation, { issueId });
      return true;
    } catch (error: any) {
      throw new Error(`Failed to reopen issue #${issueNumber} in ${owner}/${repo}: ${error.message}`);
    }
  }

  // Update issue title and/or body
  async updateIssue(owner: string, repo: string, issueNumber: number, title?: string, body?: string): Promise<boolean> {
    try {
      if (!title && !body) {
        throw new Error("At least one of title or body must be provided");
      }

      // Get the issue ID
      const issueId = await this.getIssueIdByNumber(owner, repo, issueNumber);

      const input: any = { id: issueId };
      if (title) input.title = title;
      if (body !== undefined) input.body = body;

      const mutation = `
        mutation($input: UpdateIssueInput!) {
          updateIssue(input: $input) {
            issue {
              id
              title
              body
              updatedAt
            }
          }
        }
      `;

      await this._octokit.graphql(mutation, { input });
      return true;
    } catch (error: any) {
      throw new Error(`Failed to update issue #${issueNumber} in ${owner}/${repo}: ${error.message}`);
    }
  }

  // Get issue details by number
  async getIssueByNumber(owner: string, repo: string, issueNumber: number): Promise<any> {
    try {
      const query = `
        query($owner: String!, $name: String!, $number: Int!) {
          repository(owner: $owner, name: $name) {
            issue(number: $number) {
              id
              number
              title
              body
              state
              stateReason
              author {
                login
                avatarUrl
              }
              assignees(first: 10) {
                nodes {
                  login
                  avatarUrl
                }
              }
              labels(first: 10) {
                nodes {
                  name
                  color
                }
              }
              milestone {
                title
                number
                description
                dueOn
              }
              comments(first: 1) {
                totalCount
              }
              reactions(first: 1) {
                totalCount
              }
              createdAt
              updatedAt
              closedAt
              url
            }
          }
        }
      `;

      const response = await this._octokit.graphql<{
        repository: {
          issue: any;
        };
      }>(query, { owner, name: repo, number: issueNumber });

      return response.repository.issue;
    } catch (error: any) {
      throw new Error(`Failed to get issue #${issueNumber} from ${owner}/${repo}: ${error.message}`);
    }
  }

  // Assign users to a project board item (for issues in projects)
  async assignProjectBoardItem(projectId: string, itemId: string, usernames: string[]): Promise<boolean> {
    try {
      // Get the project details to find the Assignees field
      const projectDetails = await this.getProjectDetails(projectId);
      const assigneesField = projectDetails.fields.find(
        (f) => f.name.toLowerCase() === "assignees" && f.dataType === "SINGLE_SELECT"
      );

      if (!assigneesField) {
        // If no custom assignees field exists, try to update the built-in assignees for the underlying issue
        // First, get the project item details to see if it's an issue
        const item = projectDetails.items.find((i) => i.id === itemId);
        if (!item) {
          throw new Error(`Project item with ID '${itemId}' not found`);
        }

        if (item.type === "ISSUE" || item.type === "PULL_REQUEST") {
          // For issues and PRs, we can update assignees directly on the underlying GitHub issue
          // This requires getting the repository and issue number from the content
          if (item.content.url) {
            const urlParts = item.content.url.split('/');
            const owner = urlParts[urlParts.length - 4];
            const repo = urlParts[urlParts.length - 3];
            const number = item.content.number;

            if (number && item.type === "ISSUE") {
              await this.updateIssueAssignees(owner, repo, number, usernames);
              return true;
            }
          }
        }
        
        throw new Error("No assignees field found in project and item is not a GitHub issue that can be assigned");
      }

      // Get user IDs for the usernames
      let assigneeIds: string[] = [];
      if (usernames.length > 0) {
        // Use multiple individual user queries since GitHub doesn't have a bulk users query
        const assigneePromises = usernames.map(async (login) => {
          const assigneeQuery = `
            query($login: String!) {
              user(login: $login) {
                id
                login
              }
            }
          `;

          try {
            const assigneeResponse = await this._octokit.graphql<{
              user: { id: string; login: string };
            }>(assigneeQuery, { login });

            return assigneeResponse.user.id;
          } catch (error) {
            console.warn(`Failed to find user ${login}:`, error);
            return null;
          }
        });

        const results = await Promise.all(assigneePromises);
        assigneeIds = results.filter((id): id is string => id !== null);
      }

      // For custom assignees field, we need to update it as a user field
      const mutation = `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $userIds: [ID!]!) {
          updateProjectV2ItemFieldValue(input: {
            projectId: $projectId,
            itemId: $itemId,
            fieldId: $fieldId,
            value: {
              userIds: $userIds
            }
          }) {
            projectV2Item {
              id
            }
          }
        }
      `;

      await this._octokit.graphql(mutation, {
        projectId,
        itemId,
        fieldId: assigneesField.id,
        userIds: assigneeIds,
      });

      return true;
    } catch (error: any) {
      throw new Error(`Failed to assign users to project board item: ${error.message}`);
    }
  }

  // Remove specific assignees from a project board item
  async unassignProjectBoardItem(projectId: string, itemId: string, usernames: string[]): Promise<boolean> {
    try {
      // Get current assignees first
      const projectDetails = await this.getProjectDetails(projectId);
      const item = projectDetails.items.find((i) => i.id === itemId);
      
      if (!item) {
        throw new Error(`Project item with ID '${itemId}' not found`);
      }

      // Get current assignees from the item
      const currentAssignees = item.content.assignees || [];
      const currentUsernames = currentAssignees.map(a => a.login);
      
      // Remove the specified usernames
      const remainingUsernames = currentUsernames.filter(username => !usernames.includes(username));
      
      // Update with the remaining assignees
      return await this.assignProjectBoardItem(projectId, itemId, remainingUsernames);
    } catch (error: any) {
      throw new Error(`Failed to unassign users from project board item: ${error.message}`);
    }
  }

  // Add labels to a project board item (for issues in projects)
  async labelProjectBoardItem(projectId: string, itemId: string, labels: string[]): Promise<boolean> {
    try {
      // Get the project item details
      const projectDetails = await this.getProjectDetails(projectId);
      const item = projectDetails.items.find((i) => i.id === itemId);
      
      if (!item) {
        throw new Error(`Project item with ID '${itemId}' not found`);
      }

      if (item.type === "ISSUE" || item.type === "PULL_REQUEST") {
        // For issues and PRs, we can update labels directly on the underlying GitHub issue
        if (item.content.url) {
          const urlParts = item.content.url.split('/');
          const owner = urlParts[urlParts.length - 4];
          const repo = urlParts[urlParts.length - 3];
          const number = item.content.number;

          if (number && item.type === "ISSUE") {
            await this.updateIssueLabels(owner, repo, number, labels);
            return true;
          }
        }
      }

      throw new Error("Item is not a GitHub issue that can be labeled. Draft issues do not support labels through the GitHub API.");
    } catch (error: any) {
      throw new Error(`Failed to label project board item: ${error.message}`);
    }
  }

  // Get available assignees for a project (organization members)
  async getProjectAssignableUsers(projectId: string): Promise<Array<{ login: string; name: string; avatarUrl: string }>> {
    try {
      // Get project details to determine the organization
      const projectDetails = await this.getProjectDetails(projectId);
      const ownerLogin = projectDetails.project.owner.login;

      // Get organization members using REST API since GraphQL doesn't expose members
      // This requires the authenticated user to be a member of the organization
      const response = await this._octokit.rest.orgs.listMembers({
        org: ownerLogin,
        per_page: 100,
      });

      return response.data.map(member => ({
        login: member.login,
        name: member.name || member.login, // Use login as fallback if name is null
        avatarUrl: member.avatar_url,
      }));
    } catch (error: any) {
      // If we can't get org members (due to permissions), try getting users from project items
      console.warn(`Could not get organization members, falling back to project contributors: ${error.message}`);
      
      try {
        // Get users who are already assigned to items in the project
        const projectDetails = await this.getProjectDetails(projectId);
        const assignedUsers = new Map<string, { login: string; name: string; avatarUrl: string }>();
        
        // Extract unique users from project items
        projectDetails.items.forEach(item => {
          if (item.content.assignees) {
            item.content.assignees.forEach((assignee: { login: string; avatarUrl: string }) => {
              assignedUsers.set(assignee.login, {
                login: assignee.login,
                name: assignee.login, // We don't have names in this context
                avatarUrl: assignee.avatarUrl,
              });
            });
          }
        });

        const uniqueUsers = Array.from(assignedUsers.values());
        
        // If we still don't have users, return a helpful message
        if (uniqueUsers.length === 0) {
          return [{
            login: "No assignable users found",
            name: "Try adding users to issues in this project first",
            avatarUrl: "",
          }];
        }

        return uniqueUsers;
      } catch (fallbackError: any) {
        throw new Error(`Failed to get assignable users for project: ${error.message}. Fallback also failed: ${fallbackError.message}`);
      }
    }
  }

  // Pull Request Management Methods
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string,
    draft: boolean = false,
    maintainerCanModify: boolean = true
  ): Promise<{ id: string; number: number; url: string; mergeableState?: string }> {
    try {
      // Get the repository ID for GraphQL mutation
      const repoQuery = `
        query($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
            id
          }
        }
      `;

      const repoResponse = await this._octokit.graphql<{
        repository: { id: string };
      }>(repoQuery, { owner, name: repo });

      const repositoryId = repoResponse.repository.id;

      // Get the base and head refs
      const refsQuery = `
        query($owner: String!, $name: String!, $baseName: String!, $headName: String!) {
          repository(owner: $owner, name: $name) {
            baseRef: ref(qualifiedName: $baseName) {
              id
              target {
                oid
              }
            }
            headRef: ref(qualifiedName: $headName) {
              id
              target {
                oid
              }
            }
          }
        }
      `;

      // Ensure refs have proper format
      const baseRefName = base.startsWith('refs/heads/') ? base : `refs/heads/${base}`;
      const headRefName = head.startsWith('refs/heads/') ? head : `refs/heads/${head}`;

      const refsResponse = await this._octokit.graphql<{
        repository: {
          baseRef: { id: string; target: { oid: string } };
          headRef: { id: string; target: { oid: string } };
        };
      }>(refsQuery, { owner, name: repo, baseName: baseRefName, headName: headRefName });

      if (!refsResponse.repository.baseRef) {
        throw new Error(`Base branch '${base}' not found`);
      }
      if (!refsResponse.repository.headRef) {
        throw new Error(`Head branch '${head}' not found`);
      }

      // Create the pull request
      const mutation = `
        mutation($repositoryId: ID!, $baseRefName: String!, $headRefName: String!, $title: String!, $body: String, $draft: Boolean!, $maintainerCanModify: Boolean!) {
          createPullRequest(input: {
            repositoryId: $repositoryId,
            baseRefName: $baseRefName,
            headRefName: $headRefName,
            title: $title,
            body: $body,
            draft: $draft,
            maintainerCanModify: $maintainerCanModify
          }) {
            pullRequest {
              id
              number
              url
              title
              state
              isDraft
              mergeable
              mergeStateStatus
              baseRefName
              headRefName
            }
          }
        }
      `;

      const response = await this._octokit.graphql<{
        createPullRequest: {
          pullRequest: {
            id: string;
            number: number;
            url: string;
            title: string;
            state: string;
            isDraft: boolean;
            mergeable: string;
            mergeStateStatus: string;
            baseRefName: string;
            headRefName: string;
          };
        };
      }>(mutation, {
        repositoryId,
        baseRefName: base,
        headRefName: head,
        title,
        body: body || "",
        draft,
        maintainerCanModify,
      });

      const pr = response.createPullRequest.pullRequest;
      return {
        id: pr.id,
        number: pr.number,
        url: pr.url,
        mergeableState: pr.mergeStateStatus,
      };
    } catch (error: any) {
      throw new Error(`Failed to create pull request in ${owner}/${repo}: ${error.message}`);
    }
  }

  async commentOnPullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    body: string
  ): Promise<{ id: string; url: string }> {
    try {
      // Get the PR ID for GraphQL mutation
      const prQuery = `
        query($owner: String!, $name: String!, $number: Int!) {
          repository(owner: $owner, name: $name) {
            pullRequest(number: $number) {
              id
            }
          }
        }
      `;

      const prResponse = await this._octokit.graphql<{
        repository: {
          pullRequest: { id: string };
        };
      }>(prQuery, { owner, name: repo, number: prNumber });

      if (!prResponse.repository.pullRequest) {
        throw new Error(`Pull request #${prNumber} not found`);
      }

      const prId = prResponse.repository.pullRequest.id;

      // Add comment to the pull request
      const mutation = `
        mutation($prId: ID!, $body: String!) {
          addComment(input: {
            subjectId: $prId,
            body: $body
          }) {
            commentEdge {
              node {
                id
                url
                body
                author {
                  login
                }
                createdAt
              }
            }
          }
        }
      `;

      const response = await this._octokit.graphql<{
        addComment: {
          commentEdge: {
            node: {
              id: string;
              url: string;
              body: string;
              author: {
                login: string;
              };
              createdAt: string;
            };
          };
        };
      }>(mutation, { prId, body });

      return {
        id: response.addComment.commentEdge.node.id,
        url: response.addComment.commentEdge.node.url,
      };
    } catch (error: any) {
      throw new Error(`Failed to comment on pull request #${prNumber} in ${owner}/${repo}: ${error.message}`);
    }
  }

  async getPullRequestDetails(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<{
    id: string;
    number: number;
    title: string;
    body: string;
    state: string;
    isDraft: boolean;
    author: { login: string; avatarUrl: string };
    baseRefName: string;
    headRefName: string;
    mergeable: string;
    mergeStateStatus: string;
    url: string;
    createdAt: string;
    updatedAt: string;
    reviewDecision?: string;
    reviews: Array<{ author: string; state: string; submittedAt: string }>;
    comments: { totalCount: number };
  }> {
    try {
      const query = `
        query($owner: String!, $name: String!, $number: Int!) {
          repository(owner: $owner, name: $name) {
            pullRequest(number: $number) {
              id
              number
              title
              body
              state
              isDraft
              author {
                login
                avatarUrl
              }
              baseRefName
              headRefName
              mergeable
              mergeStateStatus
              url
              createdAt
              updatedAt
              reviewDecision
              reviews(last: 10) {
                nodes {
                  author {
                    login
                  }
                  state
                  submittedAt
                }
              }
              comments {
                totalCount
              }
            }
          }
        }
      `;

      const response = await this._octokit.graphql<{
        repository: {
          pullRequest: {
            id: string;
            number: number;
            title: string;
            body: string;
            state: string;
            isDraft: boolean;
            author: {
              login: string;
              avatarUrl: string;
            };
            baseRefName: string;
            headRefName: string;
            mergeable: string;
            mergeStateStatus: string;
            url: string;
            createdAt: string;
            updatedAt: string;
            reviewDecision?: string;
            reviews: {
              nodes: Array<{
                author: {
                  login: string;
                };
                state: string;
                submittedAt: string;
              }>;
            };
            comments: {
              totalCount: number;
            };
          };
        };
      }>(query, { owner, name: repo, number: prNumber });

      if (!response.repository.pullRequest) {
        throw new Error(`Pull request #${prNumber} not found`);
      }

      const pr = response.repository.pullRequest;
      return {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        isDraft: pr.isDraft,
        author: pr.author,
        baseRefName: pr.baseRefName,
        headRefName: pr.headRefName,
        mergeable: pr.mergeable,
        mergeStateStatus: pr.mergeStateStatus,
        url: pr.url,
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
        reviewDecision: pr.reviewDecision,
        reviews: pr.reviews.nodes.map(review => ({
          author: review.author.login,
          state: review.state,
          submittedAt: review.submittedAt,
        })),
        comments: pr.comments,
      };
    } catch (error: any) {
      throw new Error(`Failed to get details for pull request #${prNumber} in ${owner}/${repo}: ${error.message}`);
    }
  }
}
