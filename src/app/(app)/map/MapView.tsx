"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  cancelReservation,
  getLocationHistory,
  moveStock,
  receiveStock,
  receiveStockMany,
  reserveLocation,
  withdrawStock,
} from "@/app/actions/stock";
import { CloseIcon, SearchIcon } from "@/components/Icons";
import { thDate } from "@/lib/format";
import { BAYS, codeOf, describeLocation, LEVELS, PALLETS, pad, RACKS, ZONE } from "@/lib/layout";
import { isHit, matchedItem, STATUS_TEXT } from "@/lib/search";
import type { ActionResult, CustomerOption, HistoryRow, Slot } from "@/lib/types";

const CHIPS = ["ครีมกันแดด", "ShopKit", "ข้าวหอมมะลิ", "BG-USBC", "AC-05"];

type ModalKind = "reserve" | "receive" | "receiveMany" | "withdraw" | "move" | "cancel" | "history";
// เลือกหลายตำแหน่ง: เพื่อทำใบเบิก หรือเพื่อรับสินค้าเข้าทีเดียวหลายตำแหน่ง
type PickKind = "withdraw" | "receive";

export function MapView({
  slots,
  customers,
  initialQuery = "",
  initialSel,
}: {
  slots: Slot[];
  customers: CustomerOption[];
  initialQuery?: string;
  initialSel?: string;
}) {
  const byCode = useMemo(() => new Map(slots.map((s) => [s.code, s])), [slots]);
  const [q, setQ] = useState(initialQuery);
  const [rack, setRack] = useState<string>("all");
  const [selCode, setSelCode] = useState<string | null>(initialSel ?? slots.find((s) => s.status === "occ")?.code ?? null);
  const [showAll, setShowAll] = useState(false);
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [toast, setToast] = useState("");
  const [pickMode, setPickMode] = useState<PickKind | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const scrollTo = useRef<string | null>(initialSel ?? null);

  const query = q.trim().toLowerCase();
  const hasQ = !!query;
  const hits = useMemo(() => slots.filter((s) => isHit(s, query)), [slots, query]);
  const hitSet = useMemo(() => new Set(hits.map((s) => s.code)), [hits]);
  const sel = selCode ? byCode.get(selCode) ?? null : null;

  const racks = rack === "all" ? [...RACKS] : [rack];
  const view = slots.filter((s) => racks.includes(s.rack));
  const stats = countStats(view);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // เลื่อนผังไปหาตำแหน่งที่เพิ่งเลือก หลังจาก render เสร็จ
  useEffect(() => {
    if (!scrollTo.current) return;
    document.querySelector(`.slot[data-code="${scrollTo.current}"]`)?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    scrollTo.current = null;
  });

  function select(code: string, opts?: { scroll?: boolean; showDetail?: boolean }) {
    const s = byCode.get(code);
    if (!s) return;
    setSelCode(code);
    if (rack !== "all" && rack !== s.rack) setRack(s.rack);
    if (opts?.scroll) scrollTo.current = code;
    if (opts?.showDetail && window.innerWidth < 1140) {
      setTimeout(() => document.getElementById("detail")?.scrollIntoView({ block: "start", behavior: "smooth" }), 0);
    }
  }

  const pickedSet = useMemo(() => new Set(picked), [picked]);
  // ลูกค้าของตำแหน่งที่เลือกไว้ (โหมดรับเข้าเลือกตำแหน่งว่างปนได้ จึงหาจากตำแหน่งแรกที่มีเจ้าของ)
  const pickedCustomer = picked.map((c) => byCode.get(c)?.customer).find(Boolean) ?? null;

  function startPick(kind: PickKind) {
    setPickMode(pickMode === kind ? null : kind);
    setPicked([]);
  }

  function togglePick(code: string) {
    const s = byCode.get(code);
    if (!s) return;
    setSelCode(code);
    if (pickedSet.has(code)) {
      setPicked(picked.filter((c) => c !== code));
      return;
    }
    if (pickMode === "withdraw" && (s.status !== "occ" || !s.customer)) {
      setToast("เลือกได้เฉพาะตำแหน่งที่มีสินค้า");
      return;
    }
    if (pickedCustomer && s.customer && pickedCustomer.id !== s.customer.id) {
      setToast(pickMode === "withdraw"
        ? `ใบเบิกหนึ่งใบเป็นของลูกค้ารายเดียว (${pickedCustomer.name})`
        : `รับเข้าครั้งเดียวได้เฉพาะตำแหน่งว่างหรือของ ${pickedCustomer.name}`);
      return;
    }
    setPicked([...picked, code]);
  }

  function onSlot(code: string, opts?: { scroll?: boolean }) {
    if (pickMode) {
      togglePick(code);
      if (opts?.scroll) scrollTo.current = code;
    } else select(code, { ...opts, showDetail: true });
  }

  // ผลค้นหาที่เลือกรวดเดียวได้: เบิก = ตำแหน่งที่มีสินค้า, รับเข้า = ตำแหน่งว่าง (ต้องเป็นลูกค้ารายเดียวกันทั้งหมด)
  const pickableHits = pickMode === "withdraw" ? hits.filter((s) => s.status === "occ" && s.customer) : hits.filter((s) => s.status === "empty");
  const hitCustomers = new Set(pickableHits.flatMap((s) => (s.customer ? [s.customer.id] : [])));
  const canPickAllHits =
    !!pickMode && pickableHits.length > 0 && hitCustomers.size <= 1 &&
    (!pickedCustomer || hitCustomers.size === 0 || hitCustomers.has(pickedCustomer.id)) &&
    pickableHits.some((s) => !pickedSet.has(s.code));

  function onDone(res: ActionResult, nextSel?: string) {
    if (res.ok) {
      setModal(null);
      setToast(res.ok);
      if (nextSel) select(nextSel, { scroll: true });
    }
  }

  function onReceivedMany(res: ActionResult) {
    if (!res.ok) return;
    onDone(res);
    setPickMode(null);
    setPicked([]);
  }

  const limit = showAll ? hits.length : 8;

  return (
    <div className="wrap">
      <main className="mapmain">
        <div className="card searchcard">
          <label htmlFor="slot-search">ค้นหาว่าสินค้าอยู่ตรงไหน</label>
          <div className="searchbox">
            <SearchIcon />
            <input
              id="slot-search"
              type="search"
              autoComplete="off"
              placeholder="ชื่อสินค้า, SKU, ชื่อลูกค้า หรือรหัสตำแหน่ง เช่น AC-05"
              value={q}
              onChange={(e) => { setQ(e.target.value); setShowAll(false); }}
            />
            {hasQ && (
              <button type="button" className="iconbtn" aria-label="ล้างคำค้นหา" onClick={() => setQ("")}>
                <CloseIcon />
              </button>
            )}
          </div>
          <div className="chips">
            ลองค้นหา:
            {CHIPS.map((c) => (
              <button key={c} type="button" className="chip" onClick={() => { setQ(c); setShowAll(false); }}>{c}</button>
            ))}
          </div>
        </div>

        <div className="toolbar">
          <div className="tabs">
            <button type="button" className="tab" aria-pressed={rack === "all"} onClick={() => setRack("all")}>
              ทุกแร็ค{hasQ ? ` (${hits.length})` : ""}
            </button>
            {RACKS.map((r) => (
              <button key={r} type="button" className="tab mono" aria-pressed={rack === r} onClick={() => setRack(r)}>
                {r}{hasQ ? ` (${hits.filter((s) => s.rack === r).length})` : ""}
              </button>
            ))}
            <button type="button" className="tab pick" aria-pressed={pickMode === "receive"} onClick={() => startPick("receive")}>
              {pickMode === "receive" ? "เลิกเลือก" : "เลือกหลายตำแหน่งเพื่อรับเข้า"}
            </button>
            <button type="button" className="tab pick" aria-pressed={pickMode === "withdraw"} onClick={() => startPick("withdraw")}>
              {pickMode === "withdraw" ? "เลิกเลือก" : "เลือกหลายตำแหน่งเพื่อเบิก"}
            </button>
            <a className="tab" href={`/map/export${rack === "all" ? "" : `?rack=${rack}`}`} download
              style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              Export Excel{rack === "all" ? "" : ` (${rack})`}
            </a>
          </div>
          <div className="stats">
            ใช้แล้ว {Math.round(((stats.occ + stats.res) * 100) / Math.max(1, stats.total))}% · มีสินค้า {stats.occ} · จอง {stats.res} · ว่าง {stats.empty} จาก {stats.total.toLocaleString()} ตำแหน่ง
          </div>
        </div>

        <div className="card mapcard">
          <div className="zone-title">
            <b>Zone {ZONE} · {rack === "all" ? "แร็ค AA–AF" : `แร็ค ${rack}`}</b>
            <span>{BAYS} Bay × {PALLETS} พาเลท × {LEVELS} ชั้น ต่อแร็ค · ชั้น 01 อยู่ล่างสุด</span>
          </div>
          <div className="zone">
            <div className="band">OFFICE</div>
            <div className="racks">
              {racks.map((r) => (
                <RackBlock key={r} rack={r} byCode={byCode} hitSet={hitSet} hasQ={hasQ} selCode={selCode} pickedSet={pickedSet} onPick={(c) => onSlot(c)} />
              ))}
            </div>
            <div className="band">WALKWAY</div>
          </div>
          <div className="legend">
            <div><span style={{ background: "#fff", border: "1.5px solid #9AA8B6" }} />ว่าง</div>
            <div><span style={{ background: "#A9BCCF" }} />จองแล้ว</div>
            <div><span style={{ background: "#22364A" }} />มีสินค้า</div>
            <div><span style={{ background: "#F5B40A" }} />ผลค้นหา</div>
            <div><span style={{ background: "#fff", boxShadow: "0 0 0 2px #fff,0 0 0 4px #1F4FD1" }} />ตำแหน่งที่เลือก</div>
            {pickMode && <div><span style={{ background: "#1F4FD1" }} />{pickMode === "withdraw" ? "เลือกเพื่อเบิก" : "เลือกเพื่อรับเข้า"}</div>}
            <div className="k">1 ช่อง = 1 ตำแหน่งพาเลท</div>
          </div>
        </div>
      </main>

      <aside className="side">
        {hasQ && (
          <div className="card results">
            <h2>
              {hits.length === 0
                ? "ไม่พบสินค้าหรือตำแหน่งที่ตรงกับคำค้นหา"
                : `พบ ${hits.length} ตำแหน่ง${hits.length > limit ? ` (แสดง ${limit} รายการแรก)` : ""}`}
            </h2>
            {hits.slice(0, limit).map((s) => {
              const m = s.status === "occ" ? matchedItem(s, query) : null;
              const t1 = m ? `${m.name} · ${m.qty} ${m.unit}` : s.status === "res" ? `จองไว้${s.eta ? ` · คาดว่าเข้า ${thDate(s.eta)}` : ""}` : "ตำแหน่งว่าง";
              return (
                <button key={s.code} type="button" className="result" aria-pressed={pickMode ? pickedSet.has(s.code) : undefined}
                  style={pickMode && pickedSet.has(s.code) ? { borderColor: "#1F4FD1", background: "#EEF3FF" } : undefined}
                  onClick={() => onSlot(s.code, { scroll: true })}>
                  <span className="code-chip">{s.code}</span>
                  <span className="t">
                    <span className="t1">{t1}</span>
                    <span className="t2">{s.customer ? `${s.customer.name} · ` : ""}แร็ค {s.rack} Bay {pad(s.bay)} ชั้น {pad(s.level)}</span>
                  </span>
                </button>
              );
            })}
            {hits.length > limit && (
              <button type="button" className="linkbtn" onClick={() => setShowAll(true)}>แสดงทั้งหมด {hits.length} รายการ</button>
            )}
            {canPickAllHits && (
              <button type="button" className="linkbtn" onClick={() => setPicked([...new Set([...picked, ...pickableHits.map((s) => s.code)])])}>
                {pickMode === "withdraw"
                  ? `เลือกทั้ง ${pickableHits.length} ตำแหน่งที่มีสินค้าเพื่อเบิก`
                  : `เลือกทั้ง ${pickableHits.length} ตำแหน่งว่างเพื่อรับเข้า`}
              </button>
            )}
          </div>
        )}

        <div className="card detail" id="detail" aria-live="polite">
          {sel ? <Detail s={sel} onAction={setModal} /> : (
            <div style={{ fontSize: 16, color: "#34424F" }}>กดที่ช่องบนผังเพื่อดูว่ามีสินค้าอะไร ของลูกค้าคนไหน</div>
          )}
        </div>
      </aside>

      {modal === "receiveMany" && (
        <Modal onClose={() => setModal(null)}>
          <ReceiveManyForm codes={picked} customer={pickedCustomer} customers={customers} onDone={onReceivedMany} onCancel={() => setModal(null)} />
        </Modal>
      )}

      {modal && modal !== "receiveMany" && sel && (
        <Modal onClose={() => setModal(null)}>
          {modal === "reserve" && <ReserveForm s={sel} customers={customers} onDone={onDone} onCancel={() => setModal(null)} />}
          {modal === "receive" && <ReceiveForm s={sel} customers={customers} onDone={onDone} onCancel={() => setModal(null)} />}
          {modal === "withdraw" && <WithdrawForm s={sel} onDone={onDone} onCancel={() => setModal(null)} />}
          {modal === "move" && <MoveForm s={sel} slots={slots} onDone={onDone} onCancel={() => setModal(null)} />}
          {modal === "cancel" && <CancelForm s={sel} onDone={onDone} onCancel={() => setModal(null)} />}
          {modal === "history" && <History s={sel} onClose={() => setModal(null)} />}
        </Modal>
      )}

      {pickMode && (
        <div className="pickbar" role="region" aria-label={pickMode === "withdraw" ? "ตำแหน่งที่เลือกเพื่อเบิก" : "ตำแหน่งที่เลือกเพื่อรับเข้า"}>
          <span className="t">
            {picked.length
              ? `เลือกแล้ว ${picked.length} ตำแหน่ง${pickedCustomer ? ` · ${pickedCustomer.name}` : ""}`
              : pickMode === "withdraw" ? "กดช่องที่มีสินค้าบนผังเพื่อเลือก" : "กดช่องว่างบนผังเพื่อเลือกตำแหน่งที่จะรับเข้า"}
          </span>
          {picked.length > 0 && <button type="button" className="btn ghost" onClick={() => setPicked([])}>ล้าง</button>}
          {picked.length > 0 && pickMode === "withdraw" && (
            <Link className="btn primary" href={`/withdraw?codes=${picked.join(",")}`} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              ทำใบเบิก →
            </Link>
          )}
          {picked.length > 0 && pickMode === "receive" && (
            <button type="button" className="btn primary" onClick={() => setModal("receiveMany")}>รับสินค้าเข้า →</button>
          )}
        </div>
      )}

      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite" style={pickMode ? { bottom: 96 } : undefined}>{toast}</div>
    </div>
  );
}

