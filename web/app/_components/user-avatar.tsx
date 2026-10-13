import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

/** A person's profile picture, falling back to their initials. */
export function UserAvatar({
  name, src, className, fallbackClassName,
}: { name: string; src?: string | null; className?: string; fallbackClassName?: string }) {
  return (
    <Avatar className={cn("size-[30px]", className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className={cn("bg-(--border-strong) text-xs font-semibold text-foreground", fallbackClassName)}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
