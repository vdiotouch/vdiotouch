/** Width / height of public/logo.svg. */
const LOGO_ASPECT_RATIO = 172 / 47;

interface LogoProps {
  /** Rendered height in px; the width follows the logo's aspect ratio. */
  height?: number;
}

export function Logo({ height = 36 }: LogoProps) {
  return (
    <img
      src="/logo.svg"
      alt="Vdio Touch"
      width={Math.round(height * LOGO_ASPECT_RATIO)}
      height={height}
      style={{ display: "block" }}
    />
  );
}
