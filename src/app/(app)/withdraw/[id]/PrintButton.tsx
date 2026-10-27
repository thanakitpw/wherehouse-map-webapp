"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn" style={{ flex: "none" }} onClick={() => window.print()}>
      พิมพ์ใบเบิก
    </button>
  );
}
