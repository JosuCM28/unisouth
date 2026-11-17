"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormSelectField } from "@/components/shared/form-field";
import { SearchInput } from "@/components/shared/search-input";
import { SearchSelect } from "@/components/shared/search-select";
import { Label } from "@/components/ui/label";

export interface FinishedFilterOptions {
  categories: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  pos: string[];
  sizes: { id: string; code: string }[];
}

/**
 * Filtros del inventario terminado. Viven en la URL: sobreviven a recargar,
 * y "TAMSA, PO 4565" se puede mandar por WhatsApp a quien va a empacar.
 *
 * Cada uno lleva su etiqueta arriba y no sólo el placeholder: en cuanto se
 * elige un valor el placeholder desaparece y ya no se sabe qué filtra cada
 * caja ("4565" ¿es PO o talla?).
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="finished-search">Buscar</Label>
        <SearchInput id="finished-search" placeholder="Producto, código o PO…" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <FormSelectField id="finished-category" label="Tipo de prenda">
          <SearchSelect
            id="finished-category"
            options={options.categories.map((c) => ({ value: c.id, label: c.name }))}
            value={searchParams.get("tipo") ?? ""}
            onChange={(value) => setParam("tipo", value)}
            clearLabel="Todos los tipos"
            placeholder="Todos los tipos"
          />
        </FormSelectField>
        {/* Dentro de la caja de un pedido con cliente el dueño ya está fijo y no se ofrece. */}
        {options.clients.length > 0 && (
          <FormSelectField id="finished-client" label="Cliente">
            <SearchSelect
              id="finished-client"
              options={options.clients.map((c) => ({ value: c.id, label: c.name }))}
              value={searchParams.get("cliente") ?? ""}
              onChange={(value) => setParam("cliente", value)}
              clearLabel="Todos los clientes"
              placeholder="Todos los clientes"
            />
          </FormSelectField>
        )}
        <FormSelectField id="finished-po" label="PO">
          <SearchSelect
            id="finished-po"
            options={options.pos.map((po) => ({ value: po, label: po }))}
            value={searchParams.get("po") ?? ""}
            onChange={(value) => setParam("po", value)}
            clearLabel="Todas las PO"
            placeholder="Todas las PO"
          />
        </FormSelectField>
        <FormSelectField id="finished-size" label="Talla">
          <SearchSelect
            id="finished-size"
            options={options.sizes.map((s) => ({ value: s.id, label: s.code }))}
            value={searchParams.get("talla") ?? ""}
            onChange={(value) => setParam("talla", value)}
            clearLabel="Todas las tallas"
            placeholder="Todas las tallas"
          />
        </FormSelectField>
      </div>
    </div>
  );
}
