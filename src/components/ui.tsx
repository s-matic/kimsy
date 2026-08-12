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
    primary: "border-[#0f766e] bg-[#0f766e] text-white hover:bg-[#0b625c]",
    secondary: "border-[#cdd6d2] bg-white text-[#24302c] hover:bg-[#f3f6f5]",
    ghost: "border-transparent bg-transparent text-[#44524d] hover:bg-[#edf1ef]",
    danger: "border-[#b42318] bg-[#b42318] text-white hover:bg-[#8f1c14]",
  };
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-3.5 text-sm",
    icon: "h-9 w-9 p-0",
  };
  return (
    <button
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-[5px] border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
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
    neutral: "border-[#d6ddda] bg-[#f4f6f5] text-[#52605b]",
    success: "border-[#b9decf] bg-[#eaf7f1] text-[#176b4b]",
    warning: "border-[#ead5a5] bg-[#fff7df] text-[#805b12]",
    danger: "border-[#f1bbb5] bg-[#fff0ee] text-[#a42c21]",
    critical: "border-[#dfaaa5] bg-[#8f1c14] text-white",
    info: "border-[#b6d7e2] bg-[#edf8fb] text-[#1b637b]",
  };
  return (
    <span className={`inline-flex min-h-6 items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-semibold leading-4 ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="flex min-w-[112px] items-center gap-2">
      <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-[#e3e8e6]">
        <div className="h-full rounded-full bg-[#0f766e]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
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
    <header className="flex flex-col gap-4 border-b border-[#dce2df] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase text-[#0f766e]">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold text-[#16201d]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-[#65726d]">{description}</p>}
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
  return <section className={`rounded-[6px] border border-[#dce2df] bg-white ${className}`}>{children}</section>;
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
    <div className="flex min-h-14 items-start justify-between gap-4 border-b border-[#e2e7e5] px-4 py-3.5 sm:px-5">
      <div>
        <h2 className="text-sm font-semibold text-[#1b2622]">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-5 text-[#71807a]">{description}</p>}
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
