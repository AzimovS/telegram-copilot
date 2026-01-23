import { cn } from "@/lib/utils";
import type { Contact } from "@/types/contacts";
import { User, Calendar } from "lucide-react";

interface ContactCardProps {
  contact: Contact;
  isSelected: boolean;
  onClick: () => void;
}

export function ContactCard({ contact, isSelected, onClick }: ContactCardProps) {
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors border-b",
        isSelected && "bg-muted"
      )}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {contact.profilePhotoUrl ? (
          <img
            src={contact.profilePhotoUrl}
            alt={fullName}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{fullName}</span>
          {contact.username && (
            <span className="text-sm text-muted-foreground">
              @{contact.username}
            </span>
          )}
        </div>

        {/* Tags */}
        {contact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {contact.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
            {contact.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{contact.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Days since contact */}
      {contact.daysSinceContact !== undefined && (
        <div className="flex-shrink-0 text-right">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span className="text-xs">
              {contact.daysSinceContact === 0
                ? "Today"
                : contact.daysSinceContact === 1
                ? "Yesterday"
                : `${contact.daysSinceContact}d ago`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
