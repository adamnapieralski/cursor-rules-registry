import * as path from 'path';

/**
 * Normalizes a team name or username so it can be safely embedded in filenames / IDs.
 *   • teams   – lower-case, spaces removed
 *   • users   – take part before '@' and remove dots
 */
export function getRuleSource(team?: string, user?: string): string {
  if (team) {
    return team.toLowerCase().replace(/\s+/g, '');
  }
  if (user) {
    return user.split('@')[0].replace(/\./g, '');
  }
  return '';
}

/**
 * Derive deterministic rule ID (and applied filename stem) from file path and owner.
 * Example:  foo/bar/clock.mdc + team "AssetFoundations"  ->  "clock.assetfoundations"
 */
export function deriveRuleId(filePath: string, team?: string, user?: string): string {
  const baseName = path.parse(filePath).name; // strip extension
  const source = getRuleSource(team, user);
  return source ? `${baseName}.${source}` : baseName;
} 