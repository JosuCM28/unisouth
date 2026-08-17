import { z } from "zod";
import { optionalNumber, optionalText, requiredText } from "./common";

/**
 * Paquetería: quién trae la carga.
 *
 * Sólo el nombre es obligatorio. El `trackingUrl` sirve para armar la liga de
 * rastreo con el número de guía de la recepción.
 */
export const carrierSchema = z.object({
  name: requiredText("El nombre", 120),
  phone: optionalText,
  trackingUrl: optionalText,
  active: z.boolean().default(true),
});

export type CarrierInput = z.infer<typeof carrierSchema>;

export const carrierFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  phone: z.string().optional(),
  trackingUrl: z.string().optional(),
  active: z.boolean(),
});

export type CarrierFormValues = z.infer<typeof carrierFormSchema>;

/** Proveedor: a quién se le compra. Igual, sólo el nombre es obligatorio. */
export const supplierSchema = z.object({
  name: requiredText("El nombre", 160),
  code: optionalText,
  taxId: optionalText,
  contact: optionalText,
  phone: optionalText,
  email: optionalText,
  address: optionalText,
  /** Días que tarda en entregar. Lo usa compras para planear. */
  leadTimeDays: optionalNumber,
  notes: optionalText,
  active: z.boolean().default(true),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

export const supplierFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(160),
  code: z.string().optional(),
  taxId: z.string().optional(),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  leadTimeDays: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean(),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;
