import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface NotesEditorProps {
  notes: string;
  onSave: (notes: string) => void;
}

export function NotesEditor({ notes, onSave }: NotesEditorProps) {
  const [value, setValue] = useState(notes);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setValue(notes);
    setHasChanges(false);
  }, [notes]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    setHasChanges(e.target.value !== notes);
  };

  const handleSave = () => {
    onSave(value);
    setHasChanges(false);
  };

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={handleChange}
        placeholder="Add notes about this contact..."
        className="w-full min-h-[150px] p-3 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-background"
      />
      {hasChanges && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />
            Save Notes
          </Button>
        </div>
      )}
    </div>
  );
}
