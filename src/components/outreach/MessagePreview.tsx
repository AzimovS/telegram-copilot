import type { Contact } from "@/types/contacts";

interface MessagePreviewProps {
  contacts: Contact[];
  previewMessage: (userId: number, contacts: Contact[]) => string;
}

export function MessagePreview({ contacts, previewMessage }: MessagePreviewProps) {
  const previewContacts = contacts.slice(0, 10);
  const remainingCount = contacts.length - 10;

  if (contacts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">
        Preview ({contacts.length} recipient{contacts.length !== 1 ? "s" : ""})
      </h4>
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {previewContacts.map((contact) => (
          <div
            key={contact.userId}
            className="p-3 border rounded-lg text-sm bg-muted/30"
          >
            <p className="text-xs text-muted-foreground mb-1">
              To: {contact.firstName} {contact.lastName}
              {contact.username && ` (@${contact.username})`}
            </p>
            <p className="whitespace-pre-wrap">
              {previewMessage(contact.userId, contacts)}
            </p>
          </div>
        ))}
      </div>
      {remainingCount > 0 && (
        <p className="text-sm text-muted-foreground">
          +{remainingCount} more recipient{remainingCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
