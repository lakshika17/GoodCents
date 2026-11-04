import { useEffect, useRef, useState } from "react";
import { Camera, FileText, FileUp, Keyboard, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { readDocument } from "@/data/extraction.functions";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore } from "@/data/store";
import { CATEGORIES, type Category, type DetailSource } from "@/data/types";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_TODAY } from "@/data/seed";
import { DOCUMENT_TYPES, canSubmitForApproval, isDocumentType, isExpenseEligible, type DocumentType } from "@/lib/documents";
import { Field, NotConnected, nativeSelect } from "./shared";
import { ExtractionAttempt } from '@/lib/extraction-attempt';
import { calendarDate, moneyInCents } from '@/lib/expense-contract';

const ACCEPT = "image/jpeg,image/png,application/pdf";
const blank = (departmentId: string) => ({ documentType: "" as DocumentType | "", vendor: "", amount: "", currency: "", documentNumber: "", date: "", category: "Office" as Category, departmentId, projectId: "", description: "", paymentResponsibility: 'unknown' as 'unknown' | 'employee_paid' | 'company_paid' | 'unpaid_supplier' });

export function SubmitExpenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { currentUser, departments, projects, projectDepartments, submitExpense, saveDocument, mode, authenticatedDevelopment } = useStore();
  const read = useServerFn(readDocument);
  const aiAvailable = mode === "internal" || authenticatedDevelopment;
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState("");
  const [source, setSource] = useState<DetailSource>("manual");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);
  const [verified, setVerified] = useState(false);
  const [form, setForm] = useState(() => blank(currentUser.departmentId));
  const [paymentEvidenceConfirmed, setPaymentEvidenceConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const attempts = useRef(new ExtractionAttempt());
  const submissionKey = useRef(crypto.randomUUID());
  const uploadDone = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    attempts.current.select(); setReading(false);
    if (open) { setFile(null); setFileUrl(null); setPdfFailed(false); setVerified(false); setPaymentEvidenceConfirmed(false); setForm(blank(currentUser.departmentId)); setSource("manual"); setReadNote(""); submissionKey.current = crypto.randomUUID(); uploadDone.current = false; }
  }, [open, currentUser.departmentId]);
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  // Never pre-fill fields: automatic document reading is not connected, so every value is entered by a person.
  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type)) { toast.error("Please upload a JPG, PNG, or PDF document"); return; }
    if (submittingRef.current || uploadDone.current) { toast.error('Retry or resolve the current submission before replacing its attachment.'); return; }
    const attempt = attempts.current.select();
    setForm(blank(currentUser.departmentId)); setReading(false); setPaymentEvidenceConfirmed(false);
    setFile(f); setPdfFailed(false); setVerified(false); submissionKey.current = crypto.randomUUID();
    setFileUrl(URL.createObjectURL(f));
    setSource("manual"); setReadNote("");
    if (aiAvailable) void runRead(f, attempt);
  };
  const runRead = async (f: File, attempt: { selection: number; revision: number }) => {
    if (f.size > 10 * 1024 * 1024) { setReadNote("File is over 10 MB, so it can't be read automatically. Enter details manually."); return; }
    setReading(true);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const res = await Promise.race([read({ data: { fileName: f.name, mimeType: f.type as "application/pdf", base64: btoa(bin) } }), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('deadline')), 30_000))]);
      if (!attempts.current.current(attempt)) return;
      if (!attempts.current.canApply(attempt)) { setReadNote('Automatic reading finished after your edits. Your entries were kept; compare them with the document.'); return; }
      if (!res.ok) { setReadNote(res.error); return; }
      const d = res.data;
      setForm((s) => ({ ...s,
        documentType: d.documentType ?? s.documentType, vendor: d.counterparty ?? "", amount: d.amount != null ? String(d.amount) : "",
        currency: d.currency ?? "", date: d.date && calendarDate(d.date) ? d.date : "", documentNumber: d.documentNumber ?? "",
      }));
      setSource("ai");
      setReadNote(d.notes ? `Read by AI — check every field. ${d.notes}` : "Read by AI — check every field against the document.");
    } catch { if (attempts.current.current(attempt)) setReadNote("Automatic reading failed or timed out. Enter the details manually."); }
    finally { if (attempts.current.current(attempt)) setReading(false); }
  };
  const update = (patch: Partial<typeof form>) => { if (uploadDone.current || submittingRef.current) { toast.error('Retry the unchanged submission first.'); return; } attempts.current.edit(); setForm((s) => ({ ...s, ...patch })); setVerified(false); setSource((x) => (x === "ai" ? "ai_corrected" : x)); };

  const projectOptions = projects.filter((p) => projectDepartments.some((pd) => pd.projectId === p.id && pd.departmentId === form.departmentId));
  const amount = form.amount === "" ? null : Number(form.amount);
  const eligible = isExpenseEligible(form.documentType);
  const complete = !!form.vendor.trim() && amount !== null && moneyInCents(amount) && calendarDate(form.date) && !!form.currency;
  const canSubmit = canSubmitForApproval({ documentType: form.documentType, vendor: form.vendor, amount, date: form.date, verified, currency: form.currency, paymentResponsibility: form.paymentResponsibility, paymentEvidenceConfirmed }) && !!file && !reading;
  const canSaveDocument = !!form.documentType && !eligible && complete && verified;
  const isPdf = file?.type === "application/pdf";

  const record = (status: "draft" | "saved") => {
    if (!form.documentType) return;
    saveDocument({ documentType: form.documentType, status, vendor: form.vendor.trim(), amount: amount && amount > 0 ? amount : null, date: form.date, category: form.category, departmentId: form.departmentId, projectId: form.projectId || null, description: form.description, verified, currency: form.currency, source, documentNumber: form.documentNumber, fileName: file?.name ?? null, fileType: file?.type ?? null, previewUrl: fileUrl });
    if (mode === "demo") { toast.success(status === "draft" ? "Saved as draft — no approval requested" : `${form.documentType} saved — not counted as spending`); onOpenChange(false); }
  };

  const submit = async () => {
    if (submittingRef.current || !canSubmit || amount === null || !form.documentType) return;
    submittingRef.current = true; setSubmitting(true);
    let storagePath: string | undefined;
    try {
    if (mode === "internal" && file) {
      if (file.size > 10 * 1024 * 1024) { toast.error("Document must be 10 MB or smaller"); return; }
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      storagePath = `${data.user.id}/${submissionKey.current}`;
      if (!uploadDone.current) {
        const uploaded = await supabase.storage.from("private-receipts").upload(storagePath, file);
        if (uploaded.error && !['409','Duplicate'].includes(String(uploaded.error.statusCode))) throw uploaded.error;
        uploadDone.current = true;
      }
    }
    await submitExpense(
      { vendor: form.vendor.trim(), amount, date: form.date, category: form.category, departmentId: form.departmentId, projectId: form.projectId || null, description: form.description, documentType: form.documentType, documentNumber: form.documentNumber.trim() || null, verified, currency: form.currency, source, submissionKey: submissionKey.current, paymentResponsibility: form.paymentResponsibility, paymentEvidenceConfirmed },
      file ? { fileName: file.name, fileType: file.type, previewUrl: file.type.startsWith("image/") || isPdf ? fileUrl : null, extractionSimulated: false, storagePath } : undefined,
    );
    toast.success(mode === "demo" ? "Expense submitted for approval (demo)" : "Expense submitted for approval");
    onOpenChange(false);
    } catch (error) {
      if (mode === 'internal' && storagePath) {
        const status = await supabase.rpc('submission_status', { submission_key: submissionKey.current });
        const result = status.data as { committed?: boolean } | null;
        if (!status.error && result?.committed) { toast.success('Submission recovered — saved once.'); onOpenChange(false); return; }
        // Leave the attachment in place on uncertain outcomes. Explicit cancellation locks the key before any cleanup.
      }
      toast.error(error instanceof Error ? error.message : 'Submission could not be confirmed. Retry without changing the document.');
    } finally { submittingRef.current = false; setSubmitting(false); }
  };
  const cancelSubmission = async () => {
    if (submittingRef.current) return;
    if (mode === 'internal' && uploadDone.current) {
      const cancelled = await supabase.rpc('cancel_expense_submission', { submission_key: submissionKey.current });
      if (cancelled.error || cancelled.data !== true) { toast.error('Submission may already be saved. Its attachment was not deleted.'); return; }
      const identity = await supabase.auth.getUser();
      if (!identity.data.user) return;
      const removed = await supabase.storage.from('private-receipts').remove([`${identity.data.user.id}/${submissionKey.current}`]);
      if (removed.error) { toast.error('Cancelled safely; attachment cleanup is still pending.'); return; }
    }
    uploadDone.current = false; onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={value => { if (!value && (submittingRef.current || uploadDone.current)) { toast.error('Retry or cancel this submission before closing.'); return; } onOpenChange(value); }}>
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
              <Button variant="outline" size="sm" disabled={submitting || uploadDone.current} onClick={() => { attempts.current.select(); setReading(false); setFile(null); setFileUrl(null); setVerified(false); setPaymentEvidenceConfirmed(false); setForm(blank(currentUser.departmentId)); setSource('manual'); setReadNote(''); }}><Keyboard className="h-4 w-4" />Type manually</Button>
            </div>
            {aiAvailable
              ? <p className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">{reading ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading document with AI…</span> : readNote || "Uploaded documents are read with AI. You check and correct every field before saving."}</p>
              : <NotConnected>Automatic reading needs a verified sign-in and is off in this sample demo. Fields stay blank — enter them from the document.</NotConnected>}
            <NotConnected><MessageCircle className="mr-1 inline h-3 w-3" />WhatsApp, Google Chat and SMS submission are planned and not connected yet.</NotConnected>
          </div>
          <div className="grid content-start gap-3">
            <Field label="Document type">
              <select aria-label="Document type" className={nativeSelect} value={form.documentType} onChange={(e) => update({ documentType: isDocumentType(e.target.value) ? e.target.value : "" })}>
                <option value="">Select document type…</option>
                {DOCUMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" />Details: {source === "ai" ? "AI-extracted" : source === "ai_corrected" ? "AI-extracted, corrected by you" : "Manually entered"} · {verified ? "verified" : "unverified"}</p>
            {form.documentType && (
              <p className="rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
                {eligible ? (form.currency === "USD" ? "This can be submitted for expense approval once verified." : "Only USD documents can be submitted for approval right now; save non-USD documents as a draft.") : `${form.documentType}s are saved separately. They never enter the approval queue or count toward spending or reimbursements.`}
              </p>
            )}
            <Field label={eligible || !form.documentType ? "Vendor" : "Company / vendor"}><Input value={form.vendor} onChange={(e) => update({ vendor: e.target.value })} placeholder="As shown on the document" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount"><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => update({ amount: e.target.value })} /></Field>
              <Field label="Currency"><Input maxLength={3} value={form.currency} onChange={(e) => update({ currency: e.target.value.toUpperCase() })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Document number"><Input value={form.documentNumber} onChange={(e) => update({ documentNumber: e.target.value })} placeholder="Optional" /></Field>
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
            {eligible && <><Field label="Payment responsibility"><select aria-label="Payment responsibility" className={nativeSelect} value={form.paymentResponsibility} onChange={e => update({ paymentResponsibility: e.target.value as typeof form.paymentResponsibility })}><option value="unknown">Unknown — needs clarification</option><option value="employee_paid">I personally paid</option><option value="company_paid">Company already paid</option><option value="unpaid_supplier">Supplier is not paid</option></select></Field><label className="flex items-start gap-2 text-sm"><Checkbox aria-label="Payment evidence confirmed" checked={paymentEvidenceConfirmed} disabled={submitting || uploadDone.current} onCheckedChange={v => { setPaymentEvidenceConfirmed(v === true); setVerified(false); }} />The attached document includes evidence of my personal payment.</label></>}
            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <Checkbox checked={verified} disabled={!complete || !form.documentType || reading} onCheckedChange={(v) => setVerified(v === true)} aria-label="I verified these details" />
              <span>I checked the type, vendor, amount and date against the document.{(!complete || !form.documentType) && <span className="block text-xs text-muted-foreground">Fill in the type, vendor, amount and date first.</span>}</span>
            </label>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              <Button variant="outline" disabled={!form.documentType || submitting || uploadDone.current} onClick={() => record("draft")}>Save as draft</Button>
              {eligible || !form.documentType
                ? <Button onClick={() => void submit()} disabled={!canSubmit || submitting}>{submitting ? 'Submitting…' : 'Submit for approval'}</Button>
                : <Button onClick={() => record("saved")} disabled={!canSaveDocument}>Save {form.documentType}</Button>}
            </div>
            {uploadDone.current && <Button variant="outline" disabled={submitting} onClick={() => void cancelSubmission()}>Cancel submission safely</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
