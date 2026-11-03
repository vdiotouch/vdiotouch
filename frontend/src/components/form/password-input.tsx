import { EyeInvisibleOutlined, EyeOutlined, LockOutlined } from "@ant-design/icons";
import { Input } from "antd";
import type { PasswordProps } from "antd/es/input";
import styles from "./password-input.module.css";

/** Show / hide toggle with a real label and pressed state for screen readers. */
function renderVisibilityToggle(visible: boolean) {
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible}
    >
      {visible ? <EyeOutlined aria-hidden="true" /> : <EyeInvisibleOutlined aria-hidden="true" />}
    </button>
  );
}

/**
 * AntD Input.Password with a lock icon and an accessible show / hide toggle.
 * Use it inside a Form.Item; Form passes `value` and `onChange`.
 */
export function PasswordInput(props: PasswordProps) {
  return (
    <Input.Password
      prefix={<LockOutlined aria-hidden="true" />}
      iconRender={renderVisibilityToggle}
      {...props}
    />
  );
}
