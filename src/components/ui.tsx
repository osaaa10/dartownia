import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/util";

type Variant = "primary" | "accent" | "outline" | "ghost" | "danger";

export function Button({
  variant = "outline",
  size = "md",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" | "icon" }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-lg font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-sm",
        size === "lg" && "h-14 px-5 text-base",
        size === "icon" && "h-10 w-10",
        variant === "primary" && "bg-primary text-white shadow-lg shadow-primary/20 hover:brightness-110",
        variant === "accent" && "bg-accent text-accentfg shadow-lg shadow-accent/25 hover:brightness-110",
        variant === "outline" && "border border-line bg-surface2 text-fg hover:border-primary/60",
        variant === "ghost" && "text-fg hover:bg-surface2",
        variant === "danger" && "bg-danger text-white hover:brightness-110",
        className,
      )}
    />
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  side = false,
  dismissable = true,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** true = panel z prawej (ustawienia, historia). */
  side?: boolean;
  dismissable?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, dismissable, onClose]);

  if (!open) return null;
  return (
    <div
      className={cn("fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm", side ? "justify-end" : "items-center justify-center p-4")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissable) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cn(
          "flex max-h-full flex-col border border-line bg-surface text-fg shadow-2xl outline-none",
          side ? "safe-area h-full w-full max-w-md" : "w-full max-w-md rounded-2xl",
          className,
        )}
      >
        {(title || dismissable) && (
          <div className="flex items-center justify-between gap-3 px-5 pt-4">
            <h2 className="font-score text-2xl tracking-wide">{title}</h2>
            {dismissable && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-2 text-muted hover:bg-surface2 hover:text-fg"
                aria-label="Zamknij"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto px-5 pb-5 pt-3">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Tak",
  cancelLabel = "Anuluj",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      {message && <div className="text-sm text-muted">{message}</div>}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button variant={danger ? "danger" : "accent"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full border transition",
        checked ? "border-primary bg-primary" : "border-line bg-surface3",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
          checked ? "left-[1.45rem]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function Row({ label, desc, children }: { label: string; desc?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-line/60 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs text-muted">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  cols,
}: {
  value: T;
  options: { value: T; label: ReactNode; desc?: string }[];
  onChange: (v: T) => void;
  cols?: number;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-left transition",
            value === o.value
              ? "border-primary bg-primary/15 shadow-[0_0_0_1px_rgb(var(--primary))]"
              : "border-line bg-surface hover:border-primary/50",
          )}
        >
          <div className="text-sm font-semibold">{o.label}</div>
          {o.desc && <div className="text-[11px] text-muted">{o.desc}</div>}
        </button>
      ))}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-muted">{children}</div>;
}

export function Toast({ message, tone }: { message: string; tone: "info" | "good" | "bad" }) {
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-none fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-xl",
        tone === "bad" && "bg-danger text-white",
        tone === "good" && "bg-accent text-accentfg",
        tone === "info" && "bg-surface3 text-fg",
      )}
    >
      {message}
    </div>
  );
}
