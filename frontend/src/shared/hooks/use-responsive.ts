import { Grid } from "antd";

export interface Responsive {
  /** Below 768px: phone layout (cards instead of tables, tighter padding). */
  isMobile: boolean;
  /** Below 992px: the side nav collapses into a drawer. */
  isNarrow: boolean;
}

/**
 * The two layout breakpoints used across the app, from AntD's grid breakpoints.
 *
 * `Grid.useBreakpoint` is empty on the first render, so until it fills in we
 * assume a desktop layout (both flags false).
 */
export function useResponsive(): Responsive {
  const screens = Grid.useBreakpoint();
  const ready = Object.keys(screens).length > 0;
  return {
    isMobile: ready && !screens.md,
    isNarrow: ready && !screens.lg,
  };
}
