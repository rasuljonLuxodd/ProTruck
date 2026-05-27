/**
 * Customer URL slug + profile path helpers.
 *
 * Lives in `lib/` (not `pages/Customers.tsx`) so other pages can import
 * the helper without pulling the whole Customers page into their bundle —
 * which would defeat the route-level code-splitting in App.tsx.
 *
 * Slug = lowercase name with non-alphanumeric runs (incl. Cyrillic block)
 * collapsed to a single dash. Two customers with the same name will
 * collide; acceptable for a small business until we add stable customer
 * IDs.
 */
export function customerSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function customerProfilePath(name: string): string {
  return `/customers/${customerSlug(name)}`;
}
