import { CheckCircleFilled, CloseCircleFilled, InfoCircleOutlined } from "@ant-design/icons";
import { Progress, Typography } from "antd";
import { tokens } from "@/theme";
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from "../constants";
import { getPasswordStrength, type StrengthScore } from "../lib/password-strength";
import { isPasswordTooLong, meetsPasswordRule } from "../lib/password-rule";
import styles from "./password-checklist.module.css";

const MIN_RULE = `At least ${MIN_PASSWORD_LENGTH} characters`;
const MAX_RULE = `At most ${MAX_PASSWORD_BYTES} characters`;

function meterColor(score: StrengthScore) {
  if (score <= 1) return tokens.danger;
  if (score === 2) return tokens.warning;
  return tokens.interactive;
}

interface PasswordChecklistProps {
  password: string;
  /** After the first submit, an unmet rule turns red. */
  submitted: boolean;
}

/** Strength meter and the length rule, shown under the password field. */
export function PasswordChecklist({ password, submitted }: PasswordChecklistProps) {
  const { score, label } = getPasswordStrength(password);
  const meetsRule = meetsPasswordRule(password);
  // Only a password that is too long shows the maximum; otherwise the minimum is the rule to meet.
  const tooLong = isPasswordTooLong(password);
  const rule = tooLong ? MAX_RULE : MIN_RULE;

  return (
    <div className={styles.checklist}>
      {/* The meter repeats the rule below, so screen readers skip it. */}
      <div className={styles.meter} aria-hidden="true">
        <Progress
          percent={score * 25}
          steps={4}
          size={[48, 4]}
          showInfo={false}
          strokeColor={meterColor(score)}
          railColor={tokens.borderSubtle}
        />
        {label && (
          <Typography.Text type="secondary" className={styles.meterLabel}>
            {label}
          </Typography.Text>
        )}
      </div>

      <div className={styles.rule}>
        {meetsRule ? (
          <Typography.Text type="success">
            <CheckCircleFilled aria-hidden="true" /> {rule}
          </Typography.Text>
        ) : submitted || tooLong ? (
          <Typography.Text type="danger">
            <CloseCircleFilled aria-hidden="true" /> {rule}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">
            <InfoCircleOutlined aria-hidden="true" /> {rule}
          </Typography.Text>
        )}
      </div>
    </div>
  );
}
