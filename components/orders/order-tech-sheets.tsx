"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { removeAttachmentAction } from "@/app/actions/attachment.actions";
import { runAction } from "@/lib/offline/run-action";
import { formatDateTime } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";

/** Una ficha ya guardada, como la manda la ficha de la orden. */
export interface OrderTechSheet {
  id: string;
  name: string;
  sizeBytes: number | null;
  createdAt: Date;
  uploadedByName: string | null;
}

interface Props {
  orderId: string;
  sheets: OrderTechSheet[];
  /** Con false no se pinta ni subir ni borrar: la pantalla de Sólo lectura. */
  canWrite: boolean;
  /** Si la carpeta de archivos está montada y se puede escribir. */
  storageReady: boolean;
}

/**
 * Las fichas técnicas en PDF de una orden.
 *
 * Lista y no galería, a diferencia de las fotos: un PDF no se previsualiza de
 * un vistazo y lo que se hace con él es abrirlo o imprimirlo. Poner miniaturas
 * habría sido una rejilla de cuadros rojos idénticos.
 *
 * Sólo PDF. Ni Word ni Excel a propósito: la ficha se imprime y se clava en la
 * mesa de corte, y un .docx se ve distinto en cada máquina que lo abra.
 *
 * NO se reduce ni se reconvierte nada antes de subir —al revés que las fotos—
 * porque una ficha técnica es un documento que alguien firma y compara: tocar
 * sus bytes para ahorrar disco sería cambiar el original.
 */
export function OrderTechSheets({
  orderId,
  sheets,
  canWrite,
  storageReady,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handlePick(files: FileList | null) {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let subidas = 0;

    // Una por una y no en paralelo: son archivos grandes y la bodega tiene
    // WiFi intermitente. En paralelo se pelean el ancho de banda y fallan las
    // dos; en fila, la primera queda aunque la segunda se caiga.
    for (const file of Array.from(files)) {
      if (await uploadOne(orderId, file)) subidas += 1;
    }

    setIsUploading(false);
    if (inputRef.current) inputRef.current.value = "";

    if (subidas > 0) {
      toast.success(
        subidas === 1 ? "Ficha técnica subida" : `${subidas} fichas subidas`,
      );
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Fichas técnicas</h2>

        {canWrite && storageReady && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(event) => handlePick(event.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-4" aria-hidden />
              {isUploading ? "Subiendo…" : "Subir PDF"}
            </Button>
          </>
        )}
      </div>

      {/* Se avisa ANTES de que alguien lo intente: sin volumen el archivo se
          escribiría dentro del contenedor y el siguiente despliegue se lo
          llevaría, dejando el registro apuntando a nada. */}
      {canWrite && !storageReady && (
        <p className="flex items-start gap-2 border border-state-defective p-3 text-sm">
          <AlertTriangle
            className="size-4 shrink-0 text-state-defective"
            aria-hidden
          />
          <span>
            No se pueden subir fichas: falta montar la carpeta de archivos.
            Avisa al administrador.
          </span>
        </p>
      )}

      {sheets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canWrite
            ? "Sube aquí la ficha técnica en PDF de lo que se va a cortar."
            : "Esta orden todavía no tiene ficha técnica."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sheets.map((sheet) => (
            <li
              key={sheet.id}
              className="flat-surface flex items-center gap-3 p-3"
            >
              <FileText
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{sheet.name}</p>
                <p className="tabular truncate text-xs text-muted-foreground">
                  {formatSize(sheet.sizeBytes)}
                  {sheet.uploadedByName && ` · ${sheet.uploadedByName}`}
                  {` · ${formatDateTime(sheet.createdAt)}`}
                </p>
              </div>

              {/* Abrir va antes que bajar: lo normal es mirarla para cotejar
                  una talla, no guardarse una copia. */}
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="touch-target shrink-0"
              >
                <a
                  href={`/api/orders/${orderId}/photos/${sheet.id}`}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Abrir ${sheet.name}`}
                  title="Abrir"
                >
                  <FileText className="size-4" aria-hidden />
                </a>
              </Button>

              <Button
                asChild
                variant="ghost"
                size="icon"
                className="touch-target shrink-0"
              >
                <a
                  href={`/api/orders/${orderId}/photos/${sheet.id}?download=1`}
                  aria-label={`Descargar ${sheet.name}`}
                  title="Descargar"
                >
                  <Download className="size-4" aria-hidden />
                </a>
              </Button>

              {canWrite && <DeleteButton sheet={sheet} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Borra una ficha, preguntando antes.
 *
 * Se pregunta porque no hay deshacer: el archivo se va del disco y si era la
 * única copia digital de la ficha, se acabó.
 */
function DeleteButton({ sheet }: { sheet: OrderTechSheet }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    const result = await runAction(() =>
      removeAttachmentAction({ id: sheet.id }),
    );
    setIsDeleting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Ficha técnica eliminada");
    setOpen(false);
    router.refresh();
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={setOpen}
      title="¿Borrar esta ficha técnica?"
      description={`"${sheet.name}" se va del disco y no se puede recuperar. Si es la única copia digital, ya no habrá otra.`}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="touch-target shrink-0"
          aria-label={`Borrar ${sheet.name}`}
          title="Borrar"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="destructive"
          className="h-12 w-full"
          disabled={isDeleting}
          onClick={handleDelete}
        >
          <Trash2 className="size-5" aria-hidden />
          {isDeleting ? "Borrando…" : "Sí, borrarla"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-12 w-full"
          onClick={() => setOpen(false)}
        >
          Cancelar
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}

/** Sube UN PDF tal cual. Devuelve si quedó. */
async function uploadOne(orderId: string, file: File): Promise<boolean> {
  /* Se revisa aquí además de en el servidor. No es la barrera —ésa está en
     `AttachmentService`— sino la cortesía: decirlo antes de gastar la subida
     entera para que el servidor la rechace al final. */
  if (file.type !== "application/pdf") {
    toast.error(`"${file.name}" no es un PDF.`);
    return false;
  }

  const body = new FormData();
  body.append("file", file);
  body.append("kind", "TECH_SHEET");

  try {
    const response = await fetch(`/api/orders/${orderId}/photos`, {
      method: "POST",
      body,
    });

    const result = (await response.json()) as
      | { success: true }
      | { success: false; error: string };

    if (!result.success) {
      toast.error(result.error);
      return false;
    }

    return true;
  } catch {
    toast.error(
      `No se pudo subir "${file.name}". Revisa la señal e intenta de nuevo.`,
    );
    return false;
  }
}

/** El peso en la unidad que se lee de un vistazo. */
function formatSize(bytes: number | null): string {
  if (bytes === null) return "Tamaño desconocido";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
