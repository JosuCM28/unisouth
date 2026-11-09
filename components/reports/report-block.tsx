import { Skeleton } from "@/components/ui/skeleton";

/** Una cifra suelta de la parte de arriba del reporte. */
export function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flat-surface p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Una sección del reporte, con su título y qué pregunta responde. */
export function Block({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flat-surface p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p>
      {children}
    </section>
  );
}

export function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
