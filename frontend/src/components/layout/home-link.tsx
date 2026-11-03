import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/logo";

/** The logo, linking to the Videos page. */
export function HomeLink({ logoHeight, className }: { logoHeight?: number; className?: string }) {
  return (
    <Link to="/" aria-label="Vdio Touch, go to Videos" className={className}>
      <Logo height={logoHeight} />
    </Link>
  );
}
