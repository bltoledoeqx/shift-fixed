import { cn } from "@/lib/utils";

interface ShiftBadgeProps {
  type: 'morning' | 'afternoon' | 'night' | 'oncall';
  label: string;
  className?: string;
}

export function ShiftBadge({ type, label, className }: ShiftBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        type === 'morning' && 'shift-badge-morning',
        type === 'afternoon' && 'shift-badge-afternoon',
        type === 'night' && 'shift-badge-night',
        type === 'oncall' && 'shift-badge-oncall',
        className
      )}
    >
      {label}
    </span>
  );
}
