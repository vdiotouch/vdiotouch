import { Card, Switch, Typography } from "antd";
import styles from "./import-video-dialog.module.css";

interface ProcessingOptionProps {
  id: string;
  title: string;
  description: string;
  /** Injected by Form.Item (valuePropName="checked"). */
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

/** A labelled switch in a small card, for one encoding option. */
export function ProcessingOption({ id, title, description, checked, onChange }: ProcessingOptionProps) {
  return (
    <Card size="small">
      <div className={styles.option}>
        <Switch
          checked={checked}
          onChange={onChange}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-description`}
        />
        <div>
          <Typography.Text strong id={`${id}-label`}>
            {title}
          </Typography.Text>
          <Typography.Text type="secondary" id={`${id}-description`} className={styles.optionDescription}>
            {description}
          </Typography.Text>
        </div>
      </div>
    </Card>
  );
}
