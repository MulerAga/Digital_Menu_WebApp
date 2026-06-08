import { createContext, useContext } from 'react';

/**
 * SlugContext holds the current restaurant slug AND optional branch slug.
 *
 * Main branch:   slug="canoe-restaurant", branchSlug=null
 * Sub-branch:    slug="canoe-restaurant", branchSlug="bole"
 */
const SlugContext = createContext({ slug: null, branchSlug: null });

export const SlugProvider = ({ slug, branchSlug = null, children }) => (
  <SlugContext.Provider value={{ slug, branchSlug }}>
    {children}
  </SlugContext.Provider>
);

export const useSlug = () => useContext(SlugContext).slug;
export const useBranchSlug = () => useContext(SlugContext).branchSlug;

/**
 * Returns the full base path for the current context.
 * Main branch:  /canoe-restaurant
 * Sub-branch:   /canoe-restaurant/branches/bole
 */
export const useBasePath = () => {
  const { slug, branchSlug } = useContext(SlugContext);
  if (!slug) return '';
  if (branchSlug) return `/${slug}/branches/${branchSlug}`;
  return `/${slug}`;
};

/**
 * Returns just the restaurant root (ignores branch).
 * Useful for links that should always go to the restaurant root.
 */
export const useRestaurantPath = () => {
  const { slug } = useContext(SlugContext);
  return slug ? `/${slug}` : '';
};
