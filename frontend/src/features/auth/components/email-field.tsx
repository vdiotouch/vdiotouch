import * as React from "react";
import { MailOutlined } from "@ant-design/icons";
import { Form, Input } from "antd";

interface EmailFieldProps {
  /** Replaces the validation message, e.g. "already exists, log in instead". */
  help?: React.ReactNode;
}

/** Required, validated email field. Use inside an AntD Form. */
export function EmailField({ help }: EmailFieldProps) {
  return (
    <Form.Item
      name="email"
      label="Email"
      help={help}
      rules={[
        { required: true, message: "Enter your email" },
        { type: "email", message: "Enter a valid email address" },
      ]}
    >
      <Input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@company.com"
        prefix={<MailOutlined aria-hidden="true" />}
      />
    </Form.Item>
  );
}
