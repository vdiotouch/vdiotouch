import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { App, ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import { AuthProvider } from "@/features/auth/auth-provider";
import { queryClient } from "@/shared/api/query-client";
import { setMessageInstance } from "@/shared/lib/notify";
import { antdTheme } from "@/theme";

/** Hands AntD's `message` to `notify` so non-component code can show toasts. */
function MessageBridge() {
  const { message } = App.useApp();
  React.useEffect(() => {
    setMessageInstance(message);
    return () => setMessageInstance(null);
  }, [message]);
  return null;
}

/** Theme and toasts. */
function UiProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={antdTheme} locale={enUS}>
      <App message={{ maxCount: 3 }}>
        <MessageBridge />
        {children}
      </App>
    </ConfigProvider>
  );
}

/** Every app-wide provider, outermost first. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UiProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </UiProvider>
  );
}
