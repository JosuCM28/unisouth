import { Skeleton } from "@/components/ui/skeleton";

/** Mismo grid que KpiGrid para que al llegar los datos nada salte de sitio. */
export function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flat-surface p-4 pl-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-12" />
          <Skeleton className="mt-2 h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
