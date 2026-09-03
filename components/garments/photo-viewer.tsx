"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GarmentPhoto } from "./garment-photo";

interface Props {
  photoId: string | null;
  /** Qué se está viendo: "Manga izquierda bordado". */
  title: string;
  /** La miniatura sobre la que se toca. */
  children: React.ReactNode;
}

/**
 * Toca la miniatura y la foto se ve completa.
 *
 * No es un adorno: la foto existe para que el taller vea a qué altura va el
 * bordado, y en un cuadrito de 80 píxeles eso no se distingue. Sin esto la
 * gente acabaría pidiéndola por WhatsApp, que es de donde se está tratando de
 * sacar el proceso.
 *
 * Se usa `object-contain` y no `object-cover`: recortar la foto grande podría
 * dejar fuera justo la parte que se fue a mirar.
 */
export function PhotoViewer({ photoId, title, children }: Props) {
  const [open, setOpen] = useState(false);

  // Sin foto no hay nada que ampliar: la miniatura se pinta y ya.
  if (!photoId) return <>{children}</>;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="block" aria-label={`Ver ${title}`}>
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogTitle className="text-sm font-medium">{title}</DialogTitle>
        <GarmentPhoto
          photoId={photoId}
          alt={title}
          className="max-h-[75dvh] w-full !object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
