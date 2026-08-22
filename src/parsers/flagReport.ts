/**
 * Describes the ESBMC flags the current settings produce.
 *
 * Every setting at its default emits no flags at all, which reads as a bug
 * unless the report says so explicitly.
 */
export function describeFlags (flags: string): string {
  return flags === ''
    ? 'ESBMC flags: none, every setting is at its default'
    : `ESBMC flags: ${flags}`
}
