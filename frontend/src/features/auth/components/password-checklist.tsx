import { CheckCircleFilled, CloseCircleFilled, InfoCircleOutlined } from "@ant-design/icons";
import { Progress, Typography } from "antd";
import { tokens } from "@/theme";
import { MIN_PASSWORD_LENGTH } from "../constants";
import { getPasswordStrength, type StrengthScore } from "../lib/password-strength";
import styles from "./password-checklist.module.css";

const RULE = `At least ${MIN_PASSWORD_LENGTH} characters`;

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

/** Strength meter and the minimum-length rule, shown under the password field. */
export function PasswordChecklist({ password, submitted }: PasswordChecklistProps) {
  const { score, label } = getPasswordStrength(password);
  const meetsRule = password.length >= MIN_PASSWORD_LENGTH;

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
            <CheckCircleFilled aria-hidden="true" /> {RULE}
          </Typography.Text>
        ) : submitted ? (
          <Typography.Text type="danger">
            <CloseCircleFilled aria-hidden="true" /> {RULE}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">
            <InfoCircleOutlined aria-hidden="true" /> {RULE}
          </Typography.Text>
        )}
      </div>
    </div>
  );
}
