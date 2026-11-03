import { Typography } from "antd";
import { TextLink } from "@/components/navigation/text-link";
import styles from "./auth-switch-prompt.module.css";

const COPY = {
  signup: {
    path: "/signup",
    question: "New to Vdio Touch?",
    link: "Create an account",
    shortQuestion: "No account?",
    shortLink: "Sign up",
  },
  login: {
    path: "/login",
    question: "Already have an account?",
    link: "Log in",
    shortQuestion: "Have an account?",
    shortLink: "Log in",
  },
} as const;

interface AuthSwitchPromptProps {
  /** The page the link opens. */
  to: "login" | "signup";
  /** Short wording for the top bar. */
  compact?: boolean;
}

/** "Already have an account? Log in" and its sign up counterpart. */
export function AuthSwitchPrompt({ to, compact = false }: AuthSwitchPromptProps) {
  const copy = COPY[to];
  return (
    <Typography.Text type="secondary" className={compact ? styles.compact : styles.centered}>
      {compact ? copy.shortQuestion : copy.question}{" "}
      <TextLink to={copy.path}>{compact ? copy.shortLink : copy.link}</TextLink>
    </Typography.Text>
  );
}
