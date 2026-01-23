import { useState } from "react";
import { Button } from "@/components/ui/button";

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const variableSuggestions = [
  { key: "{firstName}", label: "First Name" },
  { key: "{lastName}", label: "Last Name" },
  { key: "{fullName}", label: "Full Name" },
];

export function TemplateEditor({ value, onChange }: TemplateEditorProps) {
  const [cursorPosition, setCursorPosition] = useState(0);

  const insertVariable = (variable: string) => {
    const before = value.slice(0, cursorPosition);
    const after = value.slice(cursorPosition);
    const newValue = before + variable + after;
    onChange(newValue);
  };

  return (
    <div className="space-y-3">
      {/* Variable Buttons */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground">Insert variable:</span>
        {variableSuggestions.map(({ key, label }) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            onClick={() => insertVariable(key)}
            className="h-7"
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSelect={(e) =>
          setCursorPosition((e.target as HTMLTextAreaElement).selectionStart)
        }
        placeholder="Write your message template here...

Example:
Hi {firstName}! I wanted to reach out about..."
        className="w-full min-h-[200px] p-3 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-background"
      />

      {/* Character Count */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {variableSuggestions.some(({ key }) => value.includes(key)) && (
            <span className="text-primary">
              Variables detected - will be personalized for each recipient
            </span>
          )}
        </span>
        <span>{value.length} characters</span>
      </div>
    </div>
  );
}
