"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/avatar";
import { cn } from "@/lib/utils";

/**
 * A person's profile picture, falling back to their initials.
 *
 * The picture is a plain <img> laid over the initials rather than Radix's
 * AvatarImage: AvatarImage only renders after a client-side load check,
 * which never completed for server-rendered avatars (initials stayed on a
 * fresh page load). A plain <img> is in the server HTML, so it shows at
 * once; if it fails to load it hides and the initials show through.
 */
export function UserAvatar({
  name, src, className, fallbackClassName,
}: { name: string; src?: string | null; className?: string; fallbackClassName?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = src && failed !== src;
  return (
    <Avatar className={cn("size-[30px]", className)}>
      <AvatarFallback className={cn("bg-(--border-strong) text-xs font-semibold text-foreground", fallbackClassName)}>
        {initials(name)}
      </AvatarFallback>
      {show && (
        // eslint-disable-next-line @next/next/no-img-element -- small Storage image, already 256px
        <img data-slot="avatar-image" src={src} alt="" onError={() => setFailed(src)}
          className="absolute inset-0 size-full rounded-full object-cover" />
      )}
    </Avatar>
  );
}
