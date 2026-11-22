import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { SITE } from "@/lib/site";
import { naira, tillVariance } from "@/lib/accounting";

const db = supabase as any;

interface Closeout {
  id: string; close_date: string; expected_cash: number; expected_pos: number; expected_transfer: number; expected_hmo: number;
  cash_expenses: number; counted_cash: number; variance: number; notes: string | null; cashier_name: string | null; manager_name: string | null; created_at: string;
}

function printSheet(c: Omit<Closeout, "id" | "created_at">) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  const v = tillVariance(c.expected_cash, c.cash_expenses, c.counted_cash);
  const row = (l: string, n: number, b = false) => `<tr><td>${b ? "<b>" + l + "</b>" : l}</td><td style="text-align:right">${b ? "<b>" + naira(n) + "</b>" : naira(n)}</td></tr>`;
  w.document.write(`<html><head><title>Till closeout ${c.close_date}</title><style>body{font-family:sans-serif;padding:32px;max-width:680px;margin:auto}table{width:100%;border-collapse:collapse}td{padding:6px;border-bottom:1px solid #ddd}.sig{display:flex;gap:40px;margin-top:60px}.sig div{flex:1;border-top:1px solid #000;padding-top:6px;font-size:12px}</style></head><body>
  <h2 style="margin:0">${SITE.name ?? "Lab"}</h2><div>${SITE.address ?? ""}</div><hr/>
  <h3>Daily till closeout — ${c.close_date}</h3>
  <table>${row("Cash collected", c.expected_cash)}${row("POS collected", c.expected_pos)}${row("Bank transfers", c.expected_transfer)}${row("HMO / corporate", c.expected_hmo)}${row("Total collected", c.expected_cash + c.expected_pos + c.expected_transfer + c.expected_hmo, true)}</table><br/>
  <table>${row("Cash expenses paid out", c.cash_expenses)}${row("Expected cash in drawer", v.expected, true)}${row("Cash counted", c.counted_cash, true)}${row(`Variance (${v.status})`, v.variance, true)}</table>
  ${c.notes ? `<p><b>Notes:</b> ${c.notes}</p>` : ""}
  <div class="sig"><div>Duty receptionist: ${c.cashier_name ?? ""}<br/>Signature &amp; date</div><div>Verified by lab manager: ${c.manager_name ?? ""}<br/>Signature &amp; date</div></div>
  <script>window.print()</script></body></html>`);
  w.document.close();
}

export default function TillCloseout({ byMethod, cashExpenses, today, isCurrentMonth }: {
  byMethod: [string, number][]; cashExpenses: number; today: string; isCurrentMonth: boolean;
}) {
  const qc = useQueryClient(); const { user, profile } = useAuth();
  const get = (m: string) => byMethod.find(([k]) => k === m)?.[1] ?? 0;
  const exp = { cash: get("Cash"), pos: get("POS"), transfer: get("Transfer"), hmo: get("HMO") };
  const [counted, setCounted] = useState("");
  const [cashier, setCashier] = useState((profile as any)?.display_name ?? "");
  const [manager, setManager] = useState("");
  const [notes, setNotes] = useState("");
  const v = tillVariance(exp.cash, cashExpenses, Number(counted || 0));

  const history = useQuery({
    queryKey: ["accounting", "closeouts"],
    queryFn: async () => {
      const { data, error } = await db.from("till_closeouts").select("*").order("created_at", { ascending: false }).limit(30);
      if (error) throw error; return data as Closeout[];
    },
  });

  const record = () => ({
    close_date: today, expected_cash: exp.cash, expected_pos: exp.pos, expected_transfer: exp.transfer, expected_hmo: exp.hmo,
    cash_expenses: cashExpenses, counted_cash: Number(counted || 0), variance: v.variance, notes: notes || null,
    cashier_name: cashier || null, manager_name: manager || null,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (counted === "") throw new Error("Enter the cash you counted");
      const { error } = await db.from("till_closeouts").insert({ ...record(), closed_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Till closed" }); qc.invalidateQueries({ queryKey: ["accounting", "closeouts"] }); printSheet(record()); setCounted(""); setNotes(""); },
    onError: (e: any) => toast({ title: "Could not close till", description: e.message, variant: "destructive" }),
  });

  const tone = v.status === "Balanced" ? "default" : v.status === "Overage" ? "secondary" : "destructive";

  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle className="text-base">Day-end closeout ({today})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!isCurrentMonth && <p className="text-sm text-muted-foreground">Switch to the current month to see today's totals.</p>}
          <Table><TableBody>
            <TableRow><TableCell>Cash</TableCell><TableCell className="text-right">{naira(exp.cash)}</TableCell></TableRow>
            <TableRow><TableCell>POS terminal</TableCell><TableCell className="text-right">{naira(exp.pos)}</TableCell></TableRow>
            <TableRow><TableCell>Bank transfer</TableCell><TableCell className="text-right">{naira(exp.transfer)}</TableCell></TableRow>
            <TableRow><TableCell>HMO / corporate</TableCell><TableCell className="text-right">{naira(exp.hmo)}</TableCell></TableRow>
            <TableRow><TableCell>Less cash expenses paid out today</TableCell><TableCell className="text-right">-{naira(cashExpenses)}</TableCell></TableRow>
            <TableRow><TableCell className="font-bold">Expected cash in drawer</TableCell><TableCell className="text-right font-bold">{naira(v.expected)}</TableCell></TableRow>
          </TableBody></Table>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><Label htmlFor="counted">Cash counted (₦)</Label><Input id="counted" type="number" value={counted} onChange={(e) => setCounted(e.target.value)} /></div>
            <div><Label htmlFor="cashier">Duty receptionist</Label><Input id="cashier" value={cashier} onChange={(e) => setCashier(e.target.value)} /></div>
            <div><Label htmlFor="manager">Verifying manager</Label><Input id="manager" value={manager} onChange={(e) => setManager(e.target.value)} /></div>
          </div>
          <div><Label htmlFor="tnotes">Notes</Label><Input id="tnotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Explain any shortage or overage" /></div>
          {counted !== "" && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={tone as any}>{v.status}</Badge>
              <span className={v.variance < 0 ? "text-destructive font-semibold" : "font-semibold"}>{v.variance > 0 ? "+" : ""}{naira(v.variance)}</span>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending || !isCurrentMonth}><Lock className="h-4 w-4 mr-1" />Close till & print sheet</Button>
          </div>
        </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Past closeouts</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Receptionist</TableHead><TableHead className="text-right">Expected cash</TableHead><TableHead className="text-right">Counted</TableHead><TableHead className="text-right">Variance</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(history.data ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No closeouts yet.</TableCell></TableRow>}
              {(history.data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.close_date}</TableCell><TableCell>{c.cashier_name}</TableCell>
                  <TableCell className="text-right">{naira(Number(c.expected_cash) - Number(c.cash_expenses))}</TableCell>
                  <TableCell className="text-right">{naira(c.counted_cash)}</TableCell>
                  <TableCell className={`text-right ${Number(c.variance) < 0 ? "text-destructive" : ""}`}>{naira(c.variance)}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" aria-label="Reprint sheet" onClick={() => printSheet(c)}><Printer className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
    </div>
  );
}
