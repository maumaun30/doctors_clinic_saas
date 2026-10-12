"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadLabResult, getLabFileSignedUrl, deleteLabFile } from "@/lib/actions/lab-files";
import { ConfirmAction } from "@/app/_components/confirm-action";
import { Button } from "@/components/ui/button";

type FileRow = { id: string; file_name: string; size_bytes: number | null; content_type: string | null };

export default function LabFiles({
  labOrderId, files,
}: { labOrderId: string; files: FileRow[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const onUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const formEl = e.currentTarget;
    start(async () => {
      try {
        await uploadLabResult(fd);
        formEl.reset();
        router.refresh();
      } catch (err: any) { setMsg(err.message); }
    });
  };

  const onView = async (id: string) => {
    try {
      const url = await getLabFileSignedUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) { setMsg(err.message); }
  };

  const fmtSize = (n: number | null) =>
    n == null ? "" : n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div>
      {files.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {files.map(f => (
            <div key={f.id} style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" onClick={() => onView(f.id)} className="link"
                      style={{ background: "none", border: "none", padding: 0, fontSize: 13 }}>
                {f.file_name}
              </button>
              <span className="hint">{fmtSize(f.size_bytes)}</span>
              <ConfirmAction
                action={async () => { await deleteLabFile(f.id); router.refresh(); }}
                fields={{}} label="✕" triggerTitle="Delete file" confirmLabel="Delete"
                size="icon-xs"
                title="Delete this file?"
                description={<><strong>{f.file_name}</strong> is permanently removed from this lab order.</>}
                success="File deleted" error="Couldn’t delete the file. Please try again." />
            </div>
          ))}
        </div>
      )}
      <form onSubmit={onUpload} style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="hidden" name="lab_order_id" value={labOrderId} />
        <input type="file" name="file" required className="hint"
               accept=".pdf,image/png,image/jpeg,image/webp,image/heic" />
        <Button variant="outline" size="sm" type="submit" disabled={busy}>{busy ? "…" : "Upload"}</Button>
      </form>
      {msg && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 6 }}>{msg}</p>}
    </div>
  );
}