function countStats(list: Slot[]) {
  let occ = 0, res = 0;
  for (const s of list) {
    if (s.status === "occ") occ++;
    else if (s.status === "res") res++;
  }
  return { occ, res, empty: list.length - occ - res, total: list.length };
}

function RackBlock({ rack, byCode, hitSet, hasQ, selCode, pickedSet, onPick }: {
  rack: string;
  byCode: Map<string, Slot>;
  hitSet: Set<string>;
  hasQ: boolean;
  selCode: string | null;
  pickedSet: Set<string>;
  onPick: (code: string) => void;
}) {
  const list = [...byCode.values()].filter((s) => s.rack === rack);
  const c = countStats(list);
  const nHit = list.filter((s) => hitSet.has(s.code)).length;
  const levels = Array.from({ length: LEVELS }, (_, i) => LEVELS - i);
  const bays = Array.from({ length: BAYS }, (_, i) => i + 1);
  return (
    <section className="rack" aria-label={`แร็ค ${rack}`}>
      <div className="rack-head">
        <span className="rack-sign">{rack}</span>
        <span className="rack-stat">{hasQ ? `พบ ${nHit} ตำแหน่ง · ` : ""}มีสินค้า {c.occ} · จอง {c.res} · ว่าง {c.empty}</span>
      </div>
      <div className="rrow">
        <div className="lvl" />
        {bays.map((b) => <div key={b} className="bay-h">{pad(b)}</div>)}
      </div>
      {levels.map((lv) => (
        <div key={lv} className={`rrow${lv === 1 ? " floor" : ""}`}>
          <div className="lvl">{pad(lv)}</div>
          {bays.map((bay) => (
            <div key={bay} className="bay">
              {Array.from({ length: PALLETS }, (_, i) => {
                const s = byCode.get(codeOf(rack, bay, i + 1, lv));
                if (!s) return null;
                const hit = hitSet.has(s.code);
                const isSel = s.code === selCode;
                const isPicked = pickedSet.has(s.code);
                const cls = `slot ${isPicked ? "is-picked" : hit ? "is-hit" : `is-${s.status}`}${hasQ && !hit && !isPicked ? " is-dim" : ""}${isSel ? " is-sel" : ""}`;
                const label = `${s.code} · ${STATUS_TEXT[s.status]}${s.customer ? ` · ${s.customer.name}` : ""}`;
                return (
                  <button key={s.code} type="button" className={cls} data-code={s.code} aria-label={label} title={label} aria-pressed={isSel} onClick={() => onPick(s.code)} />
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function Detail({ s, onAction }: { s: Slot; onAction: (k: ModalKind) => void }) {
  return (
    <>
      <div className="dhead">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="k">ตำแหน่งเก็บ</div>
          <div className="code">{s.code}</div>
        </div>
        <span className={`pill ${s.status}`}>{STATUS_TEXT[s.status]}</span>
      </div>
      <div className="codeparts">
        <div><b>{s.rack}</b><span>แร็ค</span></div>
        <div><b>{pad(s.bay)}</b><span>Bay</span></div>
        <div><b>{pad(s.pallet)}</b><span>พาเลท</span></div>
        <div><b>{pad(s.level)}</b><span>ชั้น</span></div>
      </div>

      {s.status === "occ" && s.customer && (
        <>
          <div className="box">
            <div className="k">ลูกค้าเจ้าของสินค้า</div>
            <div className="v">{s.customer.name}</div>
          </div>
          <div className="items">
            <div className="k">สินค้าบนพาเลทนี้</div>
            {s.items.map((it) => (
              <div key={it.stockId} className="item">
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div className="n">{it.name}</div>
                  <div className="sku">{it.sku}</div>
                  {(it.customsNo || it.containerNo) && (
                    <div className="sku">
                      {[it.customsNo && `ใบขน ${it.customsNo}`, it.containerNo && `ตู้ ${it.containerNo}`].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <div className="q">{it.qty} {it.unit}</div>
              </div>
            ))}
          </div>
          {s.receivedAt && <div className="meta">รับเข้าล่าสุด {thDate(s.receivedAt)}{s.receivedBy ? ` · โดย ${s.receivedBy}` : ""}</div>}
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => onAction("withdraw")}>เบิกออก</button>
            <button type="button" className="btn" onClick={() => onAction("receive")}>รับเพิ่ม</button>
            <button type="button" className="btn" onClick={() => onAction("move")}>ย้ายตำแหน่ง</button>
            <button type="button" className="btn" onClick={() => onAction("history")}>ประวัติ</button>
          </div>
        </>
      )}

      {s.status === "res" && s.customer && (
        <>
          <div className="box">
            <div className="k">จองไว้ให้</div>
            <div className="v">{s.customer.name}</div>
            {s.eta && <div className="s">คาดว่าสินค้าเข้า {thDate(s.eta)}</div>}
          </div>
          <div className="actions">
            <button type="button" className="btn primary" style={{ flexBasis: 140 }} onClick={() => onAction("receive")}>รับสินค้าเข้าตำแหน่งนี้</button>
            <button type="button" className="btn" style={{ flexBasis: 140 }} onClick={() => onAction("cancel")}>ยกเลิกการจอง</button>
          </div>
          <button type="button" className="linkbtn" onClick={() => onAction("history")}>ดูประวัติตำแหน่งนี้</button>
        </>
      )}

      {s.status === "empty" && (
        <>
          <div className="box" style={{ fontSize: 16, color: "#34424F" }}>ตำแหน่งนี้ว่าง พร้อมรับสินค้า</div>
          <div className="actions">
            <button type="button" className="btn primary" style={{ flexBasis: 140 }} onClick={() => onAction("receive")}>รับสินค้าเข้า</button>
            <button type="button" className="btn" style={{ flexBasis: 140 }} onClick={() => onAction("reserve")}>จองให้ลูกค้า</button>
          </div>
          <button type="button" className="linkbtn" onClick={() => onAction("history")}>ดูประวัติตำแหน่งนี้</button>
        </>
      )}
    </>
  );
}

// ---------- modals ----------

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}

function ModalHead({ title, s }: { title: string; s: Slot }) {
  return (
    <>
      <h2>{title}</h2>
      <div className="sub"><span className="mono">{s.code}</span> · {describeLocation(s)}</div>
    </>
  );
}

type FormProps = { s: Slot; onDone: (r: ActionResult, nextSel?: string) => void; onCancel: () => void };

function useSubmit(onDone: FormProps["onDone"]) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  function run(fn: () => Promise<ActionResult>, nextSel?: string) {
    setError("");
    start(async () => {
      try {
        const r = await fn();
        if (r.error) setError(r.error);
        else onDone(r, nextSel);
      } catch (e) {
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
      }
    });
  }
  return { pending, error, run };
}

function Foot({ pending, label, onCancel, error }: { pending: boolean; label: string; onCancel: () => void; error: string }) {
  return (
    <>
      {error && <div className="msg err" role="alert">{error}</div>}
      <div className="actions">
        <button type="submit" className="btn primary" disabled={pending}>{pending ? "กำลังบันทึก…" : label}</button>
        <button type="button" className="btn" onClick={onCancel}>ยกเลิก</button>
      </div>
    </>
  );
}

const formStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 16 };

function ReserveForm({ s, customers, onDone, onCancel }: FormProps & { customers: CustomerOption[] }) {
  const { pending, error, run } = useSubmit(onDone);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? 0);
  const [eta, setEta] = useState(() => new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10));
  if (!customers.length) return <NoCustomers onCancel={onCancel} />;
  return (
    <form style={formStyle} onSubmit={(e) => { e.preventDefault(); run(() => reserveLocation({ code: s.code, customerId, eta })); }}>
      <ModalHead title="จองตำแหน่งให้ลูกค้า" s={s} />
      <div className="field">
        <label htmlFor="f-cust">ลูกค้า</label>
        <select id="f-cust" value={customerId} onChange={(e) => setCustomerId(+e.target.value)}>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="f-eta">คาดว่าสินค้าเข้า</label>
        <input id="f-eta" type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
      </div>
      <Foot pending={pending} label="ยืนยันการจอง" onCancel={onCancel} error={error} />
    </form>
  );
}

function ReceiveForm({ s, customers, onDone, onCancel }: FormProps & { customers: CustomerOption[] }) {
  const { pending, error, run } = useSubmit(onDone);
  // ตำแหน่งที่มีของหรือจองแล้ว รับได้เฉพาะลูกค้ารายเดิม
  const allowed = s.customer ? customers.filter((c) => c.id === s.customer!.id) : customers.filter((c) => c.products.length);
  const [customerId, setCustomerId] = useState(allowed[0]?.id ?? 0);
  const cust = allowed.find((c) => c.id === customerId) ?? allowed[0];
  const [productId, setProductId] = useState(cust?.products[0]?.id ?? 0);
  const [qty, setQty] = useState(10);
  const product = cust?.products.find((p) => p.id === productId) ?? cust?.products[0];

  if (!cust || !cust.products.length) {
    return (
      <div style={formStyle}>
        <ModalHead title="รับสินค้าเข้าตำแหน่ง" s={s} />
        <div className="msg err">ยังไม่มีสินค้าของลูกค้ารายนี้ในระบบ เพิ่มสินค้าที่หน้า &quot;สินค้า&quot; ก่อน</div>
        <div className="actions"><button type="button" className="btn" onClick={onCancel}>ปิด</button></div>
      </div>
    );
  }
  return (
    <form style={formStyle} onSubmit={(e) => { e.preventDefault(); if (product) run(() => receiveStock({ code: s.code, productId: product.id, qty })); }}>
      <ModalHead title={s.status === "occ" ? "รับสินค้าเพิ่ม" : "รับสินค้าเข้าตำแหน่ง"} s={s} />
      <div className="field">
        <label htmlFor="f-cust">ลูกค้า</label>
        <select id="f-cust" value={cust.id} disabled={!!s.customer} onChange={(e) => {
          const c = allowed.find((x) => x.id === +e.target.value);
          setCustomerId(+e.target.value);
          setProductId(c?.products[0]?.id ?? 0);
        }}>
          {allowed.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="f-prod">สินค้า</label>
        <select id="f-prod" value={product?.id} onChange={(e) => setProductId(+e.target.value)}>
          {cust.products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="f-qty">จำนวน ({product?.unit})</label>
        <input id="f-qty" type="number" min={1} inputMode="numeric" required value={qty} onChange={(e) => setQty(+e.target.value)} />
      </div>
      <Foot pending={pending} label="บันทึกรับเข้า" onCancel={onCancel} error={error} />
    </form>
  );
}

function ReceiveManyForm({ codes, customer, customers, onDone, onCancel }: {
  codes: string[];
  customer: { id: number; name: string } | null;
  customers: CustomerOption[];
  onDone: (r: ActionResult) => void;
  onCancel: () => void;
}) {
  const { pending, error, run } = useSubmit(onDone);
  // ถ้ามีตำแหน่งที่มีของหรือจองไว้ปนอยู่ รับได้เฉพาะลูกค้ารายนั้น
  const allowed = customer ? customers.filter((c) => c.id === customer.id) : customers.filter((c) => c.products.length);
  const [customerId, setCustomerId] = useState(allowed[0]?.id ?? 0);
  const cust = allowed.find((c) => c.id === customerId) ?? allowed[0];
  const [productId, setProductId] = useState(cust?.products[0]?.id ?? 0);
  const product = cust?.products.find((p) => p.id === productId) ?? cust?.products[0];
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(codes.map((c) => [c, 10])));
  const total = codes.reduce((n, c) => n + (qty[c] || 0), 0);

  if (!cust || !cust.products.length) {
    return (
      <div style={formStyle}>
        <h2>รับสินค้าเข้า {codes.length} ตำแหน่ง</h2>
        <div className="msg err">ยังไม่มีสินค้าของลูกค้ารายนี้ในระบบ เพิ่มสินค้าที่หน้า &quot;สินค้า&quot; ก่อน</div>
        <div className="actions"><button type="button" className="btn" onClick={onCancel}>ปิด</button></div>
      </div>
    );
  }
  return (
    <form style={formStyle} onSubmit={(e) => {
      e.preventDefault();
      if (product) run(() => receiveStockMany({ productId: product.id, lines: codes.map((c) => ({ code: c, qty: qty[c] ?? 0 })) }));
    }}>
      <h2>รับสินค้าเข้า {codes.length} ตำแหน่ง</h2>
      <div className="sub">สินค้าเดียวกันเข้าทุกตำแหน่งที่เลือก · ใส่จำนวนแยกแต่ละตำแหน่งได้</div>
      <div className="field">
        <label htmlFor="fm-cust">ลูกค้า</label>
        <select id="fm-cust" value={cust.id} disabled={!!customer} onChange={(e) => {
          const c = allowed.find((x) => x.id === +e.target.value);
          setCustomerId(+e.target.value);
          setProductId(c?.products[0]?.id ?? 0);
        }}>
          {allowed.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="fm-prod">สินค้า</label>
        <select id="fm-prod" value={product?.id} onChange={(e) => setProductId(+e.target.value)}>
          {cust.products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="fm-all">จำนวนต่อตำแหน่ง ({product?.unit}) · ใส่ตรงนี้เพื่อใช้กับทุกตำแหน่ง</label>
        <input id="fm-all" type="number" min={1} inputMode="numeric" placeholder="เช่น 10"
          onChange={(e) => { const n = +e.target.value; if (n > 0) setQty(Object.fromEntries(codes.map((c) => [c, n]))); }} />
      </div>
      <div className="pick-list">
        {codes.map((c) => (
          <div key={c} className="pick-line">
            <label htmlFor={`fm-q-${c}`} className="nm mono">{c}</label>
            <input id={`fm-q-${c}`} type="number" min={1} inputMode="numeric" required style={{ width: 96 }}
              value={qty[c] ?? ""} onChange={(e) => setQty({ ...qty, [c]: +e.target.value })} />
            <span className="q">{product?.unit}</span>
          </div>
        ))}
      </div>
      <div className="sub" style={{ marginTop: 0 }}>รวม {total.toLocaleString()} {product?.unit}</div>
      <Foot pending={pending} label={`บันทึกรับเข้า ${codes.length} ตำแหน่ง`} onCancel={onCancel} error={error} />
    </form>
  );
}

function WithdrawForm({ s, onDone, onCancel }: FormProps) {
  const { pending, error, run } = useSubmit(onDone);
  const [qty, setQty] = useState<Record<number, number>>(() => Object.fromEntries(s.items.map((it) => [it.stockId, it.qty])));
  return (
    <form style={formStyle} onSubmit={(e) => {
      e.preventDefault();
      run(() => withdrawStock({ code: s.code, items: s.items.map((it) => ({ stockId: it.stockId, qty: qty[it.stockId] ?? 0 })) }));
    }}>
      <ModalHead title="เบิกสินค้าออก" s={s} />
      {s.items.map((it) => (
        <div key={it.stockId} className="field">
          <label htmlFor={`f-w${it.stockId}`}>
            {it.name} <span className="mono" style={{ fontWeight: 500, color: "#4A5A6A" }}>· มี {it.qty} {it.unit}</span>
          </label>
          <input id={`f-w${it.stockId}`} type="number" min={0} max={it.qty} inputMode="numeric"
            value={qty[it.stockId] ?? 0} onChange={(e) => setQty({ ...qty, [it.stockId]: +e.target.value })} />
        </div>
      ))}
      <div className="sub" style={{ marginTop: 0 }}>ถ้าเบิกออกหมดทุกรายการ ตำแหน่งนี้จะกลับเป็น &quot;ว่าง&quot; ทันที</div>
      <Foot pending={pending} label="ยืนยันเบิกออก" onCancel={onCancel} error={error} />
    </form>
  );
}

function MoveForm({ s, slots, onDone, onCancel }: FormProps & { slots: Slot[] }) {
  const { pending, error, run } = useSubmit(onDone);
  const empties = slots.filter((x) => x.status === "empty");
  const [to, setTo] = useState(empties[0]?.code ?? "");
  return (
    <form style={formStyle} onSubmit={(e) => { e.preventDefault(); run(() => moveStock({ from: s.code, to }), to); }}>
      <ModalHead title="ย้ายพาเลทไปตำแหน่งอื่น" s={s} />
      <div className="field">
        <label htmlFor="f-to">ย้ายไปตำแหน่งว่าง</label>
        <select id="f-to" value={to} onChange={(e) => setTo(e.target.value)}>
          {RACKS.map((r) => {
            const list = empties.filter((x) => x.rack === r);
            return list.length ? (
              <optgroup key={r} label={`แร็ค ${r}`}>
                {list.map((x) => <option key={x.code} value={x.code}>{x.code} · Bay {pad(x.bay)} ชั้น {pad(x.level)}</option>)}
              </optgroup>
            ) : null;
          })}
        </select>
      </div>
      <Foot pending={pending} label="ย้ายตำแหน่ง" onCancel={onCancel} error={error} />
    </form>
  );
}

function CancelForm({ s, onDone, onCancel }: FormProps) {
  const { pending, error, run } = useSubmit(onDone);
  return (
    <form style={formStyle} onSubmit={(e) => { e.preventDefault(); run(() => cancelReservation({ code: s.code })); }}>
      <ModalHead title="ยกเลิกการจอง?" s={s} />
      <div className="box">
        <div className="k">จองไว้ให้</div>
        <div className="v">{s.customer?.name}</div>
        <div className="s">ตำแหน่งจะกลับเป็น &quot;ว่าง&quot; และรับลูกค้ารายอื่นได้</div>
      </div>
      <Foot pending={pending} label="ยืนยันยกเลิกการจอง" onCancel={onCancel} error={error} />
    </form>
  );
}

function History({ s, onClose }: { s: Slot; onClose: () => void }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    getLocationHistory(s.code).then(setRows).catch(() => setError("โหลดประวัติไม่สำเร็จ"));
  }, [s.code]);
  return (
    <>
      <ModalHead title="ประวัติตำแหน่ง" s={s} />
      {error && <div className="msg err">{error}</div>}
      {!rows && !error && <div className="sub" style={{ marginTop: 0 }}>กำลังโหลด…</div>}
      {rows && rows.length === 0 && <div className="sub" style={{ marginTop: 0 }}>ยังไม่มีประวัติ</div>}
      {rows && rows.length > 0 && (
        <div className="hist">
          {rows.map((h) => <div key={h.id}><b>{h.title}</b><span>{h.detail}</span></div>)}
        </div>
      )}
      <div className="actions"><button type="button" className="btn" onClick={onClose}>ปิด</button></div>
    </>
  );
}

function NoCustomers({ onCancel }: { onCancel: () => void }) {
  return (
    <div style={formStyle}>
      <h2>ยังไม่มีลูกค้า</h2>
      <div className="msg err">เพิ่มลูกค้าที่หน้า &quot;ลูกค้า&quot; ก่อน</div>
      <div className="actions"><button type="button" className="btn" onClick={onCancel}>ปิด</button></div>
    </div>
  );
}
