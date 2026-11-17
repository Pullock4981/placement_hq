'use client';

export interface RecordToolUsageClientPayload {
  toolId: string;
  toolName: string;
  actionType: 'single_audit' | 'batch_audit';
  candidateCount?: number;
  userName?: string;
  userEmail?: string;
  userRole?: 'admin' | 'manager' | 'mentor';
  notes?: string;
}

export async function logRealToolUsage(payload: RecordToolUsageClientPayload): Promise<void> {
  try {
    await fetch('/api/admin/tools-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Non-blocking telemetry
    console.warn('[tools-usage] Could not log tool usage:', err);
  }
}
