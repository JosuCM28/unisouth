"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  Download,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { removeAttachmentAction } from "@/app/actions/attachment.actions";
import { runAction } from "@/lib/offline/run-action";
import { formatDateTime } from "@/lib/utils";
import { ResponsiveFormDialog } from "@/components/shared/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

/** Una foto ya guardada, como la manda la ficha de la orden. */
export interface OrderPhoto {
  id: string;
  name: string;
  sizeBytes: number | null;
  createdAt: Date;
  uploadedByName: string | null;
}

interface Props {
  orderId: string;
  photos: OrderPhoto[];
  /** Con false no se pinta ni subir ni borrar: la pantalla de Sólo lectura. */
  canWrite: boolean;
  /**
   * Si el almacén de fotos está montado y se puede escribir.
   *
   * Se avisa ANTES de que alguien intente subir. Sin volumen la foto se
   * escribiría dentro del contenedor y el siguiente despliegue se la llevaría.
   */
  storageReady: boolean;
}

/** Lado mayor al que se reduce antes de subir. */
const MAX_EDGE = 1600;
/** Calidad del JPEG. 0.85 deja legible un papel escrito a mano. */
const JPEG_QUALITY = 0.85;

/**
 * Las fotos del papel de una orden.
 *
 * La orden llega EN PAPEL y esa hoja es la única copia: se moja, se
 * traspapela, se va con quien renunció. Fotografiarla aquí es el respaldo.
 *
 * Se reduce en el NAVEGADOR antes de subir. Una foto de celular pesa cuatro
 * megas y la bodega tiene WiFi intermitente: a 1600px son unos trescientos
 * kilobytes, se sigue leyendo un número escrito a mano, y la subida termina
 * antes de que la señal se caiga. Reducir en el servidor no ayudaría —lo caro
 * es el viaje, no el redimensionado—.
 */
