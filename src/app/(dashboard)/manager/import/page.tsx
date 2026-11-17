import { AlertCircle, ArrowRight, CheckCircle2, FileSearch, Import, Link2, TableProperties } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const steps = [
  { label: 'Source', description: 'Paste a private Google Sheet URL', icon: Link2, state: 'current' },
  { label: 'Preview', description: 'Inspect rows before any changes', icon: FileSearch, state: 'upcoming' },
  { label: 'Map fields', description: 'Match sheet columns to student fields', icon: TableProperties, state: 'upcoming' },
  { label: 'Validate & import', description: 'Resolve errors and confirm the import', icon: CheckCircle2, state: 'upcoming' },
] as const;

export default function StudentImportPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10 animate-fade-up">
      <div>
        <Badge variant="outline" className="mb-3 rounded-full text-[10px] uppercase tracking-wider">Manager workflow</Badge>
        <h1 className="text-2xl font-black tracking-tight">Import student data</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A safe preview, mapping, and validation workflow for importing existing student records from a private Google Sheet.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => (
          <Card key={step.label} className={step.state === 'current' ? 'border-0 bg-primary text-primary-foreground ring-0' : 'border-0 ring-1 ring-border'}>
            <CardContent className="px-4">
              <div className="flex items-center justify-between"><step.icon className="h-4 w-4" /><span className="text-[10px] font-black opacity-70">0{index + 1}</span></div>
              <p className="mt-4 text-sm font-bold">{step.label}</p>
              <p className="mt-1 text-[10px] leading-4 opacity-70">{step.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="gap-5 border-0 py-6 shadow-sm ring-1 ring-border">
        <CardHeader className="px-6">
          <CardTitle className="flex items-center gap-2 font-bold"><Import className="h-5 w-5 text-primary" /> Connect source sheet</CardTitle>
          <p className="text-xs text-muted-foreground">This interface is ready for a Google Sheets API import connection. No external data is read yet.</p>
        </CardHeader>
        <CardContent className="space-y-5 px-6">
          <div>
            <label htmlFor="sheet-url" className="text-xs font-bold">Google Sheet URL</label>
            <div className="mt-2 flex h-11 items-center rounded-xl border border-dashed border-border bg-muted/35 px-3 text-xs text-muted-foreground" id="sheet-url">https://docs.google.com/spreadsheets/d/••••••••••••</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="text-xs font-bold">Student batch</label><div className="mt-2 flex h-11 items-center justify-between rounded-xl border px-3 text-xs"><span>Select a destination batch</span><span className="text-muted-foreground">Required</span></div></div>
            <div><label className="text-xs font-bold">Worksheet</label><div className="mt-2 flex h-11 items-center justify-between rounded-xl border px-3 text-xs"><span>Detected after connection</span><span className="text-muted-foreground">Automatic</span></div></div>
          </div>
          <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-800 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p className="text-xs leading-5">The final integration will request access through the signed-in Google account and keep each operational spreadsheet private.</p></div>
          <div className="flex justify-end"><Button disabled className="h-10 gap-2 rounded-xl px-4">Connect and preview <ArrowRight className="h-4 w-4" /></Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
