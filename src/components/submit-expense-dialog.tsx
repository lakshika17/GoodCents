import { useEffect, useRef, useState } from "react";
import { Camera, FileText, FileUp, Keyboard, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/data/store";
import { CATEGORIES, type Category } from "@/data/types";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_TODAY } from "@/data/seed";
import { DOCUMENT_TYPES, canSubmitForApproval, isDocumentType, isExpenseEligible, type DocumentType } from "@/lib/documents";
import { Field, NotConnected, nativeSelect } from "./shared";

const ACCEPT = "image/jpeg,image/png,application/pdf";
const blank = (departmentId: string) => ({ documentType: "" as DocumentType | "", vendor: "", amount: "", date: "", category: "Office" as Category, departmentId, projectId: "", description: "" });

export function SubmitExpenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { currentUser, departments, projects, projectDepartments, submitExpense, saveDocument, mode } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);
  const [verified, setVerified] = useState(false);
  const [form, setForm] = useState(() => blank(currentUser.departmentId));
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setFile(null); setFileUrl(null); setPdfFailed(false); setVerified(false); setForm(blank(currentUser.departmentId)); }
  }, [open, currentUser.departmentId]);

  // Never pre-fill fields: automatic document reading is not connected, so every value is entered by a person.
  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type)) { toast.error("Please upload a JPG, PNG, or PDF document"); return; }
    setFile(f); setPdfFailed(false); setVerified(false);
    setFileUrl(URL.createObjectURL(f));
  };
  const update = (patch: Partial<typeof form>) => { setForm((s) => ({ ...s, ...patch })); setVerified(false); };

  const projectOptions = projects.filter((p) => projectDepartments.some((pd) => pd.projectId === p.id && pd.departmentId === form.departmentId));
  const amount = form.amount === "" ? null : parseFloat(form.amount);
  const eligible = isExpenseEligible(form.documentType);
  const complete = !!form.vendor.trim() && amount !== null && amount > 0 && !!form.date;
  const canSubmit = canSubmitForApproval({ documentType: form.documentType, vendor: form.vendor, amount, date: form.date, verified });
  const canSaveDocument = !!form.documentType && !eligible && complete && verified;
  const isPdf = file?.type === "application/pdf";

  const record = (status: "draft" | "saved") => {
    if (!form.documentType) return;
    saveDocument({ documentType: form.documentType, status, vendor: form.vendor.trim(), amount: amount && amount > 0 ? amount : null, date: form.date, category: form.category, departmentId: form.departmentId, projectId: form.projectId || null, description: form.description, verified, fileName: file?.name ?? null, fileType: file?.type ?? null, previewUrl: fileUrl });
    if (mode === "demo") { toast.success(status === "draft" ? "Saved as draft — no approval requested" : `${form.documentType} saved — not counted as spending`); onOpenChange(false); }
  };

  const submit = async () => {
    if (!canSubmit || amount === null || !form.documentType) return;
    let storagePath: string | undefined;
    if (mode === "internal" && file) {
      if (file.size > 10 * 1024 * 1024) { toast.error("Document must be 10 MB or smaller"); return; }
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      storagePath = `${data.user.id}/${crypto.randomUUID()}`;
      const uploaded = await supabase.storage.from("private-receipts").upload(storagePath, file);
      if (uploaded.error) { toast.error(uploaded.error.message); return; }
    }
    await submitExpense(
      { vendor: form.vendor.trim(), amount, date: form.date, category: form.category, departmentId: form.departmentId, projectId: form.projectId || null, description: form.description, documentType: form.documentType, verified },
      file ? { fileName: file.name, fileType: file.type, previewUrl: file.type.startsWith("image/") || isPdf ? fileUrl : null, extractionSimulated: false, storagePath } : undefined,
    );
    toast.success(mode === "demo" ? "Expense submitted for approval (demo)" : "Expense submitted for approval");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>Upload a document, choose its type, then enter and verify the details.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-[1fr_1.2fr]">
          <div className="grid content-start gap-3">
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            {file && isPdf && fileUrl && !pdfFailed ? (
              <div className="grid gap-2">
                <object data={fileUrl} type="application/pdf" aria-label={`Preview of ${file.name}`} className="aspect-[3/4] w-full rounded-xl border bg-muted" onError={() => setPdfFailed(true)}>
                  <p className="p-4 text-sm text-muted-foreground">PDF preview is unavailable in this browser. <a className="text-primary underline" href={fileUrl} target="_blank" rel="noreferrer">Open the PDF in a new tab</a>.</p>
                </object>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span className="truncate">{file.name}</span><button className="text-primary" onClick={() => fileRef.current?.click()}>Replace</button></div>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} className="grid aspect-[4/3] place-items-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/50 text-center transition-colors hover:border-primary/40">
                {file && fileUrl && file.type.startsWith("image/") ? <img src={fileUrl} alt="Document preview" className="h-full w-full object-cover" /> : file ? (
                  <span className="grid justify-items-center gap-2 p-4 text-sm"><FileText className="h-6 w-6 text-primary" />{file.name}<span className="text-xs text-muted-foreground">Preview unavailable for this file</span></span>
                ) : (
                  <span className="grid justify-items-center gap-2 p-4 text-sm text-muted-foreground"><FileUp className="h-6 w-6 text-primary" />Upload document<span className="text-xs">JPG, PNG or PDF</span></span>
                )}
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => camRef.current?.click()}><Camera className="h-4 w-4" />Camera</Button>
              <Button variant="outline" size="sm" onClick={() => { setFile(null); setFileUrl(null); setVerified(false); }}><Keyboard className="h-4 w-4" />Type manually</Button>
            </div>
            <NotConnected>Automatic reading of documents is not connected. Fields stay blank — enter them from the document.</NotConnected>
            <NotConnected><MessageCircle className="mr-1 inline h-3 w-3" />WhatsApp, Google Chat and SMS submission are planned and not connected yet.</NotConnected>
          </div>
          <div className="grid content-start gap-3">
            <Field label="Document type">
              <select aria-label="Document type" className={nativeSelect} value={form.documentType} onChange={(e) => update({ documentType: isDocumentType(e.target.value) ? e.target.value : "" })}>
                <option value="">Select document type…</option>
                {DOCUMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            {form.documentType && (
              <p className="rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
                {eligible ? "This can be submitted for expense approval once verified." : `${form.documentType}s are saved separately. They never enter the approval queue or count toward spending or reimbursements.`}
              </p>
            )}
            <Field label={eligible || !form.documentType ? "Vendor" : "Company / vendor"}><Input value={form.vendor} onChange={(e) => update({ vendor: e.target.value })} placeholder="As shown on the document" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (USD)"><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => update({ amount: e.target.value })} /></Field>
              <Field label="Document date"><Input type="date" value={form.date} onChange={(e) => update({ date: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select className={nativeSelect} value={form.category} onChange={(e) => update({ category: e.target.value as Category })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Department">
                <select className={nativeSelect} value={form.departmentId} onChange={(e) => update({ departmentId: e.target.value, projectId: "" })}>
                  {departments.filter(d => mode === "demo" || d.id === currentUser.departmentId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Project (optional)">
              <select className={nativeSelect} value={form.projectId} onChange={(e) => update({ projectId: e.target.value })}>
                <option value="">No project</option>
                {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Note (optional)"><Input value={form.description} onChange={(e) => update({ description: e.target.value })} /></Field>
            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <Checkbox checked={verified} disabled={!complete || !form.documentType} onCheckedChange={(v) => setVerified(v === true)} aria-label="I verified these details" />
              <span>I checked the type, vendor, amount and date against the document.{(!complete || !form.documentType) && <span className="block text-xs text-muted-foreground">Fill in the type, vendor, amount and date first.</span>}</span>
            </label>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <Button variant="outline" disabled={!form.documentType} onClick={() => record("draft")}>Save as draft</Button>
              {eligible || !form.documentType
                ? <Button onClick={submit} disabled={!canSubmit}>Submit for approval</Button>
                : <Button onClick={() => record("saved")} disabled={!canSaveDocument}>Save {form.documentType}</Button>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
