"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Segunda línea: ubicación, código, tono… lo que desempata dos parecidos. */
  hint?: string;
  /** Texto extra por el que también se puede buscar sin mostrarlo. */
  keywords?: string;
  disabled?: boolean;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Texto del cuadro de búsqueda. */
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Opción para dejarlo vacío. Sin esto el campo es obligatorio. */
  clearLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Desplegable CON buscador.
 *
 * El `<Select>` normal obliga a recorrer la lista con el dedo: con 200
 * materiales o 60 ubicaciones, encontrar uno en el piso es más lento que
 * preguntarle al de junto. Aquí se teclean tres letras y ya.
 *
 * Se filtra por etiqueta Y por `keywords`, para que un rollo se encuentre
 * tanto por su folio como por su tono aunque en pantalla sólo se lea uno.
 *
 * En escritorio es un popover anclado al botón. En celular es una hoja que
 * sube desde abajo: al teclear en el buscador se abre el teclado, y un
 * popover flotante de 300px de alto queda justo detrás de él. La hoja, en
 * cambio, ancla el buscador arriba y deja la lista entre él y el teclado.
 */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Selecciona…",
  searchPlaceholder = "Buscar…",
  emptyMessage = "Sin resultados.",
  clearLabel,
  disabled,
  id,
  className,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const selected = options.find((option) => option.value === value);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  function renderTrigger(onClick?: () => void) {
    return (
      <Button
        id={id}
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "touch-target w-full justify-between font-normal",
          !selected && "text-muted-foreground",
          className,
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
      </Button>
    );
  }

  /**
   * El cuerpo del buscador. Se arma en función porque el alto de la lista
   * cambia con el envase: en el popover son 300px fijos; en la hoja tiene que
   * ocupar lo que sobre entre el buscador y el teclado, que no es un número.
   */
  function renderCommand(listClassName: string) {
    return (
      <Command
        filter={(itemValue, search) => {
          const option = options.find((o) => o.value === itemValue);
          if (!option) return 0;
          const haystack =
            `${option.label} ${option.hint ?? ""} ${option.keywords ?? ""}`.toLowerCase();
          return haystack.includes(search.toLowerCase()) ? 1 : 0;
        }}
      >
        <CommandInput
          placeholder={searchPlaceholder}
          className="h-11"
          // Es un buscador, no un campo de captura: el teclado debe traer lupa
          // en vez de "Enter", y sin autocorrector que cambie un código por una
          // palabra del diccionario.
          inputMode="search"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <CommandList className={listClassName}>
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <CommandGroup>
            {clearLabel && (
              <CommandItem
                value="__clear__"
                onSelect={() => pick("")}
                className="touch-target text-muted-foreground"
              >
                <X className="size-4" aria-hidden />
                {clearLabel}
              </CommandItem>
            )}

            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                onSelect={() => pick(option.value)}
                className="touch-target"
              >
                <Check
                  className={cn(
                    "size-4 shrink-0",
                    option.value === value ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{option.label}</span>
                  {option.hint && (
                    <span className="truncate text-xs text-muted-foreground">
                      {option.hint}
                    </span>
                  )}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    );
  }

  if (!isDesktop) {
    return (
      <>
        {renderTrigger(() => setOpen(true))}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            /* `max-h` y no `h` fijo: con el teclado abierto la regla
               .keyboard-aware-sheet recorta el alto disponible, y una altura
               fija se desbordaría por arriba en vez de encogerse. */
            className="keyboard-aware-sheet flex h-[75dvh] max-h-[75dvh] flex-col gap-0 p-0"
            // El foco automático abriría el teclado de golpe. Que lo abra el
            // auxiliar al tocar el buscador: muchas veces la opción que quiere
            // ya se ve en la lista y teclear sería un paso de más.
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <SheetHeader className="border-b border-border p-4 pb-3">
              <SheetTitle className="text-base">{placeholder}</SheetTitle>
            </SheetHeader>
            {renderCommand("keyboard-list max-h-none")}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{renderTrigger()}</PopoverTrigger>

      {/* El ancho del disparador: una lista más angosta que su botón se ve
          rota, y más ancha se sale de la pantalla. */}
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        {renderCommand("max-h-[300px]")}
      </PopoverContent>
    </Popover>
  );
}

/**
 * El mismo desplegable, atado a un parámetro de la URL.
 *
 * Es el que usan los filtros de las listas: el estado vive en la URL para que
 * el resultado se pueda compartir y sobreviva a un refresh.
 */
export function SearchSelectFilter({
  label,
  ...props
}: SearchSelectProps & { label?: ReactNode }) {
  if (!label) return <SearchSelect {...props} />;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <SearchSelect {...props} />
    </div>
  );
}
