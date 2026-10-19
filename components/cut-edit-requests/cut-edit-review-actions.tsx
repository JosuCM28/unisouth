"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { reviewCutEditAction } from "@/app/actions/cut-edit-request.actions";
import { runAction } from "@/lib/offline/run-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Autorizar o rechazar, con una nota opcional que ve quien lo pidió. */
export function CutEditReviewActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function review(approve: boolean) {
    setIsSaving(true);
    const result = await runAction(() =>
      reviewCutEditAction({ id: requestId, approve, note }),
    );
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(approve ? "Edición autorizada" : "Solicitud rechazada");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 md:flex-row">
      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Nota (opcional)"
        className="touch-target md:flex-1"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          className="touch-target flex-1"
          disabled={isSaving}
          onClick={() => review(true)}
        >
          <Check className="size-4" aria-hidden />
          Autorizar
        </Button>
        <Button
          type="button"
          variant="outline"
          className="touch-target flex-1"
          disabled={isSaving}
          onClick={() => review(false)}
        >
          <X className="size-4" aria-hidden />
          Rechazar
        </Button>
      </div>
    </div>
  );
}
