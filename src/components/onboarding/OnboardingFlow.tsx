import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/stores/settingsStore";
import { ChatFilterStep } from "./ChatFilterStep";
import { ArrowRight } from "lucide-react";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { completeOnboarding } = useSettingsStore();

  const handleComplete = () => {
    completeOnboarding();
    onComplete();
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-8">
        <ChatFilterStep />

        <div className="flex justify-end">
          <Button onClick={handleComplete} size="lg">
            Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
