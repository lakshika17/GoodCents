import { useSyncExternalStore } from "react";
import type { VaultPayment, VaultSettings, VendorRequest } from "@/lib/vault";

// DEMO ONLY: in-memory Secure Spend Vault state for the sample-data provider. Resets on refresh; no money moves.
export interface VaultAudit { id: string; date: string; actor: string; action: string }
interface VaultState { settings: VaultSettings; payments: VaultPayment[]; requests: VendorRequest[]; audit: VaultAudit[] }

let state: VaultState = {
  settings: { allowance: 25000, dailyLimit: 3000, perTransactionLimit: 2000, frozen: false },
  payments: [],
  requests: [
    { id: "vr-1", requesterId: "EMP-004", vendor: "Sample Lab Instruments", amount: 860, reason: "Replacement pH meter (sample request)", date: "2026-11-02", status: "pending_manager", managerId: null },
  ],
  audit: [],
};
const listeners = new Set<() => void>();
let n = 0;
export const vaultId = (p: string) => `${p}-${Date.now().toString(36)}-${++n}`;

export function updateVault(fn: (s: VaultState) => VaultState, actor: string, action: string) {
  state = fn(state);
  state = { ...state, audit: [{ id: vaultId("au"), date: new Date().toISOString().slice(0, 16).replace("T", " "), actor, action }, ...state.audit] };
  listeners.forEach((l) => l());
}
export function useVault() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}
