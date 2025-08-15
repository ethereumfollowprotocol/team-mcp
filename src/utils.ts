import { type Env } from './types';

/**
 * Provides rate limiting and caching utilities for GitHub API requests
 */
export class RateLimitCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data as T;
    }
    return null;
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Validates and sanitizes GitHub repository and organization names
 */
export function validateGitHubName(name: string, type: 'repo' | 'org' | 'username'): boolean {
  // GitHub names must be 1-39 characters, alphanumeric with hyphens
  const pattern = /^[a-zA-Z0-9-_]+$/;
  
  if (!name || name.length === 0 || name.length > 39) {
    return false;
  }
  
  if (!pattern.test(name)) {
    return false;
  }
  
  // Cannot start or end with hyphen
  if (name.startsWith('-') || name.endsWith('-')) {
    return false;
  }
  
  return true;
}

/**
 * Formats date/time for consistent display
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD format
}

/**
 * Sanitizes user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>"'&]/g, '') // Remove potentially harmful characters
    .trim()
    .substring(0, 1000); // Limit length
}

/**
 * Adds MCP co-author attribution to GitHub content (PR descriptions, issue bodies, comments)
 * This ensures transparency about MCP assistance in all GitHub operations
 */
export function addCoAuthorAttribution(content: string): string {
  if (!content) {
    content = '';
  }
  
  // Check if attribution already exists to avoid duplicates
  if (content.includes('Co-authored-by: mcp-agent')) {
    return content;
  }
  
  // Add signature at the end with proper spacing
  const attribution = '\n\n---\n*Co-authored-by: mcp-agent*';
  
  return content.trim() + attribution;
}
