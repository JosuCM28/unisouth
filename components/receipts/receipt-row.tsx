"use client";

import { memo, type RefObject } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Unit } from "@prisma/client";
import type { MaterialOption } from "@/lib/repositories/material.repository";
import {
  UNIT_LABELS,
  UNIT_SHORT_LABELS,
  unitSelectGroups,
} from "@/lib/constants/labels";
import { cn } from "@/lib/utils";
import { FormField, FormSelectField } from "@/components/shared/form-field";
import {
  SearchSelect,
  type SearchSelectOption,
} from "@/components/shared/search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* Se arma una sola vez para todo el módulo: son 14 unidades fijas y hay un
   selector por renglón. Rearmarlas en cada tecla capturada, con veinte
   rollos en pantalla, se siente en un celular de bodega. */
const UNIT_GROUPS = unitSelectGroups();

export interface LotRow {
  materialId: string;
  quantity: string;
  unit: Unit | "";
  locationId: string;
  /** De qué cliente es esta tela. Va por rollo: una guía puede traer tela de
   *  dos clientes y jamás se surte la de uno a la producción de otro. */
  clientId: string;
  /** Quién bajó este rollo. Va por rollo: dos ayudantes pueden repartirse
   *  un mismo camión y cada uno cobra lo suyo. */
  helperId: string;
  shade: string;
  supplierLotNumber: string;
}

interface ReceiptRowProps {
  index: number;
  row: LotRow;
  /** El material ya resuelto: buscarlo aquí en 200 por renglón y por render
   *  es justo el trabajo que se quiere quitar. */
  material: MaterialOption | undefined;
  isLast: boolean;
  canRemove: boolean;
  /** Sólo lo recibe el último renglón: "Duplicar" enfoca su metraje. */
  quantityRef?: RefObject<HTMLInputElement | null>;
  materialOptions: SearchSelectOption[];
  clientOptions: SearchSelectOption[];
  locationOptions: SearchSelectOption[];
  helperOptions: SearchSelectOption[];
  onChange: (index: number, patch: Partial<LotRow>) => void;
  onSelectMaterial: (index: number, materialId: string) => void;
  onRemove: (index: number, isBlank: boolean) => void;
  onEnter: (index: number, isLast: boolean) => void;
  onNewMaterial: (index: number) => void;
  onNewHelper: (index: number) => void;
}

/**
 * Un rollo de la recepción.
 *
 * Va memorizado y con callbacks que reciben el índice —en vez de cierres
 * armados por renglón— por una razón medida en el piso: con 80 rollos en
 * pantalla, cada tecla del metraje volvía a pintar los 80 y el celular se
 * atrasaba. Así, teclear en un renglón sólo repinta ese renglón.
 *
 * Todo lo que llega por props tiene que ser estable desde el wizard
 * (`useMemo` / `useCallback`); un objeto nuevo por render anula el `memo`.
 */
