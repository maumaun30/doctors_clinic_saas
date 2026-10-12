"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeVisitFull } from "@/lib/actions/appointments";
import { Button } from "@/components/ui/button";

type Med = { id: string; name: string; default_dosage: string | null; default_frequency: string | null; default_instructions: string | null };
type Lab = { id: string; name: string };
type Cond = { id: string; name: string };

type RxPick = { medication_id?: string; name: string; dosage?: string; frequency?: string; duration?: string; instructions?: string };
type LabPick = { lab_test_id?: string; name: string };
type CondPick = { condition_id?: string; name: string; status?: "active" | "resolved"; since?: string };

export default function VisitForm({
  appointmentId, meds, labs, conditions,
}: { appointmentId: string; meds: Med[]; labs: Lab[]; conditions: Cond[] }) {
  const router = useRouter();
  const [chief, setChief] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");

  const [bp, setBp] = useState("");
  const [hr, setHr] = useState("");
  const [temp, setTemp] = useState("");
  const [weight, setWeight] = useState("");

  const [rx, setRx] = useState<RxPick[]>([]);
  const [lab, setLab] = useState<LabPick[]>([]);
  const [cond, setCond] = useState<CondPick[]>([]);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const addMedFromLib = (m: Med) => {
    if (rx.find(r => r.medication_id === m.id)) return;
    setRx([...rx, {
      medication_id: m.id, name: m.name,
      dosage: m.default_dosage ?? "", frequency: m.default_frequency ?? "",
      instructions: m.default_instructions ?? "",
    }]);
  };
  const addMedCustom = (name: string) => {
    if (!name.trim()) return;
    setRx([...rx, { name: name.trim() }]);
  };
  const removeRx = (i: number) => setRx(rx.filter((_, k) => k !== i));

  const addLabFromLib = (l: Lab) => {
    if (lab.find(x => x.lab_test_id === l.id)) return;
    setLab([...lab, { lab_test_id: l.id, name: l.name }]);
  };
  const addLabCustom = (name: string) => {
    if (!name.trim()) return;
    setLab([...lab, { name: name.trim() }]);
  };
  const removeLab = (i: number) => setLab(lab.filter((_, k) => k !== i));

  const addCondFromLib = (c: Cond) => {
    if (cond.find(x => x.condition_id === c.id)) return;
    setCond([...cond, { condition_id: c.id, name: c.name, status: "active" }]);
  };
  const addCondCustom = (name: string) => {
    if (!name.trim()) return;
    setCond([...cond, { name: name.trim(), status: "active" }]);
  };
  const removeCond = (i: number) => setCond(cond.filter((_, k) => k !== i));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const vitals: Record<string, unknown> = {};
    if (bp) vitals.bp = bp;
    if (hr) vitals.hr = Number(hr);
    if (temp) vitals.temp_c = Number(temp);
    if (weight) vitals.weight_kg = Number(weight);

    start(async () => {
      try {
        await completeVisitFull({
          appointment_id: appointmentId,
          chief_complaint: chief || undefined,
          diagnosis: diagnosis || undefined,
          vitals: Object.keys(vitals).length ? vitals : undefined,
          notes: notes || undefined,
          prescriptions: rx,
          labs: lab,
          conditions: cond,
        });
        router.push("/schedule");
      } catch (err: any) { setMsg(err.message); }
    });
  };

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 24, maxWidth: 700 }}>
      <div>
        <div className="label">Vitals</div>
        <div className="grid-2">
          <div className="field" style={{ margin: 0 }}>
            <label className="label" style={{ fontWeight: 400, color: "var(--fg-muted)" }}>BP</label>
            <input className="input" value={bp} onChange={e => setBp(e.target.value)} placeholder="120/80" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label" style={{ fontWeight: 400, color: "var(--fg-muted)" }}>HR</label>
            <input className="input" value={hr} onChange={e => setHr(e.target.value)} type="number" placeholder="72" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label" style={{ fontWeight: 400, color: "var(--fg-muted)" }}>Temp (°C)</label>
            <input className="input" value={temp} onChange={e => setTemp(e.target.value)} type="number" step="0.1" placeholder="37.0" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="label" style={{ fontWeight: 400, color: "var(--fg-muted)" }}>Weight (kg)</label>
            <input className="input" value={weight} onChange={e => setWeight(e.target.value)} type="number" step="0.1" />
          </div>
        </div>
      </div>

      <div className="field" style={{ margin: 0 }}>
        <label className="label">Chief complaint</label>
        <textarea className="input" rows={2} value={chief} onChange={e => setChief(e.target.value)} />
      </div>

      <div className="field" style={{ margin: 0 }}>
        <label className="label">Diagnosis (free-text)</label>
        <textarea className="input" rows={2} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
      </div>

      <div>
        <TagPicker
          title="Conditions (problem list)"
          library={conditions.map(c => ({ id: c.id, label: c.name }))}
          picked={cond.map(c => c.name)}
          onPickLibrary={id => addCondFromLib(conditions.find(c => c.id === id)!)}
          onAddCustom={addCondCustom}
        />
        {cond.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {cond.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="strong">{c.name}</span>
                <select className="select" value={c.status ?? "active"}
                  onChange={e => setCond(cond.map((x, k) => k === i ? { ...x, status: e.target.value as any } : x))}>
                  <option value="active">active</option>
                  <option value="resolved">resolved</option>
                </select>
                <Button variant="ghost" size="sm" type="button" onClick={() => removeCond(i)}>Remove</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <TagPicker
          title="Prescriptions"
          library={meds.map(m => ({ id: m.id, label: m.name }))}
          picked={rx.map(r => r.name)}
          onPickLibrary={id => addMedFromLib(meds.find(m => m.id === id)!)}
          onAddCustom={addMedCustom}
        />
        {rx.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {rx.map((r, i) => (
              <div key={i} className="card" style={{ padding: 12, boxShadow: "none" }}>
                <div className="row-between">
                  <strong>{r.name}</strong>
                  <Button variant="ghost" size="sm" type="button" onClick={() => removeRx(i)}>Remove</Button>
                </div>
                <div className="grid-2" style={{ marginTop: 8 }}>
                  <input className="input" placeholder="dosage" value={r.dosage ?? ""}
                    onChange={e => setRx(rx.map((x, k) => k === i ? { ...x, dosage: e.target.value } : x))} />
                  <input className="input" placeholder="frequency" value={r.frequency ?? ""}
                    onChange={e => setRx(rx.map((x, k) => k === i ? { ...x, frequency: e.target.value } : x))} />
                  <input className="input" placeholder="duration" value={r.duration ?? ""}
                    onChange={e => setRx(rx.map((x, k) => k === i ? { ...x, duration: e.target.value } : x))} />
                  <input className="input" placeholder="instructions" value={r.instructions ?? ""}
                    onChange={e => setRx(rx.map((x, k) => k === i ? { ...x, instructions: e.target.value } : x))} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <TagPicker
          title="Lab orders"
          library={labs.map(l => ({ id: l.id, label: l.name }))}
          picked={lab.map(l => l.name)}
          onPickLibrary={id => addLabFromLib(labs.find(l => l.id === id)!)}
          onAddCustom={addLabCustom}
        />
        {lab.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {lab.map((l, i) => (
              <span key={i} className="badge">
                <span className="dot" />{l.name}
                <button type="button" onClick={() => removeLab(i)} title="Remove"
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--fg-subtle)", padding: 0, marginLeft: 2 }}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="field" style={{ margin: 0 }}>
        <label className="label">Notes</label>
        <textarea className="input" rows={4} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Complete visit"}</Button>
        {msg && <span style={{ fontSize: 13, color: "var(--danger)" }}>{msg}</span>}
      </div>
    </form>
  );
}

// --- tag picker: shows library as clickable chips, with a custom-add input ---
function TagPicker({
  title, library, picked, onPickLibrary, onAddCustom,
}: {
  title: string;
  library: { id: string; label: string }[];
  picked: string[];
  onPickLibrary: (id: string) => void;
  onAddCustom: (name: string) => void;
}) {
  const [custom, setCustom] = useState("");
  return (
    <div>
      <div className="label">{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {library.map(item => {
          const isPicked = picked.includes(item.label);
          return (
            <button key={item.id} type="button" onClick={() => onPickLibrary(item.id)}
              disabled={isPicked}
              className={`badge ${isPicked ? "badge-blue" : ""}`}
              style={{ cursor: isPicked ? "default" : "pointer", borderColor: isPicked ? "transparent" : "var(--border-strong)" }}>
              {item.label}{isPicked && " ✓"}
            </button>
          );
        })}
        {library.length === 0 && <span className="hint">(library empty — admin adds these)</span>}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input className="input" value={custom} onChange={e => setCustom(e.target.value)}
               placeholder={`Add custom ${title.toLowerCase()}`} style={{ maxWidth: 320 }} />
        <Button variant="outline" type="button" onClick={() => { onAddCustom(custom); setCustom(""); }}>Add</Button>
      </div>
    </div>
  );
}
