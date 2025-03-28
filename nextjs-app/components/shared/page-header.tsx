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
    <div className={cn("space-y-2", className)}>
      <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
      {description && (
        <p className="text-muted-foreground text-lg">{description}</p>
      )}
      {children}
    </div>
  );
} 