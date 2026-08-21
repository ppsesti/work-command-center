import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Check,
  CheckSquare,
  CalendarDays,
  FolderKanban,
  BarChart3,
  Plus,
  Trash2,
  Pencil,
  X,
  Save,
  Clock3,
  Leaf,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  Flag,
  BriefcaseBusiness,
} from "lucide-react";

/*
  ESTI WORK COMMAND CENTER
  Visual direction: Wiyoso Family Hub — elegant rose gold, cream,
  rounded cards, soft typography and simple navigation.

  Storage: Supabase only. No application data is stored in browser localStorage.
  Required Vite env vars:
    VITE_SUPABASE_URL
    VITE_SUPABASE_PUBLISHABLE_KEY

  Supabase table: public.esti_wcc_items
*/

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => new Date().toISOString().slice(0, 10);
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const mKey = (d) => (d ? d.slice(0, 7) : "");
const monthLabel = (mk) => {
  const [y, m] = mk.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
const shiftMonth = (mk, delta) => {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const dateText = (d) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";
const inMonth = (d, mk) => !!d && mKey(d) === mk;

const PRIORITIES = ["Tinggi", "Sedang", "Rendah"];
const DIFFICULTIES = ["Mudah", "Sedang", "Sulit"];

const starterTasks = [
  { id: uid(), title: "Review attendance & payroll", deadline: today(), time: "09:00", priority: "Tinggi", difficulty: "Sedang", project: "Operasional HR", done: false },
  { id: uid(), title: "Follow up kandidat interview", deadline: today(), time: "10:30", priority: "Tinggi", difficulty: "Mudah", project: "Recruitment", done: false },
  { id: uid(), title: "Update SOP onboarding", deadline: today(), time: "13:00", priority: "Sedang", difficulty: "Sulit", project: "HR System", done: false },
  { id: uid(), title: "Cek kontrak karyawan", deadline: today(), time: "15:00", priority: "Sedang", difficulty: "Mudah", project: "Operasional HR", done: true },
];

const starterEvents = [
  { id: uid(), date: today(), time: "09:00", title: "Daily briefing" },
  { id: uid(), date: today(), time: "14:00", title: "Review recruitment" },
];

const starterProjects = [
  { id: uid(), name: "HR System", description: "Merapikan sistem dan dokumen HR", status: "Berjalan", progress: 55, deadline: "" },
  { id: uid(), name: "Recruitment Tracker", description: "Database kandidat dan alur interview", status: "Berjalan", progress: 70, deadline: "" },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const WORKSPACE_ID = "esti-work-command-center";
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const cloudId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return uid();
};

function useCloudCollection(kind, initial = []) {
  const [value, setValue] = useState(initial);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    if (!supabase) {
      setError("Supabase belum terhubung. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY.");
      setReady(true);
      return () => { alive = false; };
    }

    const load = async () => {
      const { data, error: loadError } = await supabase
        .from("esti_wcc_items")
        .select("id, data")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("kind", kind)
        .order("created_at", { ascending: true });

      if (!alive) return;
      if (loadError) {
        console.error(loadError);
        setError(loadError.message);
        setReady(true);
        return;
      }

      if (data?.length) {
        setValue(data.map((row) => row.data));
      } else if (initial.length) {
        const seed = initial.map((item) => ({ ...item, id: item.id || cloudId() }));
        const { error: seedError } = await supabase.from("esti_wcc_items").upsert(
          seed.map((item) => ({ id: item.id, workspace_id: WORKSPACE_ID, kind, data: item })),
          { onConflict: "id" }
        );
        if (!seedError) setValue(seed);
        else { console.error(seedError); setError(seedError.message); }
      } else {
        setValue([]);
      }
      setReady(true);
    };

    load();

    const channel = supabase
      .channel(`esti-wcc-${kind}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "esti_wcc_items", filter: `workspace_id=eq.${WORKSPACE_ID}` }, (payload) => {
        const row = payload.new || payload.old;
        if (!row || row.kind !== kind) return;
        setValue((current) => {
          if (payload.eventType === "DELETE") return current.filter((x) => x.id !== row.id);
          const incoming = row.data;
          const exists = current.some((x) => x.id === incoming.id);
          return exists ? current.map((x) => x.id === incoming.id ? incoming : x) : [...current, incoming];
        });
      })
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [kind]);

  const save = async (item) => {
    if (!supabase) throw new Error("Supabase belum terhubung.");
    const normalized = { ...item, id: item.id || cloudId() };
    const { error: saveError } = await supabase.from("esti_wcc_items").upsert(
      { id: normalized.id, workspace_id: WORKSPACE_ID, kind, data: normalized },
      { onConflict: "id" }
    );
    if (saveError) throw saveError;
    setValue((current) => current.some((x) => x.id === normalized.id)
      ? current.map((x) => x.id === normalized.id ? normalized : x)
      : [...current, normalized]
    );
    return normalized;
  };

  const remove = async (id) => {
    if (!supabase) throw new Error("Supabase belum terhubung.");
    const { error: deleteError } = await supabase
      .from("esti_wcc_items")
      .delete()
      .eq("workspace_id", WORKSPACE_ID)
      .eq("kind", kind)
      .eq("id", id);
    if (deleteError) throw deleteError;
    setValue((current) => current.filter((x) => x.id !== id));
  };

  return [value, save, remove, ready, error];
}

function useCloudReview(month) {
  const [value, setValue] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!supabase) { setReady(true); return () => { alive = false; }; }
    supabase.from("esti_wcc_items").select("data").eq("workspace_id", WORKSPACE_ID).eq("kind", "review").eq("id", `review-${month}`).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.error(error);
        setValue(data?.data?.text || "");
        setReady(true);
      });
    const channel = supabase.channel(`esti-wcc-review-${month}`).on("postgres_changes", { event: "*", schema: "public", table: "esti_wcc_items", filter: `workspace_id=eq.${WORKSPACE_ID}` }, (payload) => {
      const row = payload.new || payload.old;
      if (row?.kind === "review" && row?.id === `review-${month}`) setValue(payload.eventType === "DELETE" ? "" : row.data?.text || "");
    }).subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, [month]);

  const save = async (text) => {
    if (!supabase) throw new Error("Supabase belum terhubung.");
    const { error } = await supabase.from("esti_wcc_items").upsert({ id: `review-${month}`, workspace_id: WORKSPACE_ID, kind: "review", data: { text } }, { onConflict: "id" });
    if (error) throw error;
    setValue(text);
  };

  return [value, save, ready];
}

function Modal({ title, children, close, wide = false }) {
  return (
    <div className="backdrop" onMouseDown={close}>
      <div className={`modal ${wide ? "wide" : ""}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHead">
          <h2>{title}</h2>
          <button className="icon" onClick={close}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Empty({ text }) { return <div className="empty">{text}</div>; }

function Card({ title, Icon, action, onAction, children }) {
  return (
    <section className="card">
      <div className="cardHead">
        <h2>{Icon && <Icon size={18} />}{title}</h2>
        {action && <button className="link" onClick={onAction}>{action}</button>}
      </div>
      {children}
    </section>
  );
}

function Stat({ Icon, label, value, onClick }) {
  return (
    <button className="stat" onClick={onClick}>
      <div className="statIcon"><Icon size={20} /></div>
      <div><small>{label}</small><strong>{value}</strong>{onClick && <span>Lihat →</span>}</div>
    </button>
  );
}

function Progress({ value }) {
  return <div className="progress"><span style={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%` }} /></div>;
}

function deadlineStatus(date) {
  const todayDate = new Date(today() + "T00:00:00");
  const deadlineDate = new Date(date + "T00:00:00");
  const diff = Math.round((deadlineDate - todayDate) / 86400000);

  if (diff < 0) return `TERLAMBAT ${Math.abs(diff)} HARI`;
  if (diff === 0) return "HARI INI";
  return `H-${diff}`;
}
function TaskRow({ task, toggle, edit, del }) {
  return (
    <div className={`taskRow ${task.done ? "done" : ""}`}>
      <button className="checkBtn" onClick={() => toggle(task.id)} aria-label="Selesaikan">
        {task.done ? <CircleDot size={21} /> : <Circle size={21} />}
      </button>
      <div className="taskMain">
        <strong>{task.title}</strong>
        <div className="meta">
         <span>{dateText(task.deadline)}{task.time ? ` · ${task.time}` : ""} · {deadlineStatus(task.deadline)}</span>
          {task.project && <span>· {task.project}</span>}
        </div>
      </div>
      <div className="badges">
        <span className={`badge priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
        <span className={`badge diff-${task.difficulty.toLowerCase()}`}>{task.difficulty}</span>
      </div>
      <div className="rowActions">
        <button className="icon" onClick={() => edit(task)}><Pencil size={14} /></button>
        <button className="icon danger" onClick={() => del(task.id)}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function TaskForm({ data, projects, save, close }) {
  const [f, setF] = useState(data || {
    title: "", deadline: today(), time: "", priority: "Sedang", difficulty: "Sedang", project: ""
  });
  const [err, setErr] = useState("");
  const s = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = () => {
    if (!f.title.trim()) return setErr("Nama kerjaan wajib diisi.");
    if (!f.deadline) return setErr("Deadline wajib diisi.");
    save({ ...f, title: f.title.trim() });
  };
  return (
    <div className="form">
      <label>Kerjaan<input autoFocus value={f.title} onChange={(e) => s("title", e.target.value)} /></label>
      <div className="two">
        <label>Prioritas<select value={f.priority} onChange={(e) => s("priority", e.target.value)}>{PRIORITIES.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Tingkat kesulitan<select value={f.difficulty} onChange={(e) => s("difficulty", e.target.value)}>{DIFFICULTIES.map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      <div className="two">
        <label>Deadline<input type="date" value={f.deadline} onChange={(e) => s("deadline", e.target.value)} /></label>
        <label>Waktu<input type="time" value={f.time} onChange={(e) => s("time", e.target.value)} /></label>
      </div>
      <label>Project (opsional)<select value={f.project} onChange={(e) => s("project", e.target.value)}><option value="">Tanpa project</option>{projects.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}</select></label>
      {err && <p className="formErr">{err}</p>}
      <div className="actions"><button className="secondary" onClick={close}>Batal</button><button className="primary" onClick={submit}><Save size={16} />Simpan</button></div>
    </div>
  );
}

function EventForm({ data, save, close }) {
  const [f, setF] = useState(data || { date: today(), time: "", title: "" });
  const [err, setErr] = useState("");
  const s = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = () => {
    if (!f.title.trim()) return setErr("Agenda wajib diisi.");
    if (!f.date) return setErr("Tanggal wajib diisi.");
    save({ ...f, title: f.title.trim() });
  };
  return (
    <div className="form">
      <label>Agenda<input autoFocus value={f.title} onChange={(e) => s("title", e.target.value)} /></label>
      <div className="two"><label>Tanggal<input type="date" value={f.date} onChange={(e) => s("date", e.target.value)} /></label><label>Waktu<input type="time" value={f.time} onChange={(e) => s("time", e.target.value)} /></label></div>
      {err && <p className="formErr">{err}</p>}
      <div className="actions"><button className="secondary" onClick={close}>Batal</button><button className="primary" onClick={submit}><Save size={16} />Simpan</button></div>
    </div>
  );
}

function ProjectForm({ data, save, close }) {
  const [f, setF] = useState(data || { name: "", description: "", status: "Berjalan", progress: 0, deadline: "" });
  const [err, setErr] = useState("");
  const s = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const submit = () => {
    if (!f.name.trim()) return setErr("Nama project wajib diisi.");
    save({ ...f, name: f.name.trim(), progress: Math.max(0, Math.min(100, Number(f.progress) || 0)) });
  };
  return (
    <div className="form">
      <label>Nama project<input autoFocus value={f.name} onChange={(e) => s("name", e.target.value)} /></label>
      <label>Deskripsi<input value={f.description} onChange={(e) => s("description", e.target.value)} /></label>
      <div className="two"><label>Status<select value={f.status} onChange={(e) => s("status", e.target.value)}><option>Berjalan</option><option>On Hold</option><option>Selesai</option></select></label><label>Progress (%)<input type="number" min="0" max="100" value={f.progress} onChange={(e) => s("progress", e.target.value)} /></label></div>
      <label>Target selesai (opsional)<input type="date" value={f.deadline} onChange={(e) => s("deadline", e.target.value)} /></label>
      {err && <p className="formErr">{err}</p>}
      <div className="actions"><button className="secondary" onClick={close}>Batal</button><button className="primary" onClick={submit}><Save size={16} />Simpan</button></div>
    </div>
  );
}

export default function App() {
  const [tasks, saveTask, deleteTask, r1, e1] = useCloudCollection("task", starterTasks);
  const [events, saveEvent, deleteEvent, r2, e2] = useCloudCollection("event", starterEvents);
  const [projects, saveProject, deleteProject, r3, e3] = useCloudCollection("project", starterProjects);
  const [tab, setTab] = useState("home");
  const [modal, setModal] = useState(null);
  const [reviewMonth, setReviewMonth] = useState(mKey(today()));
  const [reflection, saveReflection, reflectionReady] = useCloudReview(reviewMonth);
  const [reflectionDraft, setReflectionDraft] = useState("");
  useEffect(() => { setReflectionDraft(reflection); }, [reflection]);
  const [taskFilter, setTaskFilter] = useState("Semua");
  const [difficultyFilter, setDifficultyFilter] = useState("Semua");
  const [calendarMonth, setCalendarMonth] = useState(mKey(today()));

  const nav = [
    ["home", "Home", Leaf],
    ["tasks", "List Kerjaan", CheckSquare],
    ["calendar", "Calendar Agenda", CalendarDays],
    ["projects", "Project", FolderKanban],
    ["review", "Monthly Review", BarChart3],
  ];

  const close = () => setModal(null);
  const [saving, setSaving] = useState(false);
  const [cloudError, setCloudError] = useState("");
  useEffect(() => { if (e1 || e2 || e3) setCloudError(e1 || e2 || e3); }, [e1, e2, e3]);

  const saveItem = async (saveFn, data) => {
    try {
      setSaving(true);
      await saveFn({ ...(modal?.data || {}), ...data, id: modal?.data?.id || cloudId() });
      close();
    } catch (error) {
      console.error(error);
      setCloudError(error.message || "Gagal menyimpan data ke Supabase.");
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async (id) => {
    const item = tasks.find((x) => x.id === id);
    if (!item) return;
    try { await saveTask({ ...item, done: !item.done }); } catch (error) { setCloudError(error.message); }
  };
  const delTask = async (id) => { try { await deleteTask(id); } catch (error) { setCloudError(error.message); } };
  const delProject = async (id) => { try { await deleteProject(id); } catch (error) { setCloudError(error.message); } };
  const delEvent = async (id) => { try { await deleteEvent(id); } catch (error) { setCloudError(error.message); } };

  const filteredTasks = useMemo(() => tasks
    .filter((t) => taskFilter === "Semua" || t.priority === taskFilter)
    .filter((t) => difficultyFilter === "Semua" || t.difficulty === difficultyFilter)
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.deadline + (a.time || "")).localeCompare(b.deadline + (b.time || ""))), [tasks, taskFilter, difficultyFilter]);

  const todayTasks = tasks.filter((x) => x.deadline === today());
  const todayEvents = events.filter((x) => x.date === today()).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const activeProjects = projects.filter((p) => p.status !== "Selesai");
  const completion = tasks.length ? Math.round(tasks.filter((x) => x.done).length / tasks.length * 100) : 0;

  const review = useMemo(() => {
    const monthTasks = tasks.filter((t) => inMonth(t.deadline, reviewMonth));
    const monthEvents = events.filter((e) => inMonth(e.date, reviewMonth));
    const monthProjects = projects.filter((p) => p.status !== "Selesai" || inMonth(p.deadline, reviewMonth));
    const done = monthTasks.filter((t) => t.done).length;
    const byPriority = PRIORITIES.map((p) => ({ label: p, value: monthTasks.filter((t) => t.priority === p).length }));
    const byDifficulty = DIFFICULTIES.map((d) => ({ label: d, value: monthTasks.filter((t) => t.difficulty === d).length }));
    return { monthTasks, monthEvents, monthProjects, done, completion: monthTasks.length ? Math.round(done / monthTasks.length * 100) : 0, byPriority, byDifficulty };
  }, [tasks, events, projects, reviewMonth]);

  const calendarDays = useMemo(() => {
    const [y, m] = calendarMonth.split("-").map(Number);
    const days = new Date(y, m, 0).getDate();
    return Array.from({ length: days }, (_, i) => `${calendarMonth}-${String(i + 1).padStart(2, "0")}`);
  }, [calendarMonth]);

  const modalView = modal && (
    <Modal title={modal.type === "task" ? (modal.data ? "Edit kerjaan" : "Tambah kerjaan") : modal.type === "event" ? (modal.data ? "Edit agenda" : "Tambah agenda") : (modal.data ? "Edit project" : "Tambah project")} close={close}>
      {modal.type === "task" && <TaskForm data={modal.data} projects={projects} close={close} save={(d) => saveItem(saveTask, d)} />}
      {modal.type === "event" && <EventForm data={modal.data} close={close} save={(d) => saveItem(saveEvent, d)} />}
      {modal.type === "project" && <ProjectForm data={modal.data} close={close} save={(d) => saveItem(saveProject, d)} />}
    </Modal>
  );

  if (!(r1 && r2 && r3 && reflectionReady)) return <div className="loading">Memuat Esti Work Command Center…</div>;

  return (
    <div className="app">
      <style>{CSS}</style>
      <aside>
        <div className="brand">
          <b><Leaf size={20} /></b>
          <div><strong>ESTI</strong><small>WORK COMMAND CENTER</small></div>
        </div>
        <p className="tag">Plan with clarity.<br />Work with intention.<br />Grow with purpose.</p>
        <nav>
          {nav.map(([id, label, I]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><I size={18} />{label}</button>)}
        </nav>
        <div className="note"><Clock3 size={17} /><b>Esti reminder</b><p>Kerjakan yang penting. Selesaikan yang bisa. Tinjau yang sudah berjalan. ♡</p></div>
      </aside>

      <main>
        {cloudError && <div className="cloudError"><span>{cloudError}</span><button onClick={() => setCloudError("")}>×</button></div>}
        <header>
          <div>
            <h1>{tab === "home" ? "Semangat, Esti" : nav.find((x) => x[0] === tab)?.[1]}</h1>
            <p>Take care of today. Build for tomorrow. Keep moving forward.</p>
          </div>
          <div className="date"><CalendarDays size={18} /><b>{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</b></div>
        </header>

        {tab === "home" && (
          <>
            <div className="stats">
              <Stat Icon={CheckSquare} label="Kerjaan Selesai" value={`${tasks.filter((x) => x.done).length} / ${tasks.length}`} onClick={() => setTab("tasks")} />
              <Stat Icon={CalendarDays} label="Agenda Hari Ini" value={todayEvents.length} onClick={() => setTab("calendar")} />
              <Stat Icon={Flag} label="Prioritas Tinggi" value={tasks.filter((x) => x.priority === "Tinggi" && !x.done).length} onClick={() => { setTab("tasks"); setTaskFilter("Tinggi"); }} />
              <Stat Icon={FolderKanban} label="Project Aktif" value={activeProjects.length} onClick={() => setTab("projects")} />
              <Stat Icon={BarChart3} label="Completion" value={`${completion}%`} onClick={() => setTab("review")} />
            </div>

            <div className="grid3">
              <Card title="Fokus Hari Ini" Icon={CheckSquare} action="+ Tambah kerjaan" onAction={() => setModal({ type: "task" })}>
                {todayTasks.slice(0, 5).map((t) => <TaskRow key={t.id} task={t} toggle={toggleTask} edit={(x) => setModal({ type: "task", data: x })} del={delTask} />)}
                {!todayTasks.length && <Empty text="Belum ada kerjaan untuk hari ini." />}
              </Card>
            <Card title="Agenda Terdekat" Icon={CalendarDays} action="Lihat semua →" onAction={() => setTab("calendar")}>
              {tasks.filter((t) => !t.done)
  .sort((a, b) => new Date(a.deadline + "T00:00:00") - new Date(b.deadline + "T00:00:00"))
  .slice(0, 4)
  .map((t) => (
    <div className="event" key={t.id}>
  <div>
   <span
  style={{
    display: "inline-block",
    fontSize: "10px",
    fontWeight: 700,
    padding: "4px 8px",
    borderRadius: "999px",
    marginBottom: "5px",
    background:
      deadlineStatus(t.deadline).startsWith("TERLAMBAT")
        ? "#FDE2E2"
        : deadlineStatus(t.deadline) === "HARI INI"
        ? "#FFF1D6"
        : deadlineStatus(t.deadline) === "H-1"
        ? "#FFE8B3"
        : "#E3F2E8",
    color:
      deadlineStatus(t.deadline).startsWith("TERLAMBAT")
        ? "#C62828"
        : deadlineStatus(t.deadline) === "HARI INI"
        ? "#B86B00"
        : deadlineStatus(t.deadline) === "H-1"
        ? "#A05A00"
        : "#287A45"
  }}
>
  {deadlineStatus(t.deadline)}
</span>

<strong>{t.title}</strong>
    <small>
      {dateText(t.deadline)}
      {t.time ? ` · ${t.time}` : ""}
    </small>
  </div>
</div>
  ))}
{tasks.filter((t) => !t.done).length === 0 && (
  <Empty text="Belum ada tugas yang perlu dikerjakan." />
)}
              </Card>
              <Card title="Project Berjalan" Icon={FolderKanban} action="Lihat project →" onAction={() => setTab("projects")}>
                {activeProjects.slice(0, 3).map((p) => <div className="projectMini" key={p.id}><div><strong>{p.name}</strong><span>{p.progress}%</span></div><Progress value={p.progress} /></div>)}
                {!activeProjects.length && <Empty text="Belum ada project aktif." />}
              </Card>
            </div>

            <div className="grid2">
              <Card title="Prioritas Kerjaan" Icon={Flag} action="Buka list →" onAction={() => setTab("tasks")}>
                {PRIORITIES.map((p) => {
                  const list = tasks.filter((t) => t.priority === p && !t.done);
                  return <div className="priorityBlock" key={p}><div><strong>{p}</strong><span>{list.length} kerjaan</span></div><Progress value={tasks.length ? list.length / tasks.length * 100 : 0} /></div>;
                })}
              </Card>
              <Card title="Ringkasan Bulan Ini" Icon={BarChart3} action="Monthly Review →" onAction={() => setTab("review")}>
                <div className="reviewSummary"><div><strong>{completion}%</strong><span>completion keseluruhan</span></div><div><strong>{activeProjects.length}</strong><span>project aktif</span></div><div><strong>{events.filter((e) => inMonth(e.date, mKey(today()))).length}</strong><span>agenda bulan ini</span></div></div>
              </Card>
            </div>
          </>
        )}

        {tab === "tasks" && (
          <Page title="List Kerjaan" desc="Atur pekerjaan berdasarkan prioritas dan tingkat kesulitan." add={() => setModal({ type: "task" })} addLabel="Tambah kerjaan">
            <div className="filterBar">
              <div><span>Prioritas</span>{["Semua", ...PRIORITIES].map((x) => <button key={x} className={taskFilter === x ? "selected" : ""} onClick={() => setTaskFilter(x)}>{x}</button>)}</div>
              <div><span>Kesulitan</span>{["Semua", ...DIFFICULTIES].map((x) => <button key={x} className={difficultyFilter === x ? "selected" : ""} onClick={() => setDifficultyFilter(x)}>{x}</button>)}</div>
            </div>
            <div className="taskBoard">
              {filteredTasks.length ? filteredTasks.map((t) => <TaskRow key={t.id} task={t} toggle={toggleTask} edit={(x) => setModal({ type: "task", data: x })} del={delTask} />) : <Empty text="Tidak ada kerjaan dengan filter ini." />}
            </div>
          </Page>
        )}

        {tab === "calendar" && (
          <Page title="Calendar Agenda" desc="Lihat agenda kerja dan deadline dalam satu tempat." add={() => setModal({ type: "event" })} addLabel="Tambah agenda">
            <div className="monthNav"><button className="icon" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}><ChevronLeft /></button><strong>{monthLabel(calendarMonth)}</strong><button className="icon" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}><ChevronRight /></button><button className="secondary small" onClick={() => setCalendarMonth(mKey(today()))}>Bulan ini</button></div>
            <div className="calendarList">
              {calendarDays.map((day) => {
                const dayTasks = tasks.filter((t) => t.deadline === day);
                const dayEvents = events.filter((e) => e.date === day);
                if (!dayTasks.length && !dayEvents.length) return null;
                return <div className={`dayBlock ${day === today() ? "today" : ""}`} key={day}><div className="dayHead"><strong>{new Date(day + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}</strong>{day === today() && <span>Hari ini</span>}</div>{dayEvents.map((e) => <div className="calendarItem" key={e.id}><CalendarDays size={17} /><div><strong>{e.title}</strong><small>Agenda · {e.time || "Tanpa waktu"}</small></div><div className="rowActions"><button className="icon" onClick={() => setModal({ type: "event", data: e })}><Pencil size={14} /></button><button className="icon danger" onClick={() => delEvent(e.id)}><Trash2 size={14} /></button></div></div>)}{dayTasks.map((t) => <div className="calendarItem" key={t.id}><CheckSquare size={17} /><div><strong className={t.done ? "strike" : ""}>{t.title}</strong><small>Deadline · {t.time || "Tanpa waktu"} · {t.priority} · {t.difficulty}</small></div></div>)}</div>;
              })}
              {!calendarDays.some((day) => tasks.some((t) => t.deadline === day) || events.some((e) => e.date === day)) && <Empty text="Belum ada agenda atau deadline di bulan ini." />}
            </div>
          </Page>
        )}

        {tab === "projects" && (
          <Page title="Project" desc="Pantau pekerjaan besar tanpa kehilangan detail harian." add={() => setModal({ type: "project" })} addLabel="Tambah project">
            <div className="projectGrid">
              {projects.map((p) => {
                const linked = tasks.filter((t) => t.project === p.name);
                const doneLinked = linked.filter((t) => t.done).length;
                return <section className="projectCard" key={p.id}><div className="projectTop"><div className="projectIcon"><BriefcaseBusiness size={19} /></div><span className={`status ${p.status === "Selesai" ? "complete" : p.status === "On Hold" ? "hold" : "running"}`}>{p.status}</span></div><h2>{p.name}</h2><p>{p.description || "Tanpa deskripsi."}</p><div className="projectProgress"><div><span>Progress</span><strong>{p.progress}%</strong></div><Progress value={p.progress} /></div><div className="projectMeta"><span>{doneLinked}/{linked.length} kerjaan selesai</span>{p.deadline && <span>Target {dateText(p.deadline)}</span>}</div><div className="projectActions"><button className="secondary" onClick={() => setModal({ type: "project", data: p })}><Pencil size={14} />Edit</button><button className="icon danger" onClick={() => delProject(p.id)}><Trash2 size={15} /></button></div></section>;
              })}
              {!projects.length && <Empty text="Belum ada project." />}
            </div>
          </Page>
        )}

        {tab === "review" && (
          <Page title="Monthly Review" desc="Tinjau apa yang sudah dikerjakan, apa yang tertunda, dan fokus berikutnya.">
            <div className="monthNav reviewNav"><button className="icon" onClick={() => setReviewMonth(shiftMonth(reviewMonth, -1))}><ChevronLeft /></button><strong>{monthLabel(reviewMonth)}</strong><button className="icon" onClick={() => setReviewMonth(shiftMonth(reviewMonth, 1))}><ChevronRight /></button><button className="secondary small" onClick={() => setReviewMonth(mKey(today()))}>Bulan ini</button></div>
            <div className="reviewHero"><div><small>WORK COMPLETION</small><strong>{review.completion}%</strong><p>{review.done} dari {review.monthTasks.length} kerjaan selesai pada {monthLabel(reviewMonth)}.</p></div><div className="heroRing"><div>{review.completion}%</div></div></div>
            <div className="grid3">
              <Card title="By Prioritas" Icon={Flag}>{review.byPriority.map((x) => <div className="reviewLine" key={x.label}><span>{x.label}</span><strong>{x.value}</strong></div>)}</Card>
              <Card title="By Kesulitan" Icon={CheckSquare}>{review.byDifficulty.map((x) => <div className="reviewLine" key={x.label}><span>{x.label}</span><strong>{x.value}</strong></div>)}</Card>
              <Card title="Aktivitas" Icon={CalendarDays}><div className="reviewNumbers"><div><strong>{review.monthEvents.length}</strong><span>agenda</span></div><div><strong>{review.monthProjects.length}</strong><span>project terkait</span></div></div></Card>
            </div>
            <div className="grid2">
              <Card title="Yang Perlu Dituntaskan" Icon={CheckSquare}>{review.monthTasks.filter((t) => !t.done).slice(0, 8).map((t) => <div className="reviewTask" key={t.id}><span className={`dot priority-${t.priority.toLowerCase()}`} /><div><strong>{t.title}</strong><small>{dateText(t.deadline)} · {t.priority} · {t.difficulty}</small></div></div>)}{!review.monthTasks.some((t) => !t.done) && <Empty text="Semua kerjaan bulan ini selesai. Mantap." />}</Card>
              <Card title="Refleksi Bulanan" Icon={BarChart3}><div className="reflection"><label>Apa yang paling berhasil bulan ini?<textarea placeholder="Tulis catatan refleksi di sini…" value={reflectionDraft} onChange={(e) => setReflectionDraft(e.target.value)} onBlur={() => saveReflection(reflectionDraft).catch((error) => setCloudError(error.message))} /></label><p>Gunakan review ini untuk menentukan fokus kerja bulan berikutnya.</p></div></Card>
            </div>
          </Page>
        )}
      </main>
      {modalView}
    </div>
  );
}

function Page({ title, desc, add, addLabel, children }) {
  return <><div className="pageTitle"><div><h1>{title}</h1><p>{desc}</p></div>{add && <button className="primary" onClick={add}><Plus size={16} />{addLabel || "Tambah"}</button>}</div>{children}</>;
}

const CSS = `
:root{--rose:#A96F6F;--rose-dark:#6E4A4A;--cream:#f7f5ed;--cream2:#eeece3;--ink:#3f4f3d;--muted:#71806b;--line:#dfe3d7;--white:#fffefa;--danger:#a8615b;--shadow:0 10px 28px rgba(52,65,48,.08)}
*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input,select,textarea{font:inherit}button{cursor:pointer} .app{min-height:100vh;display:grid;grid-template-columns:300px 1fr;background:var(--cream)}
aside{background:var(--rose);color:#f6f3e9;padding:52px 36px 36px;min-height:100vh;display:flex;flex-direction:column}.brand{display:flex;gap:16px;align-items:center}.brand>b{width:52px;height:52px;border-radius:22px;background:#e8eee1;color:var(--rose);display:grid;place-items:center}.brand strong{display:block;letter-spacing:3px;font-family:Georgia,serif;font-size:23px}.brand small{display:block;letter-spacing:3px;opacity:.68;margin-top:2px}.tag{font:italic 18px/1.55 Georgia,serif;opacity:.8;margin:42px 6px 44px}nav{display:flex;flex-direction:column;gap:8px}nav button{border:0;background:transparent;color:#f1efe6;text-align:left;padding:14px 18px;border-radius:18px;display:flex;align-items:center;gap:16px;font-size:17px;transition:.2s}nav button:hover{background:rgba(255,255,255,.07)}nav button.active{background:#f5f2e9;color:var(--rose)}.note{border:1px solid rgba(255,255,255,.17);border-radius:22px;padding:22px;margin-top:auto;color:#f3f0e7}.note>b{margin-left:8px}.note p{font:italic 16px/1.55 Georgia,serif;opacity:.72;margin:18px 0 0}
main{min-width:0;padding:46px 52px 70px}header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:34px}header h1,.pageTitle h1{font:600 38px/1.05 Georgia,serif;margin:0;color:var(--ink)}header p,.pageTitle p{margin:12px 0 0;color:var(--muted);font-size:16px}.date{display:flex;align-items:center;gap:9px;background:var(--white);border:1px solid var(--line);padding:12px 15px;border-radius:15px}.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:18px}.stat{background:var(--white);border:1px solid var(--line);border-radius:20px;padding:17px;display:flex;gap:13px;text-align:left;color:var(--ink);box-shadow:var(--shadow)}.statIcon{width:40px;height:40px;border-radius:13px;background:var(--rose-light);display:grid;place-items:center;flex:none}.stat small,.stat span{display:block;color:var(--muted);font-size:12px}.stat strong{display:block;font-size:21px;margin:4px 0}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:18px}.grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-bottom:18px}.card{background:var(--white);border:1px solid var(--line);border-radius:24px;padding:22px;box-shadow:var(--shadow)}.cardHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.cardHead h2{font-size:16px;margin:0;display:flex;gap:9px;align-items:center}.link{border:0;background:transparent;color:var(--muted);font-size:12px}.link:hover{text-decoration:underline}.taskRow{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #edf0e9}.taskRow:last-child{border-bottom:0}.taskRow.done{opacity:.55}.taskRow.done strong{text-decoration:line-through}.checkBtn{border:0;background:transparent;color:var(--rose);padding:0;display:grid}.taskMain{min-width:0;flex:1}.taskMain strong{display:block;font-size:14px}.meta{display:flex;gap:7px;color:#899487;font-size:11px;margin-top:4px;flex-wrap:wrap}.badges{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.badge{padding:4px 7px;border-radius:8px;font-size:10px;background:#eef0e9}.priority-tinggi{color:#8b4e47;background:#f3e5e2}.priority-sedang{color:#8a6a35;background:#f4eddc}.priority-rendah{color:#5d7656;background:#e5eee0}.diff-mudah{color:#7C5555}.diff-sedang{color:#8A6A4A}.diff-sulit{color:#765451}.rowActions{display:flex;gap:3px}.icon{border:0;background:transparent;color:var(--muted);width:31px;height:31px;border-radius:10px;display:grid;place-items:center}.icon:hover{background:#eef1e9}.icon.danger:hover{background:#f7e9e7;color:var(--danger)}.event{display:flex;gap:13px;padding:13px 0;border-bottom:1px solid #edf0e9}.event:last-child{border:0}.event>b{font-size:12px;color:var(--muted);width:42px}.event strong,.event small{display:block}.event strong{font-size:14px}.event small{font-size:11px;color:var(--muted);margin-top:3px}.projectMini{padding:12px 0}.projectMini>div,.priorityBlock>div,.projectProgress>div{display:flex;justify-content:space-between;gap:10px}.projectMini span,.priorityBlock span{font-size:11px;color:var(--muted)}.progress{height:7px;background:#EFE5E4;border-radius:99px;overflow:hidden;margin-top:8px}.progress span{height:100%;display:block;background:var(--rose);border-radius:99px}.priorityBlock{padding:9px 0}.priorityBlock strong{font-size:13px}.reviewSummary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.reviewSummary>div{background:#f1f3ec;border-radius:15px;padding:14px}.reviewSummary strong{display:block;font-size:24px}.reviewSummary span{font-size:11px;color:var(--muted)}.pageTitle{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:24px}.primary,.secondary{border:0;border-radius:13px;padding:11px 15px;display:inline-flex;align-items:center;gap:7px}.primary{background:var(--rose);color:#fff}.secondary{background:#F0E3E1;color:var(--ink)}.secondary.small{padding:8px 11px;font-size:12px}.filterBar{background:var(--white);border:1px solid var(--line);border-radius:20px;padding:14px 16px;margin-bottom:15px;display:flex;gap:25px;flex-wrap:wrap}.filterBar>div{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.filterBar span{font-size:12px;color:var(--muted);margin-right:3px}.filterBar button{border:0;background:#f0f2eb;color:var(--muted);padding:7px 11px;border-radius:10px;font-size:12px}.filterBar button.selected{background:var(--rose);color:#fff}.taskBoard{background:var(--white);border:1px solid var(--line);border-radius:22px;padding:8px 20px}.monthNav{display:flex;align-items:center;gap:9px;margin-bottom:18px}.monthNav strong{font:600 22px Georgia,serif;margin:0 8px}.calendarList{display:flex;flex-direction:column;gap:12px}.dayBlock{background:var(--white);border:1px solid var(--line);border-radius:20px;overflow:hidden}.dayBlock.today{border-color:#D3A9A9}.dayHead{padding:15px 18px;background:var(--rose-pale);display:flex;justify-content:space-between}.dayHead strong{font-size:14px}.dayHead span{font-size:11px;background:#EED7D7;padding:4px 8px;border-radius:8px}.calendarItem{display:flex;align-items:center;gap:12px;padding:14px 18px;border-top:1px solid #edf0e9}.calendarItem>div:nth-child(2){flex:1}.calendarItem strong,.calendarItem small{display:block}.calendarItem strong{font-size:14px}.calendarItem small{font-size:11px;color:var(--muted);margin-top:4px}.strike{text-decoration:line-through;opacity:.6}.projectGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.projectCard{background:var(--white);border:1px solid var(--line);border-radius:24px;padding:22px;box-shadow:var(--shadow)}.projectTop{display:flex;justify-content:space-between;align-items:center}.projectIcon{width:42px;height:42px;border-radius:14px;background:var(--rose-light);display:grid;place-items:center}.status{font-size:11px;padding:6px 9px;border-radius:9px}.status.running{background:#E7D7D7;color:#7C5555}.status.hold{background:#F2E5D9;color:#8A6A4A}.status.complete{background:#ECE4E3;color:#687168}.projectCard h2{font:600 23px Georgia,serif;margin:18px 0 7px}.projectCard>p{color:var(--muted);font-size:13px;min-height:38px}.projectProgress{margin:20px 0}.projectProgress span{font-size:12px;color:var(--muted)}.projectProgress strong{font-size:14px}.projectMeta{display:flex;justify-content:space-between;color:var(--muted);font-size:11px}.projectActions{display:flex;justify-content:space-between;align-items:center;margin-top:18px}.reviewHero{background:var(--rose);color:#f6f3e9;border-radius:26px;padding:26px;display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.reviewHero small{letter-spacing:2px;opacity:.7}.reviewHero strong{display:block;font:600 46px Georgia,serif;margin:6px 0}.reviewHero p{margin:0;opacity:.75}.heroRing{width:104px;height:104px;border-radius:50%;border:9px solid rgba(255,255,255,.17);border-top-color:#F7E7E5;display:grid;place-items:center;font-weight:700}.reviewLine{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #edf0e9}.reviewLine:last-child{border:0}.reviewLine span{color:var(--muted)}.reviewNumbers{display:grid;grid-template-columns:1fr 1fr;gap:10px}.reviewNumbers>div{background:var(--rose-pale);padding:17px;border-radius:15px}.reviewNumbers strong{display:block;font-size:27px}.reviewNumbers span{font-size:11px;color:var(--muted)}.reviewTask{display:flex;gap:10px;padding:12px 0;border-bottom:1px solid #edf0e9}.reviewTask:last-child{border:0}.reviewTask .dot{width:9px;height:9px;border-radius:50%;margin-top:5px;flex:none}.reviewTask strong,.reviewTask small{display:block}.reviewTask strong{font-size:13px}.reviewTask small{font-size:11px;color:var(--muted);margin-top:3px}.reflection label{display:block;font-size:13px;font-weight:600}.reflection textarea{width:100%;min-height:180px;margin-top:10px;border:1px solid var(--line);background:#fbfaf5;border-radius:15px;padding:13px;resize:vertical;outline:0}.reflection textarea:focus{border-color:#C89A9A}.reflection p{font-size:11px;color:var(--muted)}.empty{padding:22px 6px;color:#98a192;text-align:center;font-size:13px}.backdrop{position:fixed;inset:0;background:rgba(38,46,35,.32);display:grid;place-items:center;padding:20px;z-index:50}.modal{width:min(520px,100%);background:var(--white);border-radius:25px;padding:23px;box-shadow:0 30px 80px rgba(20,30,20,.22)}.modal.wide{width:min(720px,100%)}.modalHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.modalHead h2{font:600 24px Georgia,serif;margin:0}.form{display:flex;flex-direction:column;gap:14px}.form label{font-size:12px;color:var(--muted);display:flex;flex-direction:column;gap:7px}.form input,.form select,.form textarea{border:1px solid var(--line);background:#fbfaf5;border-radius:12px;padding:11px 12px;color:var(--ink);outline:0}.form input:focus,.form select:focus{border-color:#C89A9A}.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.formErr{margin:0;color:var(--danger);font-size:12px}.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:5px}.loading{min-height:100vh;display:grid;place-items:center;background:var(--cream);color:var(--rose)}
@media(max-width:1100px){.app{grid-template-columns:240px 1fr}aside{padding:38px 22px}.stats{grid-template-columns:repeat(3,1fr)}main{padding:36px}.grid3{grid-template-columns:1fr}.projectGrid{grid-template-columns:1fr}}
@media(max-width:760px){.app{display:block}aside{min-height:auto;padding:28px 22px 20px}aside .tag{margin:25px 4px}nav{display:grid;grid-template-columns:1fr 1fr;gap:6px}nav button{padding:11px 12px;font-size:14px}.note{display:none}main{padding:28px 18px 50px}header{gap:15px;flex-direction:column;margin-bottom:25px}header h1,.pageTitle h1{font-size:31px}.date{align-self:flex-start}.stats{grid-template-columns:1fr 1fr}.grid2{grid-template-columns:1fr}.projectGrid{grid-template-columns:1fr}.pageTitle{align-items:flex-start}.pageTitle .primary{white-space:nowrap}.badges{display:none}.rowActions{margin-left:auto}.reviewHero{padding:22px}.reviewHero strong{font-size:39px}.heroRing{width:82px;height:82px}.filterBar{gap:12px}.filterBar>div{width:100%}.two{grid-template-columns:1fr}.modal{padding:20px}.brand strong{font-size:20px}}
`;
