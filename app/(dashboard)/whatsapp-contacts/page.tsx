import { redirect } from "next/navigation";

/**
 * Los contactos de WhatsApp se mudaron a Notificaciones, junto a los correos
 * y los interruptores de cada canal. Se deja la ruta para que un marcador
 * guardado no caiga en un 404.
 */
export default function WhatsappContactsPage() {
  redirect("/notifications");
}
