import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Form } from "antd";
import { FormErrorAlert } from "@/components/feedback/form-error-alert";
import { PasswordInput } from "@/components/form/password-input";
import { SupportLink } from "@/components/navigation/support-link";
import { useAuth } from "../auth-provider";
import { AuthHeading } from "../components/auth-heading";
import { AuthLayout } from "../components/auth-layout";
import { AuthSwitchPrompt } from "../components/auth-switch-prompt";
import { EmailField } from "../components/email-field";
import { loginErrorMessage } from "../lib/auth-errors";

interface LoginValues {
  email: string;
  password: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginValues>();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async ({ email, password }: LoginValues) => {
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      await navigate({ to: "/" });
    } catch (err) {
      setError(loginErrorMessage(err));
      form.setFieldValue("password", "");
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout mode="login">
      <AuthHeading title="Log in" subtitle="Welcome back. Log in to manage your videos." />
      <FormErrorAlert message={error} />

      <Form<LoginValues>
        form={form}
        layout="vertical"
        size="large"
        requiredMark={false}
        validateTrigger="onSubmit"
        scrollToFirstError={{ focus: true }}
        disabled={submitting}
        onFinish={handleSubmit}
      >
        <EmailField />
        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: "Enter your password" }]}
          extra={
            <span>
              Forgot your password? <SupportLink />
            </span>
          }
        >
          <PasswordInput placeholder="Your password" autoComplete="current-password" />
        </Form.Item>

        <Button type="primary" htmlType="submit" block loading={submitting} aria-busy={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </Form>

      <AuthSwitchPrompt to="signup" />
    </AuthLayout>
  );
}
