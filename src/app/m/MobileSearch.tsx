"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CloseIcon, SearchIcon } from "@/components/Icons";
import { thDate } from "@/lib/format";
import { BAYS, codeOf, LEVELS, PALLETS, pad } from "@/lib/layout";
import { isHit, matchedItem } from "@/lib/search";
import type { Slot } from "@/lib/types";

const CHIPS = ["ครีมกันแดด", "ShopKit", "ข้าวหอมมะลิ", "BG-USBC", "AC-05"];

export function MobileSearch({ slots }: { slots: Slot[] }) {
  const byCode = useMemo(() => new Map(slots.map((s) => [s.code, s])), [slots]);
  const [q, setQ] = useState("");
  const [selCode, setSelCode] = useState<string | null>(null);
  const [show, setShow] = useState(12);

  const query = q.trim().toLowerCase();
  const hits = useMemo(() => (query ? slots.filter((s) => isHit(s, query)) : []), [slots, query]);
  const sel = hits.find((s) => s.code === selCode) ?? hits[0];
  const rest = hits.filter((s) => s !== sel);
  const custs = [...new Set(hits.filter((s) => s.customer).map((s) => s.customer!.name))];

  function search(v: string) {
    setQ(v);
    setSelCode(null);
    setShow(12);
  }

  let sub = "พิมพ์ชื่อสินค้า หรือรหัสตำแหน่ง";
  if (query) sub = hits.length ? `พบ ${hits.length} ตำแหน่ง${custs.length === 1 ? ` · ${custs[0]}` : custs.length > 1 ? ` · ลูกค้า ${custs.length} ราย` : ""}` : "ไม่พบ";

  return (
    <div className="m-page">
      <div className="m-head">
        <h1>ค้นหาสินค้า</h1>
        <label htmlFor="m-search" className="sr-only">ค้นหาสินค้า</label>
        <div className="m-search">
          <SearchIcon size={18} />
          <input id="m-search" type="search" autoComplete="off" placeholder="ชื่อสินค้า, SKU, ลูกค้า, ตำแหน่ง" value={q} onChange={(e) => search(e.target.value)} />
          {q && <button type="button" className="iconbtn" aria-label="ล้างคำค้นหา" onClick={() => search("")}><CloseIcon size={14} /></button>}
        </div>
        <div className="m-sub">{sub}</div>
      </div>

      <div className="m-body">
        {!query && (
          <div className="m-empty">
            <div>ลองค้นหา</div>
            <div className="chips">
              {CHIPS.map((c) => <button key={c} type="button" className="chip" onClick={() => search(c)}>{c}</button>)}
            </div>
          </div>
        )}
        {query && !hits.length && (
          <div className="m-empty">ไม่พบ &quot;{q}&quot; ในคลัง ลองค้นด้วย SKU ชื่อลูกค้า หรือรหัสตำแหน่ง</div>
        )}
        {sel && <TargetCard s={sel} query={query} byCode={byCode} />}
        {rest.slice(0, show).map((s) => {
          const mi = s.status === "occ" ? matchedItem(s, query) : null;
          return (
            <button key={s.code} type="button" className="m-row-item" onClick={() => { setSelCode(s.code); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <span className="code-chip">{s.code}</span>
              <span className="nm">
                {mi ? mi.name : s.status === "res" ? "จองไว้" : "ว่าง"}
                {custs.length > 1 && s.customer && <small>{s.customer.name}</small>}
              </span>
              <span className="qty">{mi ? `${mi.qty} ${mi.unit}` : ""}</span>
            </button>
          );
        })}
        {rest.length > show && (
          <button type="button" className="m-more" onClick={() => setShow(show + 20)}>แสดงอีก {rest.length - show} ตำแหน่ง</button>
        )}
      </div>

      <nav className="m-nav" aria-label="เมนูล่าง">
        <Link href="/map" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 0", color: "#4A5A6A", fontSize: 12, textDecoration: "none" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
          ผังคลัง
        </Link>
        <button type="button" aria-current="page">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          ค้นหา
        </button>
        <Link href="/withdraw" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 0", color: "#4A5A6A", fontSize: 12, textDecoration: "none" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 4v16M4 12h16" /></svg>
          เบิกสินค้า
        </Link>
      </nav>
    </div>
  );
}

function TargetCard({ s, query, byCode }: { s: Slot; query: string; byCode: Map<string, Slot> }) {
  const m = s.status === "occ" ? matchedItem(s, query) : null;
  const title = m ? m.name : s.status === "res" ? "จองไว้ (ยังไม่มีสินค้า)" : "ตำแหน่งว่าง";
  // ผังย่อ: ด้านหน้าแร็ค 7 Bay รอบตำแหน่งเป้าหมาย ชั้น 06 ลงมาถึง 01
  const start = Math.max(1, Math.min(s.bay - 3, BAYS - 6));
  const bays = Array.from({ length: 7 }, (_, i) => start + i);
  const levels = Array.from({ length: LEVELS }, (_, i) => LEVELS - i);
  return (
    <div className="m-card">
      <div className="top">
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <div className="nm">{title}</div>
          {m && <div className="sk">{m.sku}</div>}
          {s.customer && <div className="cu">{s.customer.name}</div>}
        </div>
        <div className="qty">{m ? `${m.qty} ${m.unit}` : s.status === "res" && s.eta ? `เข้า ${thDate(s.eta)}` : ""}</div>
      </div>
      <div className="goto">
        <div className="k">ไปที่ตำแหน่ง</div>
        <div className="code">{s.code}</div>
        <div className="w">แร็ค {s.rack} · Bay {pad(s.bay)} · พาเลท {pad(s.pallet)} · ชั้น {pad(s.level)}</div>
      </div>
      <div className="mini" aria-hidden="true">
        <div className="r">
          <div className="rl" />
          {bays.map((b) => <div key={b} className={`bh${b === s.bay ? " on" : ""}`}>{pad(b)}</div>)}
        </div>
        {levels.map((lv) => (
          <div key={lv} className={`r${lv === 1 ? " floor" : ""}`}>
            <div className="rl">{pad(lv)}</div>
            {bays.map((bay) => (
              <div key={bay} className="b">
                {Array.from({ length: PALLETS }, (_, i) => {
                  const x = byCode.get(codeOf(s.rack, bay, i + 1, lv));
                  return <div key={i} className={`c ${x?.code === s.code ? "target" : x?.status ?? "empty"}`} />;
                })}
              </div>
            ))}
          </div>
        ))}
        <div className="cap">แร็ค {s.rack} มองจากด้านหน้า · Bay {pad(start)}–{pad(start + 6)} · ชั้น 01 อยู่ล่างสุด</div>
      </div>
      <Link className="m-btn" href={`/map?q=${encodeURIComponent(query)}&sel=${s.code}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
        ดูบนผังคลัง
      </Link>
    </div>
  );
}
