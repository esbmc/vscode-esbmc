import { Configuration } from '../@types/vscode.configuration'

function isPlainObject (value: unknown): value is Configuration {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Combines the scopes VS Code reports for a settings section.
 *
 * `inspect` reports each scope separately and only returns values that were
 * explicitly set, so reading `globalValue` alone silently ignores everything
 * in a workspace or folder `settings.json`. Later scopes win, and nested
 * groups merge key by key rather than wholesale, so a workspace setting one
 * property does not discard a user setting on another.
 */
export function mergeConfigScopes (...scopes: Array<Configuration | undefined>): Configuration {
  const merged: Configuration = {}
  for (const scope of scopes) {
    if (!isPlainObject(scope)) {
      continue
    }
    for (const [key, value] of Object.entries(scope)) {
      const existing = merged[key]
      merged[key] = isPlainObject(existing) && isPlainObject(value)
        ? { ...existing, ...value }
        : value
    }
  }
  return merged
}
