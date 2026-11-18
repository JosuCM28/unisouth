"use client";

import type { PackingListDraft } from "@/lib/packing/packing-list-draft";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type HeaderField = "client" | "date" | "preparedBy" | "reviewedBy" | "receivedBy" | "formatCode" | "revision";

interface FieldSpec {
  field: HeaderField;
  label: string;
  type?: "date";
  placeholder?: string;
}

interface FieldGroup {
  title: string;
  fields: FieldSpec[];
}

/**
 * El encabezado de la hoja, agrupado como se lee en el papel: a quién y
 * cuándo, quién firma, y el sello de calidad. Siete cajas sueltas en una
 * rejilla obligaban a leer etiqueta por etiqueta para encontrar la firma.
 */
const GROUPS: FieldGroup[] = [
  {
    title: "Documento",
    fields: [
      { field: "client", label: "Cliente" },
      { field: "date", label: "Fecha", type: "date" },
    ],
  },
  {
    title: "Firmas",
    fields: [
      { field: "preparedBy", label: "Elaboró" },
      { field: "reviewedBy", label: "Revisó", placeholder: "Quien revisa" },
      { field: "receivedBy", label: "Recibió (transportista)", placeholder: "Nombre del chofer" },
    ],
  },
  {
    title: "Formato de calidad",
    fields: [
      { field: "formatCode", label: "Código" },
      { field: "revision", label: "Revisión" },
    ],
  },
];

export function PackingListEditorHeader({
  draft,
  onChange,
  readOnly,
}: {
  draft: PackingListDraft;
  onChange: (patch: Partial<PackingListDraft>) => void;
  readOnly: boolean;
}) {
  return (
    <section className="flat-surface grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1fr]">
      {GROUPS.map((group, index) => (
        <fieldset key={group.title}
          className={cn(
            "flex flex-col gap-3 p-4",
            index > 0 && "border-t border-border lg:border-t-0 lg:border-l",
          )}>
          <legend className="sr-only">{group.title}</legend>
          <p aria-hidden className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.title}
          </p>
          <div className={cn("grid grid-cols-1 gap-3", group.fields.length === 3 && "sm:grid-cols-2")}>
            {group.fields.map((spec, fieldIndex) => (
              <HeaderInput key={spec.field} spec={spec} draft={draft} onChange={onChange} readOnly={readOnly}
                // El transportista firma solo abajo: a todo lo ancho se lee como la última firma.
                wide={group.fields.length === 3 && fieldIndex === 2} />
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-col gap-2 border-t border-border p-4 lg:col-span-3">
        <Label htmlFor="pl-notes">Notas</Label>
        <Textarea id="pl-notes" rows={2} value={draft.notes} readOnly={readOnly}
          placeholder={readOnly ? undefined : "Observaciones que salen al pie del packing list"}
          onChange={(event) => onChange({ notes: event.target.value })} className="uppercase placeholder:normal-case" />
      </div>
    </section>
  );
}

function HeaderInput({
  spec,
  draft,
  onChange,
  readOnly,
  wide,
}: {
  spec: FieldSpec;
  draft: PackingListDraft;
  onChange: (patch: Partial<PackingListDraft>) => void;
  readOnly: boolean;
  wide: boolean;
}) {
  const id = `pl-${spec.field}`;
  return (
    <div className={cn("flex flex-col gap-2", wide && "sm:col-span-2")}>
      <Label htmlFor={id}>{spec.label}</Label>
      <Input id={id} type={spec.type} value={draft[spec.field]} readOnly={readOnly}
        placeholder={readOnly ? undefined : spec.placeholder}
        onChange={(event) => onChange({ [spec.field]: event.target.value })}
        className={cn("touch-target", !spec.type && "uppercase placeholder:normal-case")} />
    </div>
  );
}
