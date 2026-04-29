import { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rounded?: "none" | "sm" | "md" | "lg" | "full";
}

const roundedStyles: Record<string, string> = {
  none: "",
  sm: "rounded-md",
  md: "rounded-[var(--radius-button,14px)]",
  lg: "rounded-cf-card",
  full: "rounded-full",
};

export function Skeleton({
  rounded = "md",
  className = "",
  ...props
}: SkeletonProps) {
  return (
    <div
      className={`bg-white/[0.05] animate-pulse ${roundedStyles[rounded]} ${className}`}
      {...props}
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Skeleton className="h-28" rounded="lg" />
        <Skeleton className="h-28" rounded="lg" />
        <Skeleton className="h-28" rounded="lg" />
        <Skeleton className="h-28" rounded="lg" />
      </div>
      <Skeleton className="h-64 mt-2" rounded="lg" />
    </div>
  );
}
