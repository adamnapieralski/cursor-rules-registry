import * as path from 'path';
import { getWorkspaceRoot, getRegistryDirName } from './fileUtils';

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
  const source = getRuleSource(team, user);

  // Handle team/user rules
  if (source) {
    const baseName = path.parse(filePath).name;
    return `${baseName}.${source}`;
  }

  // For generic rules – build ID from path within registry
  try {
    const workspaceRoot = getWorkspaceRoot();
    if (workspaceRoot) {
      const registryRoot = path.join(workspaceRoot, getRegistryDirName());
      let rel = path.relative(registryRoot, filePath);
      rel = rel.replace(/\\/g, '/'); // normalize Windows separators
      rel = rel.replace(/\.mdc$/i, ''); // drop extension

      // Replace path separators with dots for ID
      const id = rel.split('/').filter(Boolean).join('.');
      return id;
    }
  } catch {
    /* fallback below */
  }

  // Fallback to filename without extension
  return path.parse(filePath).name;
} 