export const ReceiptRow = memo(function ReceiptRow({
  index,
  row,
  material,
  isLast,
  canRemove,
  quantityRef,
  materialOptions,
  clientOptions,
  locationOptions,
  helperOptions,
  onChange,
  onSelectMaterial,
  onRemove,
  onEnter,
  onNewMaterial,
  onNewHelper,
}: ReceiptRowProps) {
  const isBlank = !row.materialId && !row.quantity;

  return (
    <div className="flat-surface flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="tabular text-xs text-muted-foreground">
          Rollo {index + 1}
        </span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="touch-target"
            aria-label={`Quitar rollo ${index + 1}`}
            onClick={() => onRemove(index, isBlank)}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        )}
      </div>

      <FormSelectField id={`material-row-${index}`} label="Material">
        <div className="flex gap-2">
          {/* Buscador Y desplegable: con 200 materiales en el catálogo,
              recorrer la lista con el dedo es más lento que teclear tres
              letras. Se busca también por código y por color, que es lo que
              trae impreso la etiqueta del rollo cuando el nombre no se lee. */}
          <SearchSelect
            id={`material-row-${index}`}
            className="min-w-0 flex-1"
            options={materialOptions}
            value={row.materialId}
            onChange={(value) => onSelectMaterial(index, value)}
            placeholder="Elige el material"
            searchPlaceholder="Buscar por nombre, código o color…"
            emptyMessage="Ningún material coincide."
          />

          {/* Llega un material que nadie dio de alta: se registra aquí mismo
              y queda seleccionado, sin perder la captura de los rollos
              anteriores. El diálogo vive UNO en el wizard, no uno por
              renglón: 80 formularios montados sin abrir pesaban. */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="touch-target shrink-0"
            aria-label="Registrar material nuevo"
            title="Registrar material nuevo"
            onClick={() => onNewMaterial(index)}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>

        {/* Ficha rápida del material elegido: el auxiliar tiene el rollo en
            la mano y necesita confirmar que la etiqueta coincide con lo que
            acaba de escoger de la lista. */}
        <MaterialPreview material={material} />
      </FormSelectField>

      {/* De quién es ESTA tela. Va por rollo y no en el encabezado porque una
          guía puede traer tela de dos clientes, y va arriba —junto al
          material, no perdido al final— porque surtir la tela del cliente
          equivocado es el error caro. "Duplicar" lo arrastra como al resto
          del renglón. */}
      <FormSelectField id={`client-row-${index}`} label="Cliente dueño">
        <SearchSelect
          id={`client-row-${index}`}
          options={clientOptions}
          value={row.clientId}
          onChange={(value) => onChange(index, { clientId: value })}
          placeholder="De la fábrica"
          searchPlaceholder="Buscar cliente…"
          clearLabel="De la fábrica"
        />
      </FormSelectField>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`quantity-row-${index}`}>Cantidad</Label>
          <Input
            id={`quantity-row-${index}`}
            ref={quantityRef}
            inputMode="decimal"
            placeholder="0"
            className="touch-target tabular text-lg"
            value={row.quantity}
            onChange={(event) =>
              onChange(index, { quantity: event.target.value })
            }
            onKeyDown={(event) => {
              // Enter avanza al siguiente renglón, como en una hoja de cálculo.
              if (event.key !== "Enter") return;
              event.preventDefault();
              onEnter(index, isLast);
            }}
          />
        </div>

        {/* La unidad se elige, no se impone. La tela viene en metros casi
            siempre, pero cuando el proveedor sólo pesó el rollo la nota trae
            kilos y hay que poder capturarla tal cual, sin inventar una
            conversión. */}
        <UnitPicker
          index={index}
          value={row.unit}
          onChange={(unit) => onChange(index, { unit })}
        />
      </div>

      {/* Aviso, no bloqueo: quien recibe tiene el rollo en la mano y sabe si
          de verdad viene en kilos. Sólo se le recuerda en qué unidad está
          dado de alta el material, por si el dedo resbaló en el selector. */}
      <UnitMismatchNotice unit={row.unit} material={material} />

      <FormField
        id={`shade-row-${index}`}
        label="Tono"
        placeholder="A-42"
        className="tabular"
        value={row.shade}
        onChange={(event) => onChange(index, { shade: event.target.value })}
      />

      <div className="grid grid-cols-2 gap-3">
        <FormSelectField id={`location-row-${index}`} label="Ubicación">
          <SearchSelect
            id={`location-row-${index}`}
            options={locationOptions}
            value={row.locationId}
            onChange={(value) => onChange(index, { locationId: value })}
            placeholder="Sin asignar"
            searchPlaceholder="Buscar ubicación…"
            clearLabel="Sin asignar"
          />
        </FormSelectField>

        <FormField
          id={`supplierLot-row-${index}`}
          label="Lote proveedor"
          className="tabular"
          value={row.supplierLotNumber}
          onChange={(event) =>
            onChange(index, { supplierLotNumber: event.target.value })
          }
        />
      </div>

      {/* Quién bajó ESTE rollo: es lo que sostiene su bonificación. */}
      <FormSelectField id={`helper-row-${index}`} label="Ayudante que lo bajó">
        <div className="flex gap-2">
          <SearchSelect
            id={`helper-row-${index}`}
            className="min-w-0 flex-1"
            options={helperOptions}
            value={row.helperId}
            onChange={(value) => onChange(index, { helperId: value })}
            placeholder="Sin asignar"
            searchPlaceholder="Buscar ayudante…"
            clearLabel="Sin asignar"
          />

          {/* Llega un ayudante nuevo con el camión: se registra sin salir de
              la captura. */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="touch-target shrink-0"
            aria-label="Registrar ayudante nuevo"
            title="Registrar ayudante nuevo"
            onClick={() => onNewHelper(index)}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
      </FormSelectField>
    </div>
  );
});

