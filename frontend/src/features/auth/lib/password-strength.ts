import { MIN_PASSWORD_LENGTH } from "../constants";

/** 0 = empty, 1 = too short, 2 = weak, 3 = good, 4 = strong. */
export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  score: StrengthScore;
  label: string;
}

const LABELS: Record<StrengthScore, string> = {
  0: "",
  1: "Too short",
  2: "Weak",
  3: "Good",
  4: "Strong",
};

/**
 * A rough guide for the meter only. The server enforces just the length
 * rule, so anything from score 2 up is accepted.
 */
export function getPasswordStrength(password: string): PasswordStrength {
  let score: StrengthScore;
  if (!password) score = 0;
  else if (password.length < MIN_PASSWORD_LENGTH) score = 1;
  else {
    const isLong = password.length >= 10;
    const mixesLettersAndOthers = /[a-zA-Z]/.test(password) && /[\d\W_]/.test(password);
    score = (2 + Number(isLong) + Number(mixesLettersAndOthers)) as StrengthScore;
  }
  return { score, label: LABELS[score] };
}
