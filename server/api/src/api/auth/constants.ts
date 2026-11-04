export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt ignores everything after 72 bytes, so longer passwords are refused instead of silently cut. */
export const PASSWORD_MAX_BYTES = 72;
export const BCRYPT_COST = 12;

export const JWT_ALGORITHM = 'HS256';

/** Log in and sign up attempts allowed per window, counted per client IP and per email. */
export const AUTH_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const AUTH_RATE_LIMIT_PER_IP = 20;
export const AUTH_RATE_LIMIT_PER_EMAIL = 5;
