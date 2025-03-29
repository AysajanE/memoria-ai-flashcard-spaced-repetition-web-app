import { cn } from "@/lib/utils";

interface PageHeaderProps {
  heading: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  heading,
  description,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-8", className)}>
      <h1 className="text-3xl font-bold tracking-tight mb-3">{heading}</h1>
      {description && (
        <p className="text-muted-foreground text-lg max-w-3xl">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
} 