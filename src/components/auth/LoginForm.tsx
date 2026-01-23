import { useAuthStore } from "@/stores/authStore";
import { PhoneInput } from "./PhoneInput";
import { CodeVerification } from "./CodeVerification";
import { PasswordInput } from "./PasswordInput";
import { MessageSquare } from "lucide-react";

export function LoginForm() {
  const { authState, setAuthState } = useAuthStore();

  const handleBack = () => {
    setAuthState({ type: "waitPhoneNumber" });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex items-center gap-2">
        <MessageSquare className="h-10 w-10 text-primary" />
        <h1 className="text-3xl font-bold">Telegram Copilot</h1>
      </div>

      {authState.type === "waitPhoneNumber" && <PhoneInput />}

      {authState.type === "waitCode" && (
        <CodeVerification
          phoneNumber={authState.phoneNumber}
          onBack={handleBack}
        />
      )}

      {authState.type === "waitPassword" && (
        <PasswordInput hint={authState.hint} />
      )}
    </div>
  );
}
