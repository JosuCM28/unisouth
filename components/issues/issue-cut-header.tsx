"use client";

import { Plus, Trash2 } from "lucide-react";
import type { CutVersion } from "@prisma/client";
import { CUT_VERSION_LABELS } from "@/lib/constants/labels";
import { FormSelectField } from "@/components/shared/form-field";
import { SearchSelect } from "@/components/shared/search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Un material del catálogo, ofrecido como tela del corte. */
export interface CutFabricOption {
  id: string;
  code: string;
  name: string;
  /** Rollos surtibles hoy. Cero es válido: la tela puede venir ya cortada. */
  lotCount: number;
}

/** El encabezado del desglose, tal como se está capturando. */
export interface CutHeaderDraft {
  cutDescription: string;
  cutFabricId: string;
  cutFabricText: string;
  cutPattern: string;
  cutVersion: string;
  cutVersionNotes: string;
  /** Notas del pie, en el orden en que se imprimen numeradas. */
  cutNotes: string[];
}

/** Encabezado en blanco: el estado inicial de una salida nueva. */
export const EMPTY_CUT_HEADER: CutHeaderDraft = {
  cutDescription: "",
  cutFabricId: "",
  cutFabricText: "",
  cutPattern: "",
  cutVersion: "",
  cutVersionNotes: "",
  cutNotes: [],
};

const VERSION_OPTIONS = (Object.keys(CUT_VERSION_LABELS) as CutVersion[]).map(
  (version) => ({ value: version, label: CUT_VERSION_LABELS[version] }),
);

interface Props {
  fabrics: CutFabricOption[];
  value: CutHeaderDraft;
  onChange: (value: CutHeaderDraft) => void;
}

/**
 * El encabezado de la hoja de corte: para quién, qué prenda y con qué tela.
 *
 * Estos datos son PROPIOS del vale y no se deducen de los rollos. Antes la
 * hoja impresa sacaba la empresa y la tela de los rollos que llevaba, así que
 * una salida sin rollos —prendas ya cortadas que se mandan al taller— salía
 * con esos renglones en blanco justo en el documento que el taller firma.
 *
 * La tela admite catálogo Y texto libre a propósito: lo normal es elegirla del
 * catálogo, pero cuando llega una tela que todavía nadie dio de alta el corte
 * no puede esperar a que exista la ficha del material.
 *
 * La fecha y el número de orden NO están aquí: son la fecha y la referencia
 * del vale, que ya amparan todas las tallas del desglose.
 */
export function IssueCutHeader({ fabrics, value, onChange }: Props) {
  function patch(changes: Partial<CutHeaderDraft>) {
    onChange({ ...value, ...changes });
  }

  function addNote() {
    patch({ cutNotes: [...value.cutNotes, ""] });
  }

  function updateNote(index: number, text: string) {
    patch({
      cutNotes: value.cutNotes.map((note, position) =>
        position === index ? text : note,
      ),
    });
  }

  function removeNote(index: number) {
    patch({
      cutNotes: value.cutNotes.filter((_, position) => position !== index),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="cut-description">Descripción</Label>
        <Input
          id="cut-description"
          placeholder="Blusa manga larga"
          value={value.cutDescription}
          onChange={(event) => patch({ cutDescription: event.target.value })}
          className="touch-target"
        />
      </div>

      <FormSelectField
        id="cut-fabric"
        label="Tela"
        hint="Del catálogo. Si no está dada de alta, escríbela abajo."
      >
        <SearchSelect
          id="cut-fabric"
          options={fabrics.map((fabric) => ({
            value: fabric.id,
            label: fabric.name,
            hint: `${fabric.code}${fabric.lotCount > 0 ? ` · ${fabric.lotCount} ${fabric.lotCount === 1 ? "rollo" : "rollos"}` : ""}`,
            keywords: fabric.code,
          }))}
          value={value.cutFabricId}
          onChange={(fabricId) => patch({ cutFabricId: fabricId })}
          placeholder="Elige la tela"
          searchPlaceholder="Buscar por código o nombre…"
          clearLabel="Sin tela del catálogo"
        />
      </FormSelectField>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cut-fabric-text">Tela (escrita a mano)</Label>
        <Input
          id="cut-fabric-text"
          placeholder="Sólo si no está en el catálogo"
          value={value.cutFabricText}
          onChange={(event) => patch({ cutFabricText: event.target.value })}
          className="touch-target"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cut-pattern">Molde</Label>
          <Input
            id="cut-pattern"
            placeholder="Opcional"
            value={value.cutPattern}
            onChange={(event) => patch({ cutPattern: event.target.value })}
            className="touch-target"
          />
        </div>

        <FormSelectField id="cut-version" label="Versión">
          <SearchSelect
            id="cut-version"
            options={VERSION_OPTIONS}
            value={value.cutVersion}
            onChange={(version) => patch({ cutVersion: version })}
            placeholder="Sin versión"
            searchPlaceholder="Buscar versión…"
            clearLabel="Sin versión"
          />
        </FormSelectField>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cut-version-notes">Descripción de la versión</Label>
        <Input
          id="cut-version-notes"
          placeholder="Qué cambia respecto a la anterior"
          value={value.cutVersionNotes}
          onChange={(event) => patch({ cutVersionNotes: event.target.value })}
          className="touch-target"
        />
      </div>

      {/* Las notas se capturan como LISTA y no como un párrafo: en la hoja se
          imprimen numeradas y en el taller se van palomeando una por una. Un
          bloque de texto corrido obliga a leerlo entero para saber si falta
          alguna. */}
      <div className="flex flex-col gap-2">
        <Label>Notas</Label>

        {value.cutNotes.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Sin notas. Ej. &ldquo;va sin serigrafiar&rdquo;.
          </p>
        )}

        <ol className="flex flex-col gap-2">
          {value.cutNotes.map((note, index) => (
            <li key={index} className="flex items-center gap-2">
              <span className="tabular w-6 shrink-0 text-sm text-muted-foreground">
                {index + 1}.
              </span>
              <Input
                value={note}
                onChange={(event) => updateNote(index, event.target.value)}
                placeholder="Va sin serigrafiar"
                className="touch-target"
                aria-label={`Nota ${index + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="touch-target shrink-0"
                onClick={() => removeNote(index)}
                aria-label={`Quitar nota ${index + 1}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ol>

        <Button
          type="button"
          variant="outline"
          className="touch-target w-fit"
          onClick={addNote}
        >
          <Plus className="size-4" aria-hidden />
          Agregar nota
        </Button>
      </div>
    </div>
  );
}
