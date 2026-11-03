import * as React from "react";
import { Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout";
import { useAuth } from "@/features/auth/auth-provider";

/** Signed-in pages: redirects to log in, otherwise renders the app shell. */
export function ProtectedLayout() {
  const { user, logout } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return <AppShell user={user} onLogout={logout} />;
}

/** Log in and sign up: a signed-in user goes straight to the app. */
export function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/" />;
  return <>{children}</>;
}
