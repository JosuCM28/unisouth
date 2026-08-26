"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchSelect } from "@/components/shared/search-select";

export interface RuleClientFilterOption {
  id: string;
  name: string;
  /** Cuántas reglas vigentes tiene. Se muestra para no entrar a listas vacías. */
  count: number;
}

interface Props {
  clients: RuleClientFilterOption[];
  /** Reglas de la casa, las que aplican a todas las empresas. */
  houseCount: number;
}

/** Valor del filtro para "sólo las reglas de la casa". */
export const HOUSE_FILTER = "__house__";

/**
 * Filtro por empresa.
 *
 * Va en la URL y no en estado local para que la lista siga siendo Server
 * Component y para que "las reglas de Ternium" se pueda dejar abierto en el
 * celular y sobreviva a que se caiga el WiFi y se recargue.
 */
export function RuleClientFilter({ clients, houseCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = searchParams.get("client") ?? "";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set("client", value);
    } else {
      params.delete("client");
    }

    router.replace(`${pathname}?${params.toString()}`);
  }

  const options = [
    {
      value: HOUSE_FILTER,
      label: "Reglas de la casa",
      hint: describeCount(houseCount),
    },
    ...clients.map((client) => ({
      value: client.id,
      label: client.name,
      hint: describeCount(client.count),
    })),
  ];

  return (
    <SearchSelect
      options={options}
      value={current}
      onChange={handleChange}
      placeholder="Todas las reglas"
      searchPlaceholder="Buscar empresa…"
      clearLabel="Todas las reglas"
    />
  );
}

function describeCount(count: number): string {
  if (count === 0) return "sin reglas";
  return count === 1 ? "1 regla" : `${count} reglas`;
}
