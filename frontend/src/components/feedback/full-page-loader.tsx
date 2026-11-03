import { Spin } from "antd";

interface FullPageLoaderProps {
  label?: string;
}

/** Centred spinner that fills the viewport, for app start-up. */
export function FullPageLoader({ label = "Loading…" }: FullPageLoaderProps) {
  return (
    <div style={{ display: "grid", minHeight: "100vh", placeItems: "center" }}>
      <Spin size="large" description={label} />
    </div>
  );
}
