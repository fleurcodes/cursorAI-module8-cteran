/**
 * Returns true when the given href matches the current hash-based route.
 *
 * @param href  - Route path to test, e.g. "/products" or "/"
 * @param exact - When true, require an exact match (default: false → prefix match)
 */
export function isActive(href: string, exact = false): boolean {
  // Strip the leading "#" from the hash to get a plain path, e.g. "/products"
  const rawHash = window.location.hash.replace(/^#/, '') || '/';

  // Normalise: remove trailing slashes, treat "" as "/"
  const normalize = (p: string): string => p.replace(/\/+$/, '') || '/';

  const current = normalize(rawHash);
  const target = normalize(href);

  // "/" must always be an exact match to avoid matching every route
  if (exact || target === '/') {
    return current === target;
  }

  // Prefix match: "/products" matches "/products" and "/products/123"
  return current === target || current.startsWith(target + '/');
}
