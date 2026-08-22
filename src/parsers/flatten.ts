function isPlainObject (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Flattens nested settings into dotted keys, so `properties.assertions` reads
 * the same way whether the setting is nested in the manifest or not.
 *
 * An empty object is kept as a value rather than vanishing, and arrays are
 * left alone — matching what `flatten-anything` did before it became
 * ESM-only and could no longer be required from this extension.
 */
export function flatten (value: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const flat: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    const name = prefix === '' ? key : `${prefix}.${key}`
    if (isPlainObject(entry) && Object.keys(entry).length > 0) {
      Object.assign(flat, flatten(entry, name))
    } else {
      flat[name] = entry
    }
  }
  return flat
}
