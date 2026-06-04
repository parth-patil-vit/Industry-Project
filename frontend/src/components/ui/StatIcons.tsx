import type { ReactNode } from "react";

type IconProps = { className?: string; size?: number };

function SvgIcon({
  className,
  size = 18,
  children,
}: {
  className?: string;
  size?: number;
  children: ReactNode;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      style={{ display: "block", flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

export function IconCalendar({ className, size = 18 }: IconProps) {
  return (
    <SvgIcon className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </SvgIcon>
  );
}

export function IconClock({ className, size = 18 }: IconProps) {
  return (
    <SvgIcon className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </SvgIcon>
  );
}

export function IconCheckCircle({ className, size = 18 }: IconProps) {
  return (
    <SvgIcon className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </SvgIcon>
  );
}

export function IconAlertCircle({ className, size = 18 }: IconProps) {
  return (
    <SvgIcon className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </SvgIcon>
  );
}

export function IconBell({ className, size = 16 }: IconProps) {
  return (
    <SvgIcon className={className} size={size}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </SvgIcon>
  );
}

export function IconBarChart({ className, size = 16 }: IconProps) {
  return (
    <SvgIcon className={className} size={size}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0h6m2 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </SvgIcon>
  );
}