/**
 * Selector de unidad del renglón.
 *
 * Angosto a propósito: comparte fila con la cantidad, que es el campo que
 * de verdad se teclea. Las unidades de diario van arriba y separadas del
 * resto del catálogo para no obligar a desplazar por el metro y el kilo.
 */
function UnitPicker({
  index,
  value,
  onChange,
}: {
  index: number;
  value: Unit | "";
  onChange: (unit: Unit) => void;
}) {
  return (
    <FormSelectField id={`unit-row-${index}`} label="Unidad">
      <Select value={value} onValueChange={(next) => onChange(next as Unit)}>
        <SelectTrigger id={`unit-row-${index}`} className="touch-target w-28">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {UNIT_GROUPS.common.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>

          <SelectSeparator />

          <SelectGroup>
            <SelectLabel>Otras unidades</SelectLabel>
            {UNIT_GROUPS.rest.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FormSelectField>
  );
}

/**
 * Avisa cuando el rollo se captura en una unidad distinta a la del material.
 *
 * No estorba el flujo: recibir en kilos algo dado de alta en metros es un
 * caso REAL y frecuente. Pero también es lo que se ve cuando alguien se
 * equivocó de renglón en el selector, y ese error llega hasta el kárdex.
 */
function UnitMismatchNotice({
  unit,
  material,
}: {
  unit: Unit | "";
  material: MaterialOption | undefined;
}) {
  if (!unit || !material || unit === material.baseUnit) return null;

  return (
    <p className="text-xs text-state-reserved">
      Este material se maneja en {UNIT_LABELS[material.baseUnit].toLowerCase()}{" "}
      ({UNIT_SHORT_LABELS[material.baseUnit]}). Se guardará en{" "}
      {UNIT_SHORT_LABELS[unit]} tal como llegó.
    </p>
  );
}

/**
 * Ficha rápida del material seleccionado.
 *
 * No repite el nombre —ya se lee en el select de arriba— sino lo que el
 * auxiliar necesita cotejar contra la etiqueta física: de qué está hecha la
 * tela y de qué color. Si el material no trae esos datos capturados, se dice
 * explícitamente en vez de mostrar un hueco: "sin composición registrada" es
 * información, un espacio en blanco no.
 *
 * El dueño NO está aquí: es un dato del rollo —se elige abajo y cambia de un
 * renglón a otro—, no del material del catálogo.
 */
function MaterialPreview({
  material,
}: {
  material: MaterialOption | undefined;
}) {
  if (!material) return null;

  return (
    <dl className="mt-2 flex flex-col gap-1 border border-border bg-muted/40 p-2.5 text-xs">
      <PreviewRow label="Color" value={material.colorName} />
      <PreviewRow label="Composición" value={material.composition} />
      <PreviewRow label="Código" value={material.code} tabular />

      {/* Sólo si aplica: en telas que lo exigen, capturar el tono no es
          opcional; dos partidas distintas en un tendido salen con franjas. */}
      {material.requiresShade && (
        <p className="mt-1 border-t border-border pt-1 text-state-reserved">
          Este material exige registrar el tono.
        </p>
      )}
    </dl>
  );
}

function PreviewRow({
  label,
  value,
  tabular,
}: {
  label: string;
  value: string | null;
  tabular?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      {/* break-words y NO truncate: la composición es justo el dato que se
          coteja contra la etiqueta del rollo, y cortarla con "…" en celular
          la vuelve inútil. Mejor que ocupe dos renglones. */}
      <dd
        className={cn(
          "min-w-0 break-words text-right",
          tabular && "tabular",
          !value && "text-muted-foreground",
        )}
      >
        {value || "Sin registrar"}
      </dd>
    </div>
  );
}
