/** Sections in the main navigation and the route each one opens. */
export const NAV_ROUTES = {
  videos: "/",
  webhooks: "/developer",
} as const;

export type NavKey = keyof typeof NAV_ROUTES;

export function navKeyForPath(pathname: string): NavKey {
  return pathname.startsWith(NAV_ROUTES.webhooks) ? "webhooks" : "videos";
}

export interface Crumb {
  label: string;
  /** Set when the crumb links back to a parent page. */
  to?: "/";
}

export function breadcrumbsForPath(pathname: string): Crumb[] {
  if (pathname.startsWith(NAV_ROUTES.webhooks)) {
    return [{ label: "Developer" }, { label: "Webhooks" }];
  }
  if (pathname.startsWith("/videos/")) {
    return [{ label: "Videos", to: "/" }, { label: "Video details" }];
  }
  return [{ label: "Videos" }];
}
