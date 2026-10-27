"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createWithdrawal } from "@/app/actions/withdraw";
import { thDate } from "@/lib/format";
import { pad } from "@/lib/layout";

export type StockRow = {
  stockId: number;
  code: string;
  rack: string;
  bay: number;
  level: number;
  qty: number;
  receivedAt: string;
  productId: number;
  name: string;
  sku: string;
  unit: string;
  customerId: number;
  customer: string;
};

export function WithdrawBuilder({ customers, rows, initialCodes }: {
  customers: { id: number; name: string }[];
  rows: StockRow[];
  initialCodes: string[];
}) {
  const router = useRouter();
  // ถ้ามาจากผังคลัง (?codes=...) เลือกลูกค้าและตำแหน่งให้ล่วงหน้า
  const initial = useMemo(() => {
    const first = rows.find((r) => initialCodes.includes(r.code));
    if (!first) return { customerId: null as number | null, take: {} as Record<number, number>, ignored: initialCodes };
    const take: Record<number, number> = {};
    for (const r of rows) if (r.customerId === first.customerId && initialCodes.includes(r.code)) take[r.stockId] = r.qty;
    const used = new Set(rows.filter((r) => take[r.stockId]).map((r) => r.code));
    return { customerId: first.customerId, take, ignored: initialCodes.filter((c) => !used.has(c)) };
  }, [rows, initialCodes]);

  const [customerId, setCustomerId] = useState<number | null>(initial.customerId);
  const [take, setTake] = useState<Record<number, number>>(initial.take);
  const [want, setWant] = useState<Record<number, string>>({});
  const [open, setOpen] = useState<Set<number>>(() => new Set(rows.filter((r) => initial.take[r.stockId]).map((r) => r.productId)));
  const [warn, setWarn] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const mine = rows.filter((r) => r.customerId === customerId);
  const groups = useMemo(() => {
    const m = new Map<number, { productId: number; name: string; sku: string; unit: string; rows: StockRow[]; total: number }>();
    for (const r of mine) {
      const g = m.get(r.productId) ?? { productId: r.productId, name: r.name, sku: r.sku, unit: r.unit, rows: [], total: 0 };
      g.rows.push(r); // rows มาเรียงตามวันที่รับเข้าแล้ว (เข้าก่อนอยู่บน)
      g.total += r.qty;
      m.set(r.productId, g);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [mine]);
  const f = filter.trim().toLowerCase();
  const shown = f ? groups.filter((g) => g.name.toLowerCase().includes(f) || g.sku.toLowerCase().includes(f)) : groups;

  const lines = mine.filter((r) => take[r.stockId] > 0).sort((a, b) => a.code.localeCompare(b.code));
  const positions = new Set(lines.map((l) => l.code)).size;
  const totals = new Map<string, number>();
  for (const l of lines) totals.set(`${l.name} (${l.unit})`, (totals.get(`${l.name} (${l.unit})`) ?? 0) + take[l.stockId]);

  function pickCustomer(id: number | null) {
    setCustomerId(id);
    setTake({});
    setWant({});
    setWarn({});
    setOpen(new Set());
    setConfirming(false);
    setError("");
  }

  function setLine(r: StockRow, n: number | null) {
    setConfirming(false);
    setTake((t) => {
      const next = { ...t };
      if (n === null || n <= 0) delete next[r.stockId];
      else next[r.stockId] = Math.min(r.qty, Math.floor(n));
      return next;
    });
  }

  // เลือกตำแหน่งให้อัตโนมัติ: หยิบจากของที่รับเข้าก่อน จนได้ครบจำนวน
  function autoFill(g: (typeof groups)[number]) {
    let left = Math.floor(Number(want[g.productId]));
    if (!(left > 0)) return;
    const next = { ...take };
    for (const r of g.rows) delete next[r.stockId];
    for (const r of g.rows) {
      if (left <= 0) break;
      const n = Math.min(r.qty, left);
      next[r.stockId] = n;
      left -= n;
    }
    setTake(next);
    setWarn({ ...warn, [g.productId]: left > 0 ? `มีไม่พอ ขาดอีก ${left} ${g.unit} (มีทั้งหมด ${g.total})` : "" });
    setOpen(new Set(open).add(g.productId));
    setConfirming(false);
  }

  function toggleOpen(id: number) {
    const s = new Set(open);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setOpen(s);
  }

  function submit() {
    setError("");
    start(async () => {
      const r = await createWithdrawal({ lines: lines.map((l) => ({ stockId: l.stockId, qty: take[l.stockId] })), note });
      if (r.error || !r.id) setError(r.error ?? "บันทึกไม่สำเร็จ");
      else router.push(`/withdraw/${r.id}`);
    });
  }

  return (
    <div className="wd-layout">
      <div className="wd-main">
        <div className="card panel">
          <h2>1. เลือกลูกค้า</h2>
          {initial.ignored.length > 0 && (
            <div className="msg err">
              ไม่ได้ใส่ {initial.ignored.join(", ")} เพราะไม่มีสินค้า หรือเป็นของลูกค้ารายอื่น
            </div>
          )}
          <div className="field" style={{ maxWidth: 420 }}>
            <label htmlFor="wd-cust">ลูกค้าเจ้าของสินค้า</label>
            <select id="wd-cust" value={customerId ?? ""} onChange={(e) => pickCustomer(e.target.value ? +e.target.value : null)}>
              <option value="">– เลือกลูกค้า –</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {customerId && (
          <div className="card panel">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
              <h2>2. เลือกสินค้าและตำแหน่ง</h2>
              <input className="qty-input" style={{ width: 220, textAlign: "left" }} placeholder="กรองสินค้า / SKU" value={filter}
                onChange={(e) => setFilter(e.target.value)} aria-label="กรองสินค้า" />
            </div>
            <p className="meta" style={{ margin: 0 }}>
              ใส่จำนวนที่ต้องการแล้วกด &quot;เลือกตำแหน่งให้&quot; ระบบจะหยิบจากของที่เข้าก่อนออกก่อน หรือเปิดรายการแล้วติ๊กเลือกตำแหน่งเองก็ได้
            </p>
            {shown.map((g) => {
              const picked = g.rows.filter((r) => take[r.stockId] > 0);
              const pickedQty = picked.reduce((n, r) => n + take[r.stockId], 0);
              return (
                <div key={g.productId} className="prod">
                  <div className="prod-head">
                    <button type="button" className="prod-toggle" onClick={() => toggleOpen(g.productId)} aria-expanded={open.has(g.productId)}>
                      <span className="nm">{g.name}</span>
                      <span className="mono sk">{g.sku}</span>
                      <span className="sk">มี {g.total.toLocaleString()} {g.unit} · {g.rows.length} ตำแหน่ง</span>
                      {pickedQty > 0 && <span className="tag OUT">เบิก {pickedQty} {g.unit}</span>}
                    </button>
                    <form className="autofill" onSubmit={(e) => { e.preventDefault(); autoFill(g); }}>
                      <input type="number" min={1} inputMode="numeric" placeholder="จำนวน" aria-label={`จำนวน ${g.name} ที่ต้องการเบิก`}
                        value={want[g.productId] ?? ""} onChange={(e) => setWant({ ...want, [g.productId]: e.target.value })} />
                      <button type="submit" className="btn sm">เลือกตำแหน่งให้</button>
                    </form>
                  </div>
                  {warn[g.productId] && <div className="msg err" style={{ margin: "8px 14px 0" }}>{warn[g.productId]}</div>}
                  {open.has(g.productId) && (
                    <div className="table-wrap">
                      <table className="table">
                        <thead><tr><th style={{ width: 40 }}></th><th>ตำแหน่ง</th><th>รับเข้า</th><th className="num">มีอยู่</th><th className="num">จำนวนเบิก</th></tr></thead>
                        <tbody>
                          {g.rows.map((r) => {
                            const on = take[r.stockId] > 0;
                            return (
                              <tr key={r.stockId} className={on ? "row-on" : undefined}>
                                <td>
                                  <input type="checkbox" checked={on} aria-label={`เลือก ${r.code}`}
                                    onChange={(e) => setLine(r, e.target.checked ? r.qty : null)} style={{ width: 18, height: 18 }} />
                                </td>
                                <td className="mono">{r.code}<div className="sk">แร็ค {r.rack} · Bay {pad(r.bay)} · ชั้น {pad(r.level)}</div></td>
                                <td>{thDate(r.receivedAt)}</td>
                                <td className="num">{r.qty} {g.unit}</td>
                                <td className="num">
                                  <input className="qty-input" type="number" min={0} max={r.qty} inputMode="numeric" aria-label={`จำนวนเบิกจาก ${r.code}`}
                                    value={take[r.stockId] ?? ""} placeholder="0" onChange={(e) => setLine(r, e.target.value === "" ? null : +e.target.value)} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            {shown.length === 0 && <p className="meta" style={{ margin: 0 }}>ไม่พบสินค้า</p>}
          </div>
        )}
      </div>

      <aside className="card wd-side">
        <h2>ใบเบิก</h2>
        {lines.length === 0 ? (
          <p className="meta" style={{ margin: 0 }}>ยังไม่ได้เลือกตำแหน่ง</p>
        ) : (
          <>
            <div className="meta">{customers.find((c) => c.id === customerId)?.name} · {positions} ตำแหน่ง</div>
            <div className="pick-list">
              {lines.map((l) => (
                <div key={l.stockId} className="pick-line">
                  <span className="code-chip">{l.code}</span>
                  <span className="nm">{l.name}</span>
                  <span className="q">{take[l.stockId]} {l.unit}</span>
                </div>
              ))}
            </div>
            <div className="box">
              <div className="k">รวม</div>
              {[...totals].map(([k, n]) => <div key={k} className="s"><b>{n.toLocaleString()}</b> · {k}</div>)}
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor="wd-note">หมายเหตุ (เช่น เลขที่ออเดอร์, ผู้มารับ)</label>
          <input id="wd-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <div className="msg err" role="alert">{error}</div>}
        {!confirming ? (
          <button type="button" className="btn primary" disabled={!lines.length} onClick={() => setConfirming(true)} style={{ flex: "none" }}>
            ออกใบเบิก ({positions} ตำแหน่ง)
          </button>
        ) : (
          <div className="actions">
            <button type="button" className="btn primary" disabled={pending} onClick={submit}>{pending ? "กำลังบันทึก…" : "ยืนยัน ตัดสต็อก"}</button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>แก้ไข</button>
          </div>
        )}
      </aside>
    </div>
  );
}
