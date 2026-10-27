"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/form";

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
  resetOnOk?: boolean;
};

// ฟอร์มที่เรียก server action แล้วแสดงข้อความสำเร็จ/ผิดพลาดใต้ฟอร์ม
export function ActionForm({ action, children, className, resetOnOk }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnOk && state?.ok) ref.current?.reset();
  }, [state, resetOnOk]);
  return (
    <form ref={ref} action={formAction} className={className} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {children}
      {state?.error && <div className="msg err" role="alert">{state.error}</div>}
      {state?.ok && <div className="msg ok" role="status">{state.ok}</div>}
    </form>
  );
}

export function SubmitButton({ children, className = "btn primary", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} style={style}>
      {pending ? "กำลังบันทึก…" : children}
    </button>
  );
}
