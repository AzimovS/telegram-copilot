import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Contact } from "@/types/contacts";

interface ContactRowProps {
  contact: Contact;
  isSelected: boolean;
  isChecked: boolean;
  onRowClick: (contact: Contact) => void;
  onCheckboxClick: (e: React.MouseEvent, userId: number) => void;
}

const formatDate = (daysSince: number | undefined): string => {
  if (daysSince === undefined || daysSince === null) return "Never";
  if (daysSince === 0) return "Today";
  return `${daysSince}d ago`;
};

export function ContactRow({
  contact,
  isSelected,
  isChecked,
  onRowClick,
  onCheckboxClick,
}: ContactRowProps) {
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const isNeverContacted =
    contact.daysSinceContact === undefined || contact.daysSinceContact === null;

  return (
    <div
      className={cn(
        "grid grid-cols-[30px_1fr_100px_150px] gap-2 px-3 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b",
        isSelected && "bg-muted border-l-4 border-l-primary",
        isNeverContacted && "opacity-70"
      )}
      onClick={() => onRowClick(contact)}
    >
      {/* Checkbox */}
      <div
        className="flex items-center justify-center"
        onClick={(e) => onCheckboxClick(e, contact.userId)}
      >
        <Checkbox checked={isChecked} />
      </div>

      {/* Name & Username */}
      <div className="min-w-0">
        <div className="font-medium truncate">{fullName}</div>
        {contact.username && (
          <div className="text-xs text-muted-foreground truncate">
            @{contact.username}
          </div>
        )}
      </div>

      {/* Last Contact Date */}
      <div className={cn("text-sm", isNeverContacted && "text-red-500")}>
        {formatDate(contact.daysSinceContact)}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 items-start">
        {contact.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground"
          >
            {tag}
          </span>
        ))}
        {contact.tags.length > 2 && (
          <span className="text-xs text-muted-foreground">
            +{contact.tags.length - 2}
          </span>
        )}
      </div>
    </div>
  );
}
