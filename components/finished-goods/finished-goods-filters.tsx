"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/shared/search-input";
import { SearchSelect } from "@/components/shared/search-select";

export interface FinishedFilterOptions {
  categories: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  pos: string[];
  sizes: { id: string; code: string }[];
}

/**
 * Filtros del inventario terminado. Viven en la URL: sobreviven a recargar,
 * y "TAMSA, PO 4565" se puede mandar por WhatsApp a quien va a empacar.
 */
export function FinishedGoodsFilters({ options }: { options: FinishedFilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-2">
      <SearchInput placeholder="Producto, código o PO…" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <SearchSelect
          options={options.categories.map((c) => ({ value: c.id, label: c.name }))}
          value={searchParams.get("tipo") ?? ""}
          onChange={(value) => setParam("tipo", value)}
          clearLabel="Todos los tipos"
          placeholder="Tipo de prenda"
        />
        {/* Dentro de la caja de un pedido el dueño ya está fijo y no se ofrece. */}
        {options.clients.length > 0 && (
          <SearchSelect
            options={options.clients.map((c) => ({ value: c.id, label: c.name }))}
            value={searchParams.get("cliente") ?? ""}
            onChange={(value) => setParam("cliente", value)}
            clearLabel="Todos los clientes"
            placeholder="Cliente"
          />
        )}
        <SearchSelect
          options={options.pos.map((po) => ({ value: po, label: po }))}
          value={searchParams.get("po") ?? ""}
          onChange={(value) => setParam("po", value)}
          clearLabel="Todas las PO"
          placeholder="PO"
        />
        <SearchSelect
          options={options.sizes.map((s) => ({ value: s.id, label: s.code }))}
          value={searchParams.get("talla") ?? ""}
          onChange={(value) => setParam("talla", value)}
          clearLabel="Todas las tallas"
          placeholder="Talla"
        />
      </div>
    </div>
  );
}
