import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { UserOutlined } from "@ant-design/icons";
import { Button, Form, Input } from "antd";
import { FormErrorAlert } from "@/components/feedback/form-error-alert";
import { PasswordInput } from "@/components/form/password-input";
import { TextLink } from "@/components/navigation/text-link";
import { useAuth } from "../auth-provider";
import { AuthHeading } from "../components/auth-heading";
import { AuthLayout } from "../components/auth-layout";
import { AuthSwitchPrompt } from "../components/auth-switch-prompt";
import { EmailField } from "../components/email-field";
import { PasswordChecklist } from "../components/password-checklist";
import { isEmailTakenError, signupErrorMessage } from "../lib/auth-errors";
import { meetsPasswordRule } from "../lib/password-rule";

interface SignupValues {
  name: string;
  email: string;
  password: string;
}

const EMAIL_TAKEN_HELP = (
  <span>
    An account with this email already exists. <TextLink to="/login">Log in instead</TextLink>
  </span>
);

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm<SignupValues>();
  const password = Form.useWatch("password", form) ?? "";
  const [submitting, setSubmitting] = React.useState(false);
  /** Set on the first submit so the checklist can show an unmet rule in red. */
  const [submitted, setSubmitted] = React.useState(false);
  const [emailTaken, setEmailTaken] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const showEmailTaken = () => {
    setEmailTaken(true);
    // A non-empty error keeps the field red; EMAIL_TAKEN_HELP is the message.
    form.setFields([{ name: "email", errors: ["taken"] }]);
    form.getFieldInstance("email")?.focus?.();
  };

  const clearEmailTaken = () => {
    setEmailTaken(false);
    form.setFields([{ name: "email", errors: [] }]);
  };

  const handleSubmit = async ({ name, email, password }: SignupValues) => {
    setSubmitted(true);
    setError(null);
    setEmailTaken(false);
    setSubmitting(true);
    try {
      await signup(name.trim(), email, password);
      await navigate({ to: "/" });
    } catch (err) {
      setSubmitting(false);
      if (isEmailTakenError(err)) showEmailTaken();
      else setError(signupErrorMessage(err));
    }
  };

  const handleValuesChange = (changed: Partial<SignupValues>) => {
    if ("email" in changed && emailTaken) clearEmailTaken();
  };

  return (
    <AuthLayout mode="signup">
      <AuthHeading
        title="Create your account"
        subtitle="Free to start. Upload your first video in a couple of minutes."
      />
      <FormErrorAlert message={error} />

      <Form<SignupValues>
        form={form}
        layout="vertical"
        size="large"
        requiredMark={false}
        validateTrigger="onSubmit"
        scrollToFirstError={{ focus: true }}
        disabled={submitting}
        onFinish={handleSubmit}
        onFinishFailed={() => setSubmitted(true)}
        onValuesChange={handleValuesChange}
      >
        <Form.Item
          name="name"
          label="Full name"
          rules={[{ required: true, whitespace: true, message: "Enter your name" }]}
        >
          <Input
            placeholder="Your name"
            autoComplete="name"
            prefix={<UserOutlined aria-hidden="true" />}
          />
        </Form.Item>

        <EmailField help={emailTaken ? EMAIL_TAKEN_HELP : undefined} />

        <Form.Item
          name="password"
          label="Password"
          // PasswordChecklist is the message; these rules only keep the field red.
          rules={[
            { required: true, message: " " },
            {
              validator: (_, value: string | undefined) =>
                !value || meetsPasswordRule(value) ? Promise.resolve() : Promise.reject(new Error(" ")),
            },
          ]}
          help={<PasswordChecklist password={password} submitted={submitted} />}
        >
          <PasswordInput placeholder="Create a password" autoComplete="new-password" />
        </Form.Item>

        <Button
          type="primary"
          htmlType="submit"
          block
          loading={submitting}
          aria-busy={submitting}
          style={{ marginTop: 8 }}
        >
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </Form>

      <AuthSwitchPrompt to="login" />
    </AuthLayout>
  );
}
