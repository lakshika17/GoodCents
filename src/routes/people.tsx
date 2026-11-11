import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/data/store";
import type { Department, Employee, Project, Role } from "@/data/types";
import { DemoBadge, Field, PageHeader, Panel, Pill, nativeSelect } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InternalAccess } from "@/components/internal-access";
import { pageHead } from "@/lib/meta";

export const Route = createFileRoute("/people")({
  head: pageHead("Employees & Departments", "Manage employees, roles, managers, departments and projects."),
  component: People,
});

function People() {
  const { role, mode } = useStore();
  if (mode === "internal") return <InternalAccess />;
  if (role !== "admin") return <Panel><p className="py-10 text-center text-sm text-muted-foreground">Switch to the Finance role to manage people and departments.</p></Panel>;
  return (
    <>
      <PageHeader title="Employees & Departments" badge={<DemoBadge>Sample team · Sample finances</DemoBadge>} />
      <Tabs defaultValue="employees">
        <TabsList><TabsTrigger value="employees">Employees</TabsTrigger><TabsTrigger value="departments">Departments</TabsTrigger><TabsTrigger value="projects">Projects</TabsTrigger></TabsList>
        <TabsContent value="employees"><EmployeesTab /></TabsContent>
        <TabsContent value="departments"><DepartmentsTab /></TabsContent>
        <TabsContent value="projects"><ProjectsTab /></TabsContent>
      </Tabs>
    </>
  );
}

function EmployeesTab() {
  const { employees, departments, upsertEmployee, removeEmployee, uid } = useStore();
  const [edit, setEdit] = useState<Employee | null>(null);
  const name = (id: string | null) => employees.find((e) => e.id === id)?.name ?? "—";
  return (
    <Panel className="p-0" >
      <div className="flex justify-end border-b p-3"><Button size="sm" onClick={() => setEdit({ id: uid("e"), name: "", email: "", title: "", role: "employee", departmentId: departments[0]?.id ?? "", managerId: null })}><Plus className="h-4 w-4" />Add employee</Button></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="px-5 py-2.5 font-medium">Name</th><th className="px-3 font-medium">Department</th><th className="px-3 font-medium">Role</th><th className="px-3 font-medium">Manager</th><th className="px-5" /></tr></thead>
          <tbody>{employees.map((e) => (
            <tr key={e.id} className="border-b last:border-0">
              <td className="px-5 py-2.5"><p className="font-medium">{e.name}</p><p className="text-xs text-muted-foreground">{e.id} · {e.title} · {e.email}</p></td>
              <td className="whitespace-nowrap px-3">{departments.find((d) => d.id === e.departmentId)?.name}</td>
              <td className="px-3"><Pill tone={e.role === "admin" ? "primary" : e.role === "manager" ? "info" : "neutral"}>{e.role === "admin" ? "Founder" : e.role}</Pill></td>
              <td className="whitespace-nowrap px-3 text-muted-foreground">{name(e.managerId)}</td>
              <td className="whitespace-nowrap px-5 text-right">
                <Button size="icon" variant="ghost" onClick={() => setEdit(e)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                {!["EMP-001", "EMP-003", "EMP-005"].includes(e.id) && <Button size="icon" variant="ghost" onClick={() => { removeEmployee(e.id); toast.success("Removed (demo)"); }} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit.name ? "Edit employee" : "Add employee"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
                <Field label="Title"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              </div>
              <Field label="Email"><Input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Department"><select className={nativeSelect} value={edit.departmentId} onChange={(e) => setEdit({ ...edit, departmentId: e.target.value })}>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
                <Field label="Role"><select className={nativeSelect} value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}><option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Finance / Admin</option></select></Field>
              </div>
              <Field label="Manager"><select className={nativeSelect} value={edit.managerId ?? ""} onChange={(e) => setEdit({ ...edit, managerId: e.target.value || null })}><option value="">None</option>{employees.filter((x) => x.role !== "employee" && x.id !== edit.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
              <Button disabled={!edit.name.trim()} onClick={() => { upsertEmployee(edit); setEdit(null); toast.success("Saved (demo)"); }}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Panel>
  );
}

function DepartmentsTab() {
  const { departments, employees, upsertDepartment, uid } = useStore();
  const [edit, setEdit] = useState<Department | null>(null);
  return (
    <>
      <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setEdit({ id: uid("d"), name: "", managerId: null })}><Plus className="h-4 w-4" />Add department</Button></div>
      <div className="grid gap-3 md:grid-cols-2">{departments.map((d) => (
        <Panel key={d.id} action={<Button size="icon" variant="ghost" onClick={() => setEdit(d)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>} title={d.name}>
          <p className="text-sm text-muted-foreground">Manager: {employees.find((e) => e.id === d.managerId)?.name ?? "Unassigned"} · {employees.filter((e) => e.departmentId === d.id).length} people</p>
        </Panel>
      ))}</div>
      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Department</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Manager"><select className={nativeSelect} value={edit.managerId ?? ""} onChange={(e) => setEdit({ ...edit, managerId: e.target.value || null })}><option value="">Unassigned</option>{employees.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
              <Button disabled={!edit.name.trim()} onClick={() => { upsertDepartment(edit); setEdit(null); toast.success("Saved (demo)"); }}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ProjectsTab() {
  const { projects, departments, projectDepartments, upsertProject, uid } = useStore();
  const [edit, setEdit] = useState<{ p: Project; depts: string[] } | null>(null);
  return (
    <>
      <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setEdit({ p: { id: uid("p"), name: "", code: "", status: "active" }, depts: [] })}><Plus className="h-4 w-4" />Add project</Button></div>
      <div className="grid gap-3 md:grid-cols-3">{projects.map((p) => {
        const depts = projectDepartments.filter((pd) => pd.projectId === p.id).map((pd) => pd.departmentId);
        return (
          <Panel key={p.id} title={`${p.name} (${p.code})`} action={<Button size="icon" variant="ghost" onClick={() => setEdit({ p, depts })} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>}>
            <div className="flex flex-wrap gap-1">{depts.map((d) => <Pill key={d}>{departments.find((x) => x.id === d)?.name}</Pill>)}</div>
          </Panel>
        );
      })}</div>
      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Project</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-[1fr_100px] gap-3">
                <Field label="Name"><Input value={edit.p.name} onChange={(e) => setEdit({ ...edit, p: { ...edit.p, name: e.target.value } })} /></Field>
                <Field label="Code"><Input value={edit.p.code} onChange={(e) => setEdit({ ...edit, p: { ...edit.p, code: e.target.value.toUpperCase() } })} /></Field>
              </div>
              <p className="text-xs font-medium text-muted-foreground">Departments</p>
              <div className="grid gap-2">{departments.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={edit.depts.includes(d.id)} onChange={(e) => setEdit({ ...edit, depts: e.target.checked ? [...edit.depts, d.id] : edit.depts.filter((x) => x !== d.id) })} />{d.name}
                </label>
              ))}</div>
              <Button disabled={!edit.p.name.trim()} onClick={() => { upsertProject(edit.p, edit.depts); setEdit(null); toast.success("Saved (demo)"); }}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
