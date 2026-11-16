// Small helpers shared by the page parts.
export const pad2 = (n) => String(n).padStart(2, '0');
export const canVisit = (s) => !!s.url && s.status !== 'Private staging';

// The project view has its own address: /site/<id>. Everything else is the story.
const SITE_PATH = /^\/site\/([a-z0-9-]+)\/?$/i;
export function siteIdFromPath(pathname = location.pathname) {
  const m = SITE_PATH.exec(pathname);
  return m ? m[1].toLowerCase() : null;
}
export const sitePath = (id) => `/site/${id}${location.search}`;
export const storyPath = () => `/${location.search}`;
