"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { Unit } from "@prisma/client";
import {
  createLotForIssueAction,
  type IssueLotOption,
} from "@/app/actions/issue.actions";
import { runAction } from "@/lib/offline/run-action";
import {
  UNIT_LABELS,
  UNIT_SHORT_LABELS,
  unitSelectGroups,
} from "@/lib/constants/labels";
import { FormSelectField } from "@/components/shared/form-field";
import { SearchSelect } from "@/components/shared/search-select";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* El mismo orden por uso que en la recepción y en la corrección: kg y m
   arriba, el resto alfabético. Ordenarlas distinto aquí obligaría a buscar
   con el pulgar la unidad que allá está a la vista. */
const { common, rest } = unitSelectGroups();
const UNIT_OPTIONS = [...common, ...rest];

/** Centinela del material propio: en la base es `clientId = null`. */
const FACTORY_OWNER = "__factory__";

/** Lo que el alta necesita saber del material. */
export interface NewLotMaterialOption {
  id: string;
  code: string;
  name: string;
  baseUnit: Unit;
  requiresShade: boolean;
}

export interface NewLotLocationOption {
  id: string;
  code: string;
  name: string;
}

/**
 * De quién es el rollo que se va a dar de alta.
 *
 * `null` = el vale no tiene dueño elegido y hay que preguntarlo. Con dueño,
 * el rollo nace de ESA empresa y no se ofrece cambiarlo: un rollo de otro
 * dueño no se podría surtir en este mismo vale, así que ofrecerlo sería
 * ofrecer un error.
 */
export interface NewLotOwner {
  /** Ausente = material de la propia fábrica. */
  clientId?: string;
  label: string;
}

interface Props {
  materials: NewLotMaterialOption[];
  locations: NewLotLocationOption[];
  /** Sólo se usan cuando el vale no trae dueño: ver `NewLotOwner`. */
  clients: { id: string; name: string }[];
  owner: NewLotOwner | null;
  /** El material que se estaba mirando en el selector, ya precargado. */
  defaultMaterialId?: string;
  onCreated: (lot: IssueLotOption, materialId: string) => void;
  onCancel: () => void;
}

/**
 * Alta de rollo sin salirse del vale.
 *
 * El caso es el de todos los días: llega tela y se va derecho a producción
 * sin pasar por el rack. Hasta ahora eso obligaba a abandonar el vale a
 * medias, ir a Inventario, dar de alta el rollo y volver a armarlo todo; y
 * como eso cuesta, lo que pasaba de verdad es que la salida se anotaba en la
 * libreta.
 *
 * Se piden CINCO campos y no la ficha completa: material, cantidad y unidad
 * porque sin eso no hay rollo, y tono y ubicación porque son los dos que sí
 * se saben con el rollo en la mano. Lo demás se completa después desde la
 * ficha, que es donde hay tiempo.
 *
 * Es el MISMO alta de siempre —folio, RECEIPT_INITIAL y auditoría—, no un
 * atajo que escriba un saldo por su cuenta.
 */
