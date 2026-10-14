import type { MouseEventHandler, ReactNode } from "react";

interface KeycapButtonProps {
  children: ReactNode;
  href: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}

export function KeycapButton({
  children,
  href,
  className = "",
  onClick,
}: KeycapButtonProps) {
  return (
    <a
      className={`keycap ${className}`}
      href={href}
      onClick={onClick}
    >
      <span className="keycap__face" aria-hidden="true" />
      <span className="keycap__label">{children}</span>
    </a>
  );
}
