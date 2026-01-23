import { useState } from "react";
import { useOutreachStore } from "@/stores/outreachStore";
import { useContacts } from "@/hooks/useContacts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TemplateEditor } from "./TemplateEditor";
import { RecipientSelector } from "./RecipientSelector";
import { SendProgress } from "./SendProgress";
import { Send, Eye, AlertTriangle } from "lucide-react";

type Step = "template" | "recipients" | "preview" | "sending";

export function OutreachPanel() {
  const [step, setStep] = useState<Step>("template");
  const { allContacts, allTags } = useContacts();
  const {
    template,
    selectedRecipientIds,
    activeQueue,
    setTemplate,
    selectRecipients,
    toggleRecipient,
    selectByTag,
    startOutreach,
    refreshStatus,
    cancelOutreach,
    previewMessage,
    isLoading,
    error,
  } = useOutreachStore();

  const selectedContacts = allContacts.filter((c) =>
    selectedRecipientIds.includes(c.userId)
  );

  const handleStart = async () => {
    await startOutreach();
    setStep("sending");
  };

  const handleBack = () => {
    switch (step) {
      case "recipients":
        setStep("template");
        break;
      case "preview":
        setStep("recipients");
        break;
    }
  };

  const handleNext = () => {
    switch (step) {
      case "template":
        setStep("recipients");
        break;
      case "recipients":
        setStep("preview");
        break;
    }
  };

  const canProceed = () => {
    switch (step) {
      case "template":
        return template.trim().length > 0;
      case "recipients":
        return selectedRecipientIds.length > 0;
      case "preview":
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2">
        {(["template", "recipients", "preview", "sending"] as Step[]).map(
          (s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : i < ["template", "recipients", "preview", "sending"].indexOf(step)
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              {i < 3 && (
                <div
                  className={`w-12 h-0.5 ${
                    i < ["template", "recipients", "preview", "sending"].indexOf(step)
                      ? "bg-primary"
                      : "bg-muted"
                  }`}
                />
              )}
            </div>
          )
        )}
      </div>

      {/* Step Content */}
      {step === "template" && (
        <Card>
          <CardHeader>
            <CardTitle>Message Template</CardTitle>
            <CardDescription>
              Write your message. Use variables for personalization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateEditor value={template} onChange={setTemplate} />
          </CardContent>
        </Card>
      )}

      {step === "recipients" && (
        <Card>
          <CardHeader>
            <CardTitle>Select Recipients</CardTitle>
            <CardDescription>
              Choose who should receive this message.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecipientSelector
              contacts={allContacts}
              selectedIds={selectedRecipientIds}
              allTags={allTags}
              onToggle={toggleRecipient}
              onSelectByTag={(tag) => selectByTag(tag, allContacts)}
              onClearAll={() => selectRecipients([])}
            />
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Preview & Confirm</CardTitle>
            <CardDescription>
              Review your message before sending.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-600">Rate Limiting Active</p>
                <p className="text-muted-foreground">
                  Messages will be sent with a 60-second delay between each to
                  avoid Telegram restrictions.
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p>
                <span className="font-medium">Recipients:</span>{" "}
                {selectedRecipientIds.length}
              </p>
              <p>
                <span className="font-medium">Estimated time:</span>{" "}
                {Math.ceil((selectedRecipientIds.length * 60) / 60)} minutes
              </p>
            </div>

            {/* Preview Samples */}
            <div className="space-y-2">
              <h4 className="font-medium">Message Preview</h4>
              {selectedContacts.slice(0, 3).map((contact) => (
                <div
                  key={contact.userId}
                  className="p-3 border rounded-lg text-sm"
                >
                  <p className="text-xs text-muted-foreground mb-1">
                    To: {contact.firstName} {contact.lastName}
                  </p>
                  <p className="whitespace-pre-wrap">
                    {previewMessage(contact.userId, allContacts)}
                  </p>
                </div>
              ))}
              {selectedContacts.length > 3 && (
                <p className="text-sm text-muted-foreground">
                  +{selectedContacts.length - 3} more recipients
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === "sending" && activeQueue && (
        <Card>
          <CardHeader>
            <CardTitle>Sending Messages</CardTitle>
            <CardDescription>
              Your messages are being sent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SendProgress
              queue={activeQueue}
              onRefresh={refreshStatus}
              onCancel={cancelOutreach}
            />
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Navigation */}
      {step !== "sending" && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === "template"}
          >
            Back
          </Button>
          {step === "preview" ? (
            <Button onClick={handleStart} disabled={isLoading}>
              <Send className="h-4 w-4 mr-2" />
              Start Sending
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed()}>
              {step === "recipients" && <Eye className="h-4 w-4 mr-2" />}
              Next
            </Button>
          )}
        </div>
      )}

      {/* Start New */}
      {step === "sending" && activeQueue?.status === "completed" && (
        <div className="flex justify-center">
          <Button
            onClick={() => {
              setTemplate("");
              selectRecipients([]);
              setStep("template");
            }}
          >
            Start New Outreach
          </Button>
        </div>
      )}
    </div>
  );
}
