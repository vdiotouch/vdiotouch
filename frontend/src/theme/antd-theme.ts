import type { ThemeConfig } from "antd";
import { tokens as t } from "./tokens";

/*
 * The one AntD theme. Every value is set explicitly from the design tokens so
 * AntD never falls back to its own blue palette or derives a colour we have
 * not audited for WCAG AA.
 */

const fontFamily =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const antdTheme: ThemeConfig = {
  token: {
    fontFamily,
    fontSize: 14,
    borderRadius: 8,
    controlHeight: 36,

    colorPrimary: t.interactive,
    colorPrimaryHover: t.interactiveHover,
    colorPrimaryActive: t.interactiveActive,
    colorPrimaryBg: t.interactiveSubtle,
    colorPrimaryBgHover: t.interactiveSubtle,
    colorPrimaryText: t.interactiveText,
    colorPrimaryTextHover: t.interactiveTextHover,
    colorPrimaryTextActive: t.interactiveActive,

    colorLink: t.interactiveText,
    colorLinkHover: t.interactiveTextHover,
    colorLinkActive: t.interactiveActive,

    colorInfo: t.processing,
    colorInfoBg: t.processingSurface,
    colorInfoBorder: t.processingBorder,
    colorInfoText: t.processingText,
    colorSuccess: t.success,
    colorSuccessBg: t.successSurface,
    colorSuccessBorder: t.successBorder,
    colorSuccessText: t.successText,
    colorWarning: t.warning,
    colorWarningBg: t.warningSurface,
    colorWarningBorder: t.warningBorder,
    colorWarningText: t.warningText,
    colorError: t.danger,
    colorErrorBg: t.dangerSurface,
    colorErrorBorder: t.dangerBorder,
    colorErrorText: t.dangerText,

    colorTextBase: t.content,
    colorText: t.content,
    colorTextHeading: t.content,
    colorTextLabel: t.content,
    colorTextSecondary: t.muted,
    colorTextTertiary: t.muted,
    colorTextDescription: t.muted,
    colorTextPlaceholder: t.muted,
    colorTextQuaternary: t.subtle,
    colorTextDisabled: t.subtle,
    colorTextLightSolid: t.interactiveFg,
    colorIcon: t.muted,
    colorIconHover: t.content,

    colorBgBase: t.surface,
    colorBgContainer: t.raised,
    colorBgElevated: t.overlay,
    colorBgLayout: t.sunken,

    // Inputs, selects and checkboxes get the 3:1 border (WCAG 1.4.11);
    // dividers and card edges use the subtle one.
    colorBorder: t.borderStrong,
    colorBorderSecondary: t.borderSubtle,
    colorSplit: t.borderSubtle,
  },
  components: {
    Layout: {
      bodyBg: t.sunken,
      siderBg: t.raised,
      headerBg: t.raised,
      lightSiderBg: t.raised,
    },
    Menu: {
      itemBg: "transparent",
      itemSelectedBg: t.interactiveSubtle,
      itemSelectedColor: t.interactiveText,
      itemColor: t.content,
      groupTitleColor: t.muted,
      itemHoverBg: t.interactiveSubtle,
    },
    Table: {
      headerBg: t.sunken,
      headerColor: t.muted,
      rowSelectedBg: t.interactiveSubtle,
      rowSelectedHoverBg: "#e8eeff",
      borderColor: t.borderSubtle,
    },
    Input: { hoverBorderColor: t.interactiveHover, activeBorderColor: t.interactive },
    Select: { hoverBorderColor: t.interactiveHover, activeBorderColor: t.interactive },
    Button: {
      primaryColor: t.interactiveFg,
      defaultBorderColor: t.borderStrong,
      dangerColor: "#ffffff",
    },
    Checkbox: { colorBorder: t.borderStrong },
    Switch: { handleBg: "#ffffff" },
    Segmented: { itemSelectedColor: t.content, itemColor: t.muted },
    Tag: { defaultColor: t.content },
    Card: { colorBorderSecondary: t.borderSubtle },
    Tabs: {
      itemColor: t.muted,
      itemSelectedColor: t.interactiveText,
      itemHoverColor: t.interactiveText,
      itemActiveColor: t.interactiveText,
      inkBarColor: t.interactive,
    },
    Pagination: {
      itemActiveColor: t.interactiveText,
      itemActiveColorHover: t.interactiveText,
    },
    Form: {
      verticalLabelPadding: "0 0 8px",
      labelHeight: 22,
      itemMarginBottom: 24,
      labelColor: t.content,
    },
  },
};
