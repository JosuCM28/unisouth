"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface IssueDetails {
  concept: string;
  reference: string;
  handedOverBy: string;
  receivedBy: string;
}

export const EMPTY_DETAILS: IssueDetails = {
  concept: "",
  reference: "",
  handedOverBy: "",
  receivedBy: "",
};

const FIELDS: { key: keyof IssueDetails; label: string }[] = [
  { key: "concept", label: "Concepto" },
  { key: "reference", label: "Referencia u orden" },
  { key: "handedOverBy", label: "Entrega" },
  { key: "receivedBy", label: "Recibe" },
];

/**
 * Lo opcional del vale, plegado. Sólo el cliente y los rollos son
 * obligatorios: con todo abierto de golpe, sacar un rollo de pie en el
 * andén tardaría más que anotarlo en la libreta.
 */
export function OfflineIssueDetails({
  value,
  onChange,
}: {
  value: IssueDetails;
  onChange: (next: IssueDetails) => void;
}) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="touch-target w-full justify-between px-0"
        >
          Detalles del vale
          <ChevronDown className="size-4" aria-hidden />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="grid gap-3 pt-2 sm:grid-cols-2">
        {FIELDS.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <Label htmlFor={`offline-issue-${key}`}>{label}</Label>
            <Input
              id={`offline-issue-${key}`}
              value={value[key]}
              onChange={(event) => onChange({ ...value, [key]: event.target.value })}
              className="touch-target"
            />
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
