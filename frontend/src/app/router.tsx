import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { VideoDetailsPage } from "@/features/assets/pages/video-details-page";
import { VideosPage } from "@/features/assets/pages/videos-page";
import { LoginPage } from "@/features/auth/pages/login-page";
import { SignupPage } from "@/features/auth/pages/signup-page";
import { WebhooksPage } from "@/features/webhooks/pages/webhooks-page";
import { ProtectedLayout, PublicOnly } from "./route-guards";

const rootRoute = createRootRoute({ component: Outlet });

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_app",
  component: ProtectedLayout,
});

const routeTree = rootRoute.addChildren([
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/login",
    component: () => (
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/signup",
    component: () => (
      <PublicOnly>
        <SignupPage />
      </PublicOnly>
    ),
  }),
  appRoute.addChildren([
    createRoute({ getParentRoute: () => appRoute, path: "/", component: VideosPage }),
    createRoute({ getParentRoute: () => appRoute, path: "/videos/$id", component: VideoDetailsPage }),
    createRoute({ getParentRoute: () => appRoute, path: "/developer", component: WebhooksPage }),
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
