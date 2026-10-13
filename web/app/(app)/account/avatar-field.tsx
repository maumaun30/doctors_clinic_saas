"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CameraIcon } from "lucide-react";
import { removeAvatar, uploadAvatar } from "@/lib/actions/avatar";
import { UserAvatar } from "@/app/_components/user-avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const SIZE = 256; // px; shown at up to 64px, so this stays sharp on retina

// Crop the centre square and shrink it before upload, so phone photos
// (often several MB) become a small WebP/PNG well under the 2 MB limit.
async function toSquare(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  canvas.getContext("2d")!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, SIZE, SIZE);
  bmp.close();
  // Browsers without WebP encoding fall back to PNG.
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("encode failed"))), "image/webp", 0.85));
}

/** Account settings: upload, change or remove your profile picture. */
export function AvatarField({
  name, url, onChange,
}: { name: string; url: string | null; onChange: (url: string | null) => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);

  const done = (res: Awaited<ReturnType<typeof uploadAvatar>>, ok: string) => {
    setBusy(null);
    if (!res.ok) { toast.error(res.error); return; }
    onChange(res.url);
    toast.success(ok);
    router.refresh();
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // picking the same file again still fires change
    if (!file) return;
    setBusy("upload");
    let blob: Blob;
    try {
      blob = await toSquare(file);
    } catch {
      setBusy(null);
      toast.error("Couldn’t read that image. Try a PNG or JPEG.");
      return;
    }
    const fd = new FormData();
    fd.set("file", new File([blob], "avatar", { type: blob.type }));
    done(await uploadAvatar(fd), "Profile picture updated");
  };

  const onRemove = async () => {
    setBusy("remove");
    done(await removeAvatar(), "Profile picture removed");
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <UserAvatar name={name} src={url} className="size-16" fallbackClassName="text-lg" />
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => input.current?.click()}>
            {busy === "upload" ? <Spinner /> : <CameraIcon />} {url ? "Change photo" : "Upload photo"}
          </Button>
          {url && (
            <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={onRemove}
              className="text-destructive hover:text-destructive">
              {busy === "remove" && <Spinner />} Remove
            </Button>
          )}
        </div>
        <span className="hint">Square crop from the centre. PNG, JPEG or WebP.</span>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onPick} />
    </div>
  );
}
