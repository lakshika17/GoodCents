import { useEffect, useRef, useState } from "react";
import { Camera, FileUp, Keyboard, MessageCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/data/store";
import { CATEGORIES, type Category } from "@/data/types";
import { DEMO_TODAY } from "@/data/seed";
import { DemoBadge, Field, NotConnected, nativeSelect } from "./shared";

const ACCEPT = "image/jpeg,image/png,application/pdf";

export function SubmitExpenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { currentUser, departments, projects, projectDepartments, submitExpense } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState(false);
  const [form, setForm] = useState({ vendor: "", amount: "", date: DEMO_TODAY, category: "Office" as Category, departmentId: currentUser.departmentId, projectId: "", description: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setFile(null); setPreview(null); setExtracted(false); setForm((f) => ({ ...f, vendor: "", amount: "", description: "", departmentId: currentUser.departmentId, projectId: "" })); }
  }, [open, currentUser.departmentId]);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type)) { toast.error("Please upload a JPG, PNG, or PDF receipt"); return; }
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    // Simulated extraction: placeholder values so the review flow can be tested. Not real AI output.
    const seed = f.name.length + f.size;
    setForm((s) => ({ ...s, vendor: "NorthLab Supply Co.", amount: (40 + (seed % 900)).toFixed(2), category: "Lab Supplies", description: "Extracted (simulated) — please verify" }));
    setExtracted(true);
  };

  const projectOptions = projects.filter((p) => projectDepartments.some((pd) => pd.projectId === p.id && pd.departmentId === form.departmentId));
  const amount = parseFloat(form.amount);
  const valid = form.vendor.trim() && amount > 0 && form.date;

  const submit = () => {
    if (!valid) return;
    submitExpense(
      { vendor: form.vendor.trim(), amount, date: form.date, category: form.category, departmentId: form.departmentId, projectId: form.projectId || null, description: form.description },
      file ? { fileName: file.name, fileType: file.type, previewUrl: preview, extractionSimulated: extracted } : undefined,
    );
    toast.success("Expense submitted for approval (demo)");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Submit expense</DialogTitle>
          <DialogDescription>Drop a receipt or type the basics — that's it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-[1fr_1.2fr]">
          <div className="grid content-start gap-3">
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <button onClick={() => fileRef.current?.click()} className="grid aspect-[4/3] place-items-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/50 text-center transition-colors hover:border-primary/40">
              {preview ? <img src={preview} alt="Receipt preview" className="h-full w-full object-cover" /> : file ? (
                <span className="text-sm text-foreground">{file.name}</span>
              ) : (
                <span className="grid justify-items-center gap-2 p-4 text-sm text-muted-foreground"><FileUp className="h-6 w-6 text-primary" />Upload receipt<span className="text-xs">JPG, PNG or PDF</span></span>
              )}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => camRef.current?.click()}><Camera className="h-4 w-4" />Camera</Button>
              <Button variant="outline" size="sm" onClick={() => { setFile(null); setPreview(null); setExtracted(false); }}><Keyboard className="h-4 w-4" />Type manually</Button>
            </div>
            <NotConnected><MessageCircle className="mr-1 inline h-3 w-3" />WhatsApp, Google Chat and SMS submission are planned and not connected yet.</NotConnected>
          </div>
          <div className="grid content-start gap-3">
            {extracted && (
              <div className="flex items-center justify-between rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
                <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />Extraction preview — please check</span>
                <DemoBadge>Simulated, not real AI</DemoBadge>
              </div>
            )}
            <Field label="Vendor"><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Green Fork Cafe" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (USD)"><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
              <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select className={nativeSelect} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Department">
                <select className={nativeSelect} value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value, projectId: "" })}>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Project (optional)">
              <select className={nativeSelect} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">No project</option>
                {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Note (optional)"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Button onClick={submit} disabled={!valid} className="mt-1">Submit for approval</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
