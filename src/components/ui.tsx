import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
  loading?: boolean;
}) {
  const variants = {
    primary: "border-[#25262f] bg-[#25262f] text-white shadow-sm hover:border-[#3b3d49] hover:bg-[#3b3d49]",
    secondary: "border-[#dedfe5] bg-white text-[#2d2f3a] shadow-sm hover:bg-[#f7f7f9]",
    ghost: "border-transparent bg-transparent text-[#555866] hover:bg-[#eeeef2]",
    danger: "border-[#b42318] bg-[#b42318] text-white shadow-sm hover:bg-[#8f1c14]",
  };
  const sizes = {
    sm: "h-8 px-3.5 text-xs",
    md: "h-10 px-4 text-sm",
    icon: "h-10 w-10 p-0",
  };
  return (
    <button
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] border font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "critical" | "info";
}) {
  const tones = {
    neutral: "border-[#dedfe5] bg-[#f5f5f7] text-[#5c5f6d]",
    success: "border-[#b9decf] bg-[#eaf7f1] text-[#176b4b]",
    warning: "border-[#ead5a5] bg-[#fff7df] text-[#805b12]",
    danger: "border-[#f1bbb5] bg-[#fff0ee] text-[#a42c21]",
    critical: "border-[#dfaaa5] bg-[#8f1c14] text-white",
    info: "border-[#cdd3f4] bg-[#f1f3fd] text-[#4d5eb6]",
  };
  return (
    <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-4 ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="flex min-w-[112px] items-center gap-2">
      <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-[#e5e5ea]">
        <div className="h-full rounded-full bg-[#586ad0]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <span className="w-9 text-right text-xs font-semibold text-[#4e5c57]">{label ?? `${value}%`}</span>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 pb-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737788]">{eyebrow}</p>}
        <h1 className="font-display text-[32px] leading-tight text-[#22232c] sm:text-[38px]">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-[#747786]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`rounded-[18px] border border-[#e3e4e9] bg-white shadow-[var(--shadow-panel)] ${className}`}>{children}</section>;
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-16 items-start justify-between gap-4 border-b border-[#ededf0] px-5 py-4 sm:px-6">
      <div>
        <h2 className="text-sm font-semibold text-[#272832]">{title}</h2>
        {description && <p className="mt-1 text-xs leading-5 text-[#7a7d8c]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Metric({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <div className="min-w-0 border-r border-[#e2e7e5] px-5 py-4 last:border-r-0">
      <p className="text-xs font-medium text-[#6a7873]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone === "danger" ? "text-[#a42c21]" : tone === "success" ? "text-[#176b4b]" : "text-[#18231f]"}`}>
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-[#78857f]">{detail}</p>
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#edf2f0] text-[#53635d]">{icon}</div>
      <p className="text-sm font-semibold text-[#27332f]">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-[#74817c]">{description}</p>
    </div>
  );
}
