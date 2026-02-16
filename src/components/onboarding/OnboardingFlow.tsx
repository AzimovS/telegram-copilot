import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/stores/settingsStore";
import { updateLLMConfig, type LLMConfig } from "@/lib/tauri";
import { ChatFilterStep } from "./ChatFilterStep";
import { AIProviderStep } from "./AIProviderStep";
import { ArrowRight, ArrowLeft, SkipForward } from "lucide-react";

const TOTAL_STEPS = 2;

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { completeOnboarding } = useSettingsStore();
  const [step, setStep] = useState(1);
  const aiConfigRef = useRef<LLMConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const handleComplete = async () => {
    setSaving(true);
    try {
      // Save AI config if the user provided one (didn't skip)
      if (aiConfigRef.current) {
        await updateLLMConfig(aiConfigRef.current);
      }
      completeOnboarding();
      onComplete();
    } catch (e) {
      console.error("Failed to save AI config:", e);
      // Complete onboarding anyway — user can fix in Settings
      completeOnboarding();
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  const handleSkipAI = () => {
    aiConfigRef.current = null;
    completeOnboarding();
    onComplete();
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-8">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i + 1 === step ? "bg-primary" : i + 1 < step ? "bg-primary/50" : "bg-muted"
              }`}
            />
          ))}
          <span className="ml-2 text-xs text-muted-foreground">
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>

        {/* Step content */}
        {step === 1 && <ChatFilterStep />}
        {step === 2 && (
          <AIProviderStep
            onConfigChange={(config) => {
              aiConfigRef.current = config;
            }}
          />
        )}

        {/* Navigation */}
        <div className="flex justify-between">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            {step === TOTAL_STEPS && (
              <Button variant="ghost" onClick={handleSkipAI}>
                Skip
                <SkipForward className="ml-2 h-4 w-4" />
              </Button>
            )}

            {step < TOTAL_STEPS ? (
              <Button onClick={() => setStep(step + 1)} size="lg">
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleComplete} size="lg" disabled={saving}>
                {saving ? "Saving..." : "Get Started"}
                {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
