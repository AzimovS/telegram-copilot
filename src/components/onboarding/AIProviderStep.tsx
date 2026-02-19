import { AIProviderForm } from "@/components/common/AIProviderForm";
import { type LLMConfig } from "@/lib/tauri";

interface AIProviderStepProps {
  onConfigChange: (config: LLMConfig) => void;
}

export function AIProviderStep({ onConfigChange }: AIProviderStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Set up AI Provider</h2>
        <p className="text-muted-foreground">
          Configure AI for briefings, summaries, and draft replies.
        </p>
      </div>

      <AIProviderForm variant="card" onConfigChange={onConfigChange} />
    </div>
  );
}