export function OrderPhotos({
  orderId,
  photos,
  canWrite,
  storageReady,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [open, setOpen] = useState<OrderPhoto | null>(null);
  /* La foto que se está por borrar. Aparte de `open` porque el visor se
     CIERRA para dejar su lugar a la confirmación: en celular el visor es un
     diálogo y la confirmación una hoja inferior, y montar una encima de otro
     deja dos trampas de foco peleándose. */
  const [confirming, setConfirming] = useState<OrderPhoto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setIsUploading(true);

    /* De una en una y no en paralelo: son varias fotos de varios megas desde
       un celular en la bodega, y mandarlas todas juntas satura la subida y las
       hace fallar a todas. Así, si la cuarta falla, las tres primeras ya
       quedaron guardadas. */
    let saved = 0;
    for (const file of Array.from(files)) {
      const ok = await uploadOne(orderId, file);
      if (ok) saved += 1;
      else break;
    }

    setIsUploading(false);
    if (inputRef.current) inputRef.current.value = "";

    if (saved > 0) {
      toast.success(saved === 1 ? "Foto guardada" : `${saved} fotos guardadas`);
      router.refresh();
    }
  }

  /** El visor cede su lugar a la confirmación. */
  function askDelete(photo: OrderPhoto) {
    setOpen(null);
    setConfirming(photo);
  }

  /** Arrepentirse devuelve al visor, no a la lista: ahí estaba mirando. */
  function cancelDelete() {
    const photo = confirming;
    setConfirming(null);
    if (photo) setOpen(photo);
  }

  async function handleDelete() {
    if (!confirming) return;

    setIsDeleting(true);
    const result = await runAction(() =>
      removeAttachmentAction({ id: confirming.id }),
    );
    setIsDeleting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Foto eliminada");
    setConfirming(null);
    router.refresh();
  }

  return (
    <section className="flat-surface flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Fotos del papel</h2>
          <p className="text-xs text-muted-foreground">
            {photos.length === 0
              ? "Respaldo de la hoja que entregó el cliente."
              : `${photos.length} ${photos.length === 1 ? "imagen" : "imágenes"}. Toca una para verla en grande.`}
          </p>
        </div>

        {canWrite && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => handleFiles(event.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              disabled={isUploading || !storageReady}
              onClick={() => inputRef.current?.click()}
            >
              <Camera className="size-4" aria-hidden />
              {isUploading ? "Subiendo…" : "Agregar foto"}
            </Button>
          </>
        )}
      </div>

      {/* El aviso sólo le sirve a quien puede subir: a Sólo lectura le diría
          de un problema que no puede resolver ni le estorba para mirar. */}
      {canWrite && !storageReady && (
        <p className="flex items-start gap-2 border border-state-reserved bg-card p-3 text-sm">
          <AlertTriangle
            className="size-4 shrink-0 text-state-reserved"
            aria-hidden
          />
          <span>
            El almacén de fotos no está disponible, así que no se pueden subir.
            Avisa al administrador: falta montar el volumen en el servidor. Las
            fotos que ya están siguen viéndose.
          </span>
        </p>
      )}

      {photos.length === 0 ? (
        <p className="border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {canWrite
            ? "Todavía no hay fotos. Toma una del papel para respaldarlo."
            : "Esta orden no tiene fotos."}
        </p>
      ) : (
        /* Tarjetas grandes en celular y rejilla en escritorio: en el piso se
           toca con una mano, a veces con guantes. */
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setOpen(photo)}
                className="group flex w-full flex-col border border-border bg-muted text-left"
              >
                {/* Sin next/image: la ruta exige sesión y pasa por la app, así
                    que el optimizador no puede leerla. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/orders/${orderId}/photos/${photo.id}`}
                  alt={photo.name}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
                <span className="truncate border-t border-border p-2 text-xs text-muted-foreground">
                  {formatDateTime(photo.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <PhotoViewer
        orderId={orderId}
        photo={open}
        canWrite={canWrite}
        onClose={() => setOpen(null)}
        onAskDelete={askDelete}
      />

      <DeleteConfirm
        orderId={orderId}
        photo={confirming}
        isDeleting={isDeleting}
        onCancel={cancelDelete}
        onConfirm={handleDelete}
      />
    </section>
  );
}

/**
 * "¿Segura que la borras?", con la foto enfrente.
 *
 * Lleva la miniatura porque el visor se cerró para dejarle el lugar, y una
 * confirmación que sólo dice un nombre de archivo obliga a acordarse de cuál
 * de seis fotos se estaba mirando. Aquí se ve.
 *
 * Es la única pregunta de este tipo en la pantalla y se justifica: borrar
 * tumba el respaldo de un papel que puede ser la única copia que queda, y no
 * hay deshacer.
 */
function DeleteConfirm({
  orderId,
  photo,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  orderId: string;
  photo: OrderPhoto | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ResponsiveFormDialog
      open={photo !== null}
      onOpenChange={(next) => !next && onCancel()}
      title="Borrar la foto"
      description="Se borra el archivo y no se puede deshacer. Si es el único respaldo del papel, no hay de dónde recuperarlo."
    >
      {photo && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 border border-border p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/orders/${orderId}/photos/${photo.id}`}
              alt={photo.name}
              className="size-16 shrink-0 border border-border bg-muted object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{photo.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(photo.createdAt)}
                {photo.uploadedByName ? ` · ${photo.uploadedByName}` : ""}
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-12 w-full bg-destructive text-white hover:bg-destructive/90"
          >
            <Trash2 className="size-4" aria-hidden />
            {isDeleting ? "Borrando…" : "Sí, borrar la foto"}
          </Button>

          {/* Salida explícita: en celular la hoja se cierra arrastrando, que
              no todo el mundo descubre con guantes puestos. */}
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
            className="h-12 w-full"
          >
            Cancelar
          </Button>
        </div>
      )}
    </ResponsiveFormDialog>
  );
}

/**
 * La foto en grande, con su descarga.
 *
 * La descarga es el punto: quien pregunta por su pedido pide "mándame la
 * hoja", y sin esto habría que ir al servidor por el archivo.
 */
function PhotoViewer({
  orderId,
  photo,
  canWrite,
  onClose,
  onAskDelete,
}: {
  orderId: string;
  photo: OrderPhoto | null;
  canWrite: boolean;
  onClose: () => void;
  /** No borra: pregunta. El botón está junto a Descargar y se aprieta solo. */
  onAskDelete: (photo: OrderPhoto) => void;
}) {
  return (
    <Dialog open={photo !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[95vw] gap-0 p-0 sm:max-w-3xl"
      >
        {photo && (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-border p-3">
              <DialogTitle className="min-w-0 truncate text-sm font-medium">
                {photo.name}
              </DialogTitle>
              <div className="flex shrink-0 items-center gap-1">
                <Button asChild variant="outline" size="sm" className="touch-target">
                  <a
                    href={`/api/orders/${orderId}/photos/${photo.id}?download=1`}
                    download={photo.name}
                  >
                    <Download className="size-4" aria-hidden />
                    Descargar
                  </a>
                </Button>
                {canWrite && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="touch-target text-destructive"
                    onClick={() => onAskDelete(photo)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Borrar
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="touch-target"
                  onClick={onClose}
                >
                  <X className="size-4" aria-hidden />
                  <span className="sr-only">Cerrar</span>
                </Button>
              </div>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/orders/${orderId}/photos/${photo.id}`}
              alt={photo.name}
              className="max-h-[75vh] w-full bg-muted object-contain"
            />

            <p className="border-t border-border p-3 text-xs text-muted-foreground">
              {formatDateTime(photo.createdAt)}
              {photo.uploadedByName ? ` · ${photo.uploadedByName}` : ""}
              {photo.sizeBytes ? ` · ${formatBytes(photo.sizeBytes)}` : ""}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Sube UNA foto ya reducida. Devuelve si quedó. */
async function uploadOne(orderId: string, file: File): Promise<boolean> {
  if (!file.type.startsWith("image/")) {
    toast.error(`"${file.name}" no es una imagen.`);
    return false;
  }

  const body = new FormData();
  body.append("file", await shrink(file));

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
    /* La bodega tiene WiFi intermitente y esto se va a ver seguido. Se dice
       qué hacer, no "Error de red". */
    toast.error(
      `No se pudo subir "${file.name}". Revisa la señal e intenta de nuevo.`,
    );
    return false;
  }
}

/**
 * Reduce la imagen a `MAX_EDGE` y la convierte a JPEG.
 *
 * Si algo falla —un formato que el navegador no sabe decodificar, un canvas
 * bloqueado— se devuelve el archivo ORIGINAL en vez de tirar la subida: más
 * vale una foto pesada guardada que un respaldo que no se hizo.
 */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    // Ya es chica: reconvertirla sólo le quitaría calidad sin ahorrar nada.
    if (scale === 1 && file.type === "image/jpeg") {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );

    if (!blob) return file;

    return new File([blob], replaceExtension(file.name), {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

/** El nombre conserva su base y pasa a .jpg, que es lo que de verdad va. */
function replaceExtension(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base || "foto"}.jpg`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
