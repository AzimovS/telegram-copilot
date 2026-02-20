import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateLLMConfig } from "@/lib/tauri";
import {
  AIProviderForm,
  type AIProviderFormHandle,
} from "@/components/common/AIProviderForm";

interface AIProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIProviderDialog({ open, onOpenChange }: AIProviderDialogProps) {
  const formRef = useRef<AIProviderFormHandle>(null);
  const [saving, setSaving] = useState(false);

  const handleApply = async () => {
    const config = formRef.current?.getConfig();
    if (!config) return;
    setSaving(true);
    try {
      await updateLLMConfig(config);
      onOpenChange(false);
    } catch (e) {
      console.error("Failed to save LLM config:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI Provider</DialogTitle>
          <DialogDescription>
            Configure which AI provider and model to use for briefings, summaries, and drafts.
          </DialogDescription>
        </DialogHeader>

        <AIProviderForm ref={formRef} variant="compact" />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={saving}>
            {saving ? "Saving..." : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
