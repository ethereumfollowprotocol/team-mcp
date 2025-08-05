# GitHub Actions Deployment Setup

This document explains how to set up automatic deployment to Cloudflare Workers when code is pushed to the `master` or `main` branch.

## Required GitHub Repository Secrets

You need to add the following secrets to your GitHub repository:

### 1. CLOUDFLARE_API_TOKEN

This is a Cloudflare API token with the necessary permissions to deploy Workers.

**How to create:**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use the "Custom token" template
4. Configure the token with these permissions:
   - **Account** - `Cloudflare Workers:Edit`
   - **Zone** - `Zone:Read` (if you have custom domains)
   - **Account** - `Account:Read`
5. Add your account ID to "Account Resources"
6. Copy the generated token

### 2. CLOUDFLARE_ACCOUNT_ID

Your Cloudflare Account ID.

**How to find:**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select any domain or go to the Workers section
3. In the right sidebar, you'll see "Account ID"
4. Copy the Account ID

## Adding Secrets to GitHub Repository

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret:
   - Name: `CLOUDFLARE_API_TOKEN`, Value: `[your API token]`
   - Name: `CLOUDFLARE_ACCOUNT_ID`, Value: `[your account ID]`

## Workflow Features

The deployment workflow includes:

- ✅ **Automatic deployment** on push to `master` or `main` branch
- ✅ **Manual deployment** trigger via GitHub Actions UI
- ✅ **Type checking** before deployment to catch errors early
- ✅ **Dependency installation** and caching for faster builds
- ✅ **Deployment status** reporting

## Workflow Triggers

The workflow runs automatically when:

- Code is pushed to `master` branch
- Code is pushed to `main` branch
- Manually triggered from the GitHub Actions tab

## Monitoring Deployments

1. Go to your repository's **Actions** tab
2. Click on any workflow run to see the deployment status
3. Check the logs for any errors or success messages
4. The deployed Worker will be available at: `https://team-mcp.efp.workers.dev`

## Troubleshooting

### Common Issues:

1. **Invalid API Token**: Ensure your `CLOUDFLARE_API_TOKEN` has the correct permissions
2. **Wrong Account ID**: Verify your `CLOUDFLARE_ACCOUNT_ID` is correct
3. **Type Check Failures**: Fix any TypeScript errors before the workflow can proceed
4. **Dependency Issues**: Ensure `package-lock.json` is committed and up to date

### Checking Workflow Status:

- Green checkmark ✅ = Deployment successful
- Red X ❌ = Deployment failed (check logs for details)
- Yellow circle 🟡 = Deployment in progress

## Security Notes

- Never commit API tokens or secrets to your repository
- API tokens should have minimal required permissions
- Regularly rotate your API tokens for security
- Use GitHub's encrypted secrets feature for sensitive data