export function IssueLotCreate({
  materials,
  locations,
  clients,
  owner,
  defaultMaterialId,
  onCreated,
  onCancel,
}: Props) {
  const [materialId, setMaterialId] = useState(defaultMaterialId ?? "");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<string>(
    () =>
      materials.find((item) => item.id === defaultMaterialId)?.baseUnit ?? "",
  );
  const [shade, setShade] = useState("");
  const [locationId, setLocationId] = useState("");
  const [clientId, setClientId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const material = materials.find((item) => item.id === materialId);

  /**
   * Al elegir material se propone su unidad base.
   *
   * Es un toque menos y, sobre todo, evita el error de dar de alta metros de
   * tela como si fueran piezas. Se puede pisar: recibir en kilos algo que se
   * maneja en metros pasa seguido.
   */
  function handleMaterialChange(value: string) {
    setMaterialId(value);

    const chosen = materials.find((item) => item.id === value);
    if (chosen) setUnit(chosen.baseUnit);
  }

  async function handleSave() {
    if (!materialId) {
      toast.error("Elige el material.");
      return;
    }

    // Coma decimal: es como se escribe en México y el teclado del celular la
    // ofrece antes que el punto.
    const amount = Number(quantity.replace(",", "."));

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Escribe cuánto trae el rollo.");
      return;
    }

    if (!unit) {
      toast.error("Elige la unidad.");
      return;
    }

    setIsSaving(true);

    /* `runAction` y NO `submitOrQueue`, que es lo que usa el alta de
       Inventario. Encolar sirve cuando basta con que el registro llegue algún
       día; aquí hacen falta el folio y el id AHORA, porque el rollo se va a
       poner como renglón de este vale, y sin conexión no se puede inventar
       ninguno de los dos: el correlativo es atómico y lo asigna el servidor. */
    const result = await runAction(() =>
      createLotForIssueAction({
        materialId,
        quantity: amount,
        unit,
        shade: shade.trim() || undefined,
        locationId: locationId || undefined,
        clientId: resolveOwner(owner, clientId),
      }),
    );

    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    onCreated(result.data, materialId);
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onCancel}
        className="touch-target flex w-fit items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver a los rollos
      </button>

      <FormSelectField
        id="new-lot-material"
        label="Material"
        hint="Se ofrece el catálogo completo, tenga rollos en bodega o no."
      >
        <SearchSelect
          id="new-lot-material"
          options={materials.map((item) => ({
            value: item.id,
            label: item.name,
            hint: item.code,
            keywords: item.code,
          }))}
          value={materialId}
          onChange={handleMaterialChange}
          placeholder="Elige el material"
          searchPlaceholder="Buscar por código o nombre…"
        />
      </FormSelectField>

      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="new-lot-quantity">Cantidad</Label>
          <Input
            id="new-lot-quantity"
            // Metros con decimales: el teclado numérico puro no trae punto.
            inputMode="decimal"
            placeholder="0"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="touch-target tabular text-lg"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="new-lot-unit">Unidad</Label>
          <SearchSelect
            id="new-lot-unit"
            options={UNIT_OPTIONS}
            value={unit}
            onChange={setUnit}
            placeholder="—"
            searchPlaceholder="Buscar unidad…"
          />
        </div>
      </div>

      {/* Aviso, no bloqueo: recibir en kilos algo que se maneja en metros es
          un caso real y frecuente. Sólo se recuerda la unidad del material,
          por si el dedo resbaló en el selector. */}
      {material && unit && unit !== material.baseUnit && (
        <p className="text-xs text-state-reserved">
          Este material se maneja en{" "}
          {UNIT_LABELS[material.baseUnit].toLowerCase()} (
          {UNIT_SHORT_LABELS[material.baseUnit]}). Se guardará en{" "}
          {UNIT_SHORT_LABELS[unit as Unit]} tal como llegó.
        </p>
      )}

      {/* El tono no es el lote del proveedor: dos tonos en un mismo tendido
          salen con franjas y la prenda se rechaza. */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-lot-shade">Tono / partida de tintura</Label>
        <Input
          id="new-lot-shade"
          placeholder="A-42"
          value={shade}
          onChange={(event) => setShade(event.target.value)}
          className="touch-target tabular"
        />
        {material?.requiresShade && !shade.trim() && (
          <p className="text-xs text-state-reserved">
            Esta tela se maneja por tono: sin él no se sabe qué rollos se
            pueden tender juntos. Se puede llenar después.
          </p>
        )}
      </div>

      <FormSelectField
        id="new-lot-location"
        label="Ubicación"
        hint="Si va derecho a producción, déjala sin asignar."
      >
        <SearchSelect
          id="new-lot-location"
          options={locations.map((location) => ({
            value: location.id,
            label: location.name,
            hint: location.code,
            keywords: location.code,
          }))}
          value={locationId}
          onChange={setLocationId}
          placeholder="Sin asignar"
          searchPlaceholder="Buscar ubicación…"
          clearLabel="Sin asignar"
        />
      </FormSelectField>

      {/* El dueño sólo se pregunta cuando el vale no lo trae: ver NewLotOwner. */}
      {owner ? (
        <p className="flat-surface p-3 text-xs text-muted-foreground">
          El rollo quedará a nombre de <strong>{owner.label}</strong>, que es
          la empresa dueña de este vale. Su tela no surte la producción de
          otro.
        </p>
      ) : (
        <FormSelectField
          id="new-lot-client"
          label="Empresa dueña"
          hint="De quién es la tela. Jamás se surte el material de un cliente a la producción de otro."
        >
          <SearchSelect
            id="new-lot-client"
            options={[
              { value: FACTORY_OWNER, label: "De la fábrica" },
              ...clients.map((client) => ({
                value: client.id,
                label: client.name,
              })),
            ]}
            value={clientId}
            onChange={setClientId}
            placeholder="De la fábrica"
            searchPlaceholder="Buscar cliente…"
          />
        </FormSelectField>
      )}

      <SubmitButton
        type="button"
        onClick={handleSave}
        isSubmitting={isSaving}
        pendingLabel="Dando de alta…"
        className="h-12 w-full"
      >
        Dar de alta y agregarlo
      </SubmitButton>

      <p className="text-center text-xs text-muted-foreground">
        Se da de alta con su folio y su entrada en el kárdex, igual que desde
        Inventario, y entra como renglón de esta salida.
      </p>
    </div>
  );
}

/**
 * De quién queda el rollo.
 *
 * Con dueño en el vale manda ése. Sin él, lo que se haya elegido aquí; y el
 * centinela de la fábrica viaja como ausencia de dueño, que es como está
 * guardado en la base.
 */
function resolveOwner(
  owner: NewLotOwner | null,
  chosen: string,
): string | undefined {
  if (owner) return owner.clientId;
  return chosen && chosen !== FACTORY_OWNER ? chosen : undefined;
}
