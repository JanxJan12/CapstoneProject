import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/utils";

export interface LoadingSkeletonProps extends ComponentProps<typeof Skeleton> {
  label?: string;
}

export function LoadingSkeleton({
  label,
  className,
  ...props
}: LoadingSkeletonProps) {
  return (
    <Skeleton
      className={cn("cashier-loading-skeleton", className)}
      role={label ? "status" : undefined}
      aria-label={label}
      {...props}
    />
  );
}
