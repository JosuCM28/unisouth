"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addOrderCommentAction,
  deleteOrderCommentAction,
} from "@/app/actions/cutting-order.actions";
import { runAction } from "@/lib/offline/run-action";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface OrderCommentView {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string | null;
}

interface Props {
  orderId: string;
  comments: OrderCommentView[];
  /** Sin permiso de escritura sólo se leen: el formulario no se ofrece. */
  canWrite: boolean;
}

/**
 * Los comentarios INTERNOS de una orden.
 *
 * Son las notas de planeación de la oficina —"30% a Shawcor, el resto se
 * queda aquí"— y no tienen nada que ver con las Notas de la orden, que son
 * parte del documento: aquéllas se imprimen en la hoja que firma el taller y
 * se copian al vale de salida. Éstas nunca salen del edificio, y la pantalla
 * lo dice para que nadie escriba aquí una instrucción esperando que llegue a
 * la mesa de corte.
 *
 * Van como lista con fecha y no como un solo texto editable para que cada
 * decisión conserve la suya: meses después la pregunta no es sólo qué se
 * decidió, sino cuándo.
 */
export function OrderComments({ orderId, comments, canWrite }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    const text = body.trim();
    if (!text) return;

    setIsSaving(true);
    const result = await runAction(() =>
      addOrderCommentAction({ orderId, body: text }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    // Se limpia sólo si de verdad se guardó: al fallar, lo escrito sigue ahí
    // y no hay que volver a teclearlo.
    setBody("");
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await runAction(() => deleteOrderCommentAction({ id }));
    setDeletingId(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Sólo se ven aquí. No salen en la hoja impresa, ni en el Excel, ni se
          copian al vale de salida.
        </span>
      </p>

      {canWrite && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="30% a Shawcor, el resto se queda aquí…"
            rows={2}
            maxLength={2000}
            className="min-h-20"
            aria-label="Nuevo comentario interno"
          />
          <Button
            type="button"
            onClick={handleAdd}
            /* Deshabilitado con la caja vacía: el servidor lo rechazaría de
               todos modos y el error llegaría como un toast rojo por haber
               tocado un botón que no debía estar disponible. */
            disabled={isSaving || body.trim().length === 0}
            className="touch-target self-start"
          >
            <Send className="size-4" aria-hidden />
            {isSaving ? "Guardando…" : "Agregar comentario"}
          </Button>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin comentarios internos todavía.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="flex items-start justify-between gap-3 border border-border bg-muted/40 p-3"
            >
              <div className="min-w-0 flex-1">
                {/* `whitespace-pre-wrap`: aquí se escriben listas y renglones
                    sueltos, y aplastarlos a un párrafo los vuelve ilegibles. */}
                <p className="whitespace-pre-wrap break-words text-sm">
                  {comment.body}
                </p>
                <p className="tabular mt-1 text-xs text-muted-foreground">
                  {formatDateTime(comment.createdAt)}
                  {comment.authorName && ` · ${comment.authorName}`}
                </p>
              </div>

              {canWrite && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(comment.id)}
                  disabled={deletingId === comment.id}
                  className="touch-target shrink-0"
                  aria-label="Retirar este comentario"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
