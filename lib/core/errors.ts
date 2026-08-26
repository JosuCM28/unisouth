/**
 * Errores esperados del dominio.
 *
 * Toda falla previsible extiende DomainError, y eso es lo que permite que
 * `executeAction` distinga en un solo `catch` lo que el usuario debe leer —una
 * regla de negocio que no se cumplió— de lo que jamás debe ver: un fallo de
 * conexión, un bug. Los mensajes ya vienen listos para pintarse en pantalla.
 *
 * `code` es abstracto para que quien atrape el error lo lea sin saber de qué
 * subclase se trata.
 */
export abstract class DomainError extends Error {
  /** Identificador estable para el cliente. Nunca se traduce ni se muestra. */
  abstract readonly code: string;

  /** Campo del formulario culpable, si aplica. Permite marcarlo en rojo. */
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    // Sin esto, `instanceof` falla al extender clases nativas compiladas a ES5.
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
    this.field = field;
  }
}

/** El registro no existe, o fue dado de baja. */
export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND";

  constructor(entityName: string, identifier?: string) {
    const detail = identifier ? ` (${identifier})` : "";
    super(`No se encontró ${entityName}${detail}.`);
  }
}

/** Los datos recibidos no cumplen el esquema o el formato esperado. */
export class ValidationError extends DomainError {
  readonly code = "VALIDATION_ERROR";

  constructor(message: string, field?: string) {
    super(message, field);
  }
}

/** Ya existe otro registro con esa clave natural (código, folio, nombre). */
export class DuplicateError extends DomainError {
  readonly code = "DUPLICATE";

  /**
   * `label` es para el mensaje ("código"); `field` es el nombre técnico del
   * campo del formulario ("code"). No son lo mismo: el formulario marca el
   * input por su `name`, y mandarle la etiqueta en español lo dejaría sin
   * resaltar el campo culpable.
   */
  constructor(
    entityName: string,
    label: string,
    value: string,
    field?: string,
  ) {
    super(`Ya existe ${entityName} con ${label} "${value}".`, field ?? label);
  }
}

/** La operación es válida en forma, pero una regla del negocio la impide. */
export class BusinessRuleError extends DomainError {
  readonly code = "BUSINESS_RULE";

  constructor(message: string, field?: string) {
    super(message, field);
  }
}

/**
 * No hay material suficiente para surtir.
 *
 * Lleva las cantidades porque el auxiliar necesita ver cuánto falta sin
 * salirse de la pantalla en la que está.
 */
export class InsufficientStockError extends DomainError {
  readonly code = "INSUFFICIENT_STOCK";

  readonly requested: number;
  readonly available: number;

  constructor(
    requested: number,
    available: number,
    unit: string,
    reference?: string,
  ) {
    const detail = reference ? ` en ${reference}` : "";
    super(
      `Cantidad insuficiente${detail}: se pidieron ${requested} ${unit} y sólo hay ${available} ${unit} disponibles.`,
      "quantity",
    );
    this.requested = requested;
    this.available = available;
  }
}

/** No hay sesión activa: hay que iniciar sesión. */
export class UnauthorizedError extends DomainError {
  readonly code = "UNAUTHORIZED";

  constructor(message = "Tu sesión expiró. Vuelve a iniciar sesión.") {
    super(message);
  }
}

/** Hay sesión, pero el rol no alcanza para esta operación. */
export class ForbiddenError extends DomainError {
  readonly code = "FORBIDDEN";

  constructor(message = "No tienes permiso para realizar esta acción.") {
    super(message);
  }
}
