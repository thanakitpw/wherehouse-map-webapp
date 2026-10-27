import { asc, not, like } from "drizzle-orm";
import type { Metadata } from "next";
import { createUser, deleteUser, resetPassword } from "@/app/actions/users";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { thDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "ผู้ใช้" };

export default async function UsersPage() {
  const me = await requireAdmin();
  const list = await (await getDb())
    .select({ id: users.id, username: users.username, name: users.name, role: users.role, createdAt: users.createdAt })
    .from(users)
    .where(not(like(users.username, "%#off%")))
    .orderBy(asc(users.username));

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>ผู้ใช้</h1><p>แอดมินจัดการผู้ใช้ได้ · พนักงานใช้งานผังคลัง ลูกค้า สินค้า และรายงานได้</p></div>
      </div>

      <div className="card panel">
        <h2>เพิ่มผู้ใช้</h2>
        <ActionForm action={createUser} resetOnOk>
          <div className="form-grid">
            <div className="field"><label htmlFor="u-username">ชื่อผู้ใช้ (ใช้ล็อกอิน)</label><input id="u-username" name="username" required autoCapitalize="none" /></div>
            <div className="field"><label htmlFor="u-name">ชื่อที่แสดง</label><input id="u-name" name="name" required /></div>
            <div className="field"><label htmlFor="u-password">รหัสผ่าน</label><input id="u-password" name="password" type="password" minLength={6} required autoComplete="new-password" /></div>
            <div className="field">
              <label htmlFor="u-role">สิทธิ์</label>
              <select id="u-role" name="role" defaultValue="staff"><option value="staff">พนักงาน</option><option value="admin">แอดมิน</option></select>
            </div>
            <SubmitButton>เพิ่มผู้ใช้</SubmitButton>
          </div>
        </ActionForm>
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>ชื่อผู้ใช้</th><th>ชื่อ</th><th>สิทธิ์</th><th>สร้างเมื่อ</th><th>เปลี่ยนรหัสผ่าน</th><th></th></tr></thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td className="mono">{u.username}</td>
                <td>{u.name}{u.id === me.id ? " (คุณ)" : ""}</td>
                <td><span className={`tag ${u.role}`}>{u.role === "admin" ? "แอดมิน" : "พนักงาน"}</span></td>
                <td>{thDate(u.createdAt)}</td>
                <td>
                  <ActionForm action={resetPassword} resetOnOk>
                    <input type="hidden" name="id" value={u.id} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <input name="password" type="password" minLength={6} required placeholder="รหัสใหม่" aria-label={`รหัสผ่านใหม่ของ ${u.username}`} autoComplete="new-password"
                        style={{ height: 36, border: "1px solid #B9C5D1", borderRadius: 8, padding: "0 10px", minWidth: 0, width: 140 }} />
                      <SubmitButton className="btn" style={{ height: 36, flex: "none" }}>เปลี่ยน</SubmitButton>
                    </div>
                  </ActionForm>
                </td>
                <td>
                  {u.id !== me.id && (
                    <ActionForm action={deleteUser}>
                      <input type="hidden" name="id" value={u.id} />
                      <SubmitButton className="btn danger" style={{ height: 36, flex: "none" }}>ปิดการใช้งาน</SubmitButton>
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
