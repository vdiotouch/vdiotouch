import { CopyOutlined } from "@ant-design/icons";
import { Button, type ButtonProps } from "antd";
import { copyToClipboard } from "@/shared/lib/clipboard";

interface CopyButtonProps extends Omit<ButtonProps, "onClick"> {
  /** The text to copy. */
  text: string;
  /** Names what is copied in the toast: "Playlist URL" -> "Playlist URL copied". */
  label: string;
}

/** Button that copies a value and confirms with a toast. */
export function CopyButton({ text, label, icon, ...buttonProps }: CopyButtonProps) {
  return (
    <Button
      {...buttonProps}
      icon={icon ?? <CopyOutlined aria-hidden="true" />}
      onClick={() => void copyToClipboard(text, label)}
    />
  );
}
