import * as fs from 'fs/promises';
import * as path from 'path';
import { getRegistryDirName, getWorkspaceRoot } from './fileUtils';

export interface RuleMetaEntry {
  tags?: string[];
}

/**
 * Path to the metadata file inside the registry directory.
 */
export const META_FILENAME = 'rules-metadata.jsonc';

/**
 * Load the metadata map (ruleId -> RuleMetaEntry). Returns an empty object when file does not exist or is malformed.
 */
export async function loadRulesMetadata(): Promise<Record<string, RuleMetaEntry>> {
  try {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) throw new Error('No workspace');

    const registryDir = path.join(workspaceRoot, getRegistryDirName());
    const metaPath = path.join(registryDir, META_FILENAME);

    const raw = await fs.readFile(metaPath, 'utf8');
    // Strip single line comments (// ...)
    const noComments = raw.replace(/(^\s*\/\/.*$)/gm, '');
    // Remove trailing commas before closing braces/brackets
    const cleaned = noComments.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(cleaned);
  } catch (err) {
    // File missing or malformed – return empty map
    return {};
  }
}

/**
 * Save partial metadata for a rule (merge). Creates the file if necessary.
 */
export async function saveRuleMetadata(ruleId: string, entry: RuleMetaEntry): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) throw new Error('No workspace');

  const registryDir = path.join(workspaceRoot, getRegistryDirName());
  const metaPath = path.join(registryDir, META_FILENAME);

  let map: Record<string, RuleMetaEntry> = {};
  try {
    map = await loadRulesMetadata();
  } catch {
    map = {};
  }

  // Merge entry and ensure tags sorted
  const existing = map[ruleId] ?? {};
  const mergedTags = (entry.tags ?? existing.tags) ? [...new Set([...(entry.tags ?? existing.tags ?? [])])].sort((a,b)=>a.localeCompare(b)) : undefined;
  map[ruleId] = { ...existing, ...entry, ...(mergedTags ? { tags: mergedTags } : {}) };

  // Stringify with 2-space indent and trailing commas to keep one-entry-per-line style
  const lines = Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).map(([id, e]) => {
    const json = JSON.stringify(e);
    return `  "${id}": ${json},`;
  });
  const content = `{
${lines.join('\n')}
}`;
  await fs.mkdir(path.dirname(metaPath), { recursive: true });
  await fs.writeFile(metaPath, content, 'utf8');
}

/** Add a single tag to a rule, if not already present. */
export async function addTagToRule(ruleId: string, tag: string): Promise<void> {
  tag = tag.trim();
  if (!tag) return;

  const meta = await loadRulesMetadata();
  const entry = meta[ruleId] ?? { tags: [] };
  const tags = new Set(entry.tags ?? []);
  tags.add(tag);
  await saveRuleMetadata(ruleId, { tags: Array.from(tags) });
}

/** Remove a tag from a rule. Does nothing if tag not present. */
export async function removeTagFromRule(ruleId: string, tag: string): Promise<void> {
  const meta = await loadRulesMetadata();
  const entry = meta[ruleId];
  if (!entry || !entry.tags) return;
  const filtered = entry.tags.filter(t => t !== tag);
  await saveRuleMetadata(ruleId, { tags: filtered });
} 