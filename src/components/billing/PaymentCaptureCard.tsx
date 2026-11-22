import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invoiceTotals, naira, PAYMENT_METHODS, type InvoiceItem } from "@/lib/accounting";
import { amountToCollect, type PaymentCapture } from "@/lib/billing";

export function PaymentCaptureCard({ items, value, onChange }: { items: InvoiceItem[]; value: PaymentCapture; onChange: (c: PaymentCapture) => void }) {
  const t = invoiceTotals(items, value.discount);
  const set = <K extends keyof PaymentCapture>(k: K, v: PaymentCapture[K]) => onChange({ ...value, [k]: v });
  const now = amountToCollect(value, t.total);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Bill & payment</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="max-h-40 overflow-auto divide-y divide-border">
          {items.length === 0 && <p className="text-muted-foreground text-xs">No items yet.</p>}
          {items.map((i, n) => (
            <div key={n} className="flex justify-between py-1"><span className="truncate pr-2">{i.description}</span><span>{naira(i.unit_price * i.quantity)}</span></div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Discount (₦)</Label><Input type="number" min={0} value={value.discount || ""} onChange={(e) => set("discount", Number(e.target.value) || 0)} /></div>
          <div><Label>Payment</Label>
            <Select value={value.mode} onValueChange={(v) => set("mode", v as PaymentCapture["mode"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="full">Full payment</SelectItem><SelectItem value="partial">Part payment</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem></SelectContent>
            </Select>
          </div>
          {value.mode === "partial" && <div><Label>Amount paid (₦)</Label><Input type="number" min={0} value={value.amount || ""} onChange={(e) => set("amount", Number(e.target.value) || 0)} /></div>}
          {value.mode !== "unpaid" && <>
            <div><Label>Method</Label>
              <Select value={value.method} onValueChange={(v) => set("method", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Reference</Label><Input value={value.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Optional" /></div>
          </>}
        </div>
        <div className="border-t border-border pt-2 space-y-1">
          <div className="flex justify-between"><span>Total</span><b>{naira(t.total)}</b></div>
          <div className="flex justify-between"><span>Paying now</span><span>{naira(now)}</span></div>
          <div className="flex justify-between text-destructive"><span>Balance</span><span>{naira(t.total - now)}</span></div>
        </div>
      </CardContent>
    </Card>
  );
}
