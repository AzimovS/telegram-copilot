import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/stores/settingsStore";
import { ThemeStep } from "./ThemeStep";
import { ChatFilterStep } from "./ChatFilterStep";
import { ArrowRight } from "lucide-react";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const { completeOnboarding } = useSettingsStore();

  const handleNext = () => {
    if (step === 0) {
      setStep(1);
    } else {
      completeOnboarding();
      onComplete();
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-8">
        {step === 0 ? <ThemeStep /> : <ChatFilterStep />}

        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={`h-2 w-8 rounded-full transition-colors ${
                  i === step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <Button onClick={handleNext} size="lg">
            {step === 0 ? "Next" : "Get Started"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
