import QRCode from "qrcode";
import { balanceDue, naira, type Invoice } from "@/lib/accounting";
import { SITE } from "@/lib/site";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Print an invoice receipt as an 80mm thermal slip or an A4 page with a verification QR code. */
export async function printReceipt(inv: Invoice, format: "80mm" | "A4" = "80mm") {
  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) return false;
  const site = SITE as any;
  const qr = format === "A4" ? await QRCode.toDataURL(`${window.location.origin}/results?ref=${encodeURIComponent(inv.reference ?? inv.invoice_number)}&inv=${encodeURIComponent(inv.invoice_number)}`, { margin: 1, width: 140 }) : "";
  const rows = (inv.invoice_items ?? []).map((i) => `<tr><td>${esc(i.description)}${i.quantity > 1 ? ` ×${i.quantity}` : ""}</td><td class="r">${naira(i.quantity * i.unit_price)}</td></tr>`).join("");
  const pays = (inv.payments ?? []).map((p) => `<tr><td>${esc(p.method)} ${new Date(p.created_at).toLocaleString()}</td><td class="r">${naira(p.amount)}</td></tr>`).join("");
  const css = format === "80mm"
    ? "@page{size:80mm auto;margin:3mm}body{width:74mm;font:11px monospace}"
    : "@page{size:A4;margin:15mm}body{font:13px sans-serif}h1{font-size:20px}";
  w.document.write(`<!doctype html><html><head><title>${esc(inv.invoice_number)}</title><style>${css}table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}.r{text-align:right}hr{border:0;border-top:1px dashed #000}.c{text-align:center}</style></head><body>
  <div class="c"><h1 style="margin:0">${esc(site.name ?? "Receipt")}</h1><div>${esc(site.address ?? "")}</div><div>${esc(site.phone ?? "")}</div></div><hr>
  <div>Receipt: <b>${esc(inv.invoice_number)}</b></div><div>Date: ${new Date(inv.created_at).toLocaleString()}</div>
  <div>Patient: ${esc(inv.patient_name)}</div>${inv.reference ? `<div>Ref: ${esc(inv.reference)}</div>` : ""}<hr>
  <table>${rows}</table><hr>
  <table><tr><td>Subtotal</td><td class="r">${naira(inv.subtotal)}</td></tr><tr><td>Discount</td><td class="r">${naira(inv.discount)}</td></tr>
  <tr><td><b>Total</b></td><td class="r"><b>${naira(inv.total)}</b></td></tr><tr><td>Paid</td><td class="r">${naira(inv.amount_paid)}</td></tr>
  <tr><td><b>Balance</b></td><td class="r"><b>${naira(balanceDue(inv))}</b></td></tr></table>
  ${pays ? `<hr><table>${pays}</table>` : ""}<hr><div class="c">Status: ${esc(inv.status)}</div>
  ${qr ? `<div class="c" style="margin-top:12px"><img src="${qr}" width="140"><div>Scan to verify</div></div>` : ""}
  <div class="c">Thank you</div><script>window.onload=()=>{window.print()}</script></body></html>`);
  w.document.close();
  return true;
}
