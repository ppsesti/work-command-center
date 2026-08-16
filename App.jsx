import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Zap, CalendarDays, ListChecks, Clock, CheckCircle2, Plus, X, Play,
  Trash2, Pencil, ChevronRight, ChevronDown, AlertTriangle, Minus, Check, Flower2, Target,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

/* ---------------------------------------------------------
   CONFIG / CONSTANTS
--------------------------------------------------------- */
// v1.1 - GitHub Pages / localStorage version
const STORAGE_KEY = "wcc-tasks-v1";
const MISSION_STORAGE_KEY = "wcc-missions-v1";

const LEVELS = [
  { id: "HARD", label: "HARD", weight: 3, color: "#EA6E93" },
  { id: "MEDIUM", label: "MEDIUM", weight: 2, color: "#F3A76C" },
  { id: "EASY", label: "EASY", weight: 1, color: "#F0C15F" },
];
const LEVEL_MAP = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

const CATEGORIES = ["HR", "Admin", "Operasional", "Head", "Kitchen", "Produksi", "Cashier", "BSB", "Cabang ELMO", "Lainnya"];

const STATUS = {
  BELUM: "Belum mulai",
  PROGRESS: "In Progress",
  SELESAI: "Selesai",
};
const PRIORITIES = [
  { id: "WAJIB", label: "WAJIB SELESAI", color: "#D1487A" },
  { id: "PENTING", label: "PENTING", color: "#C97A3E" },
  { id: "WAKTU", label: "ADA WAKTU", color: "#4E9B63" },
];

const emptyForm = {
  title: "",
  deadline: "",
  level: "MEDIUM",
priority: "PENTING",
  estimasiJam: "",
  estimasiMenit: "",
  kategori: "HR",
  dependensi: "",
  catatan: "",
  status: STATUS.BELUM,
  progress: 0,
};

const emptyMissionForm = {
  title: "",
  tujuan: "",
  keterangan: "",
  progress: 0,
};

/* ---------------------------------------------------------
   DATE HELPERS
--------------------------------------------------------- */
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function daysUntil(deadline) {
  if (!deadline) return 999;
  const today = new Date(todayISO() + "T00:00:00");
  const dl = new Date(deadline + "T00:00:00");
  return Math.round((dl - today) / 86400000);
}
function formatDeadlineBadge(deadline) {
  if (!deadline) return { text: "Tanpa deadline", tone: "dim" };
  const d = daysUntil(deadline);
  if (d < 0) return { text: `Terlambat ${Math.abs(d)} hari`, tone: "red" };
  if (d === 0) return { text: "Hari ini", tone: "red" };
  if (d === 1) return { text: "Besok", tone: "amber" };
  if (d <= 7) return { text: `H-${d}`, tone: "amber" };
  return { text: `H-${d}`, tone: "dim" };
}
function formatDateID(deadline) {
  if (!deadline) return "-";
  const d = new Date(deadline + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}
function formatEstimasi(task) {
  const j = Number(task.estimasiJam) || 0;
  const m = Number(task.estimasiMenit) || 0;
  if (!j && !m) return "";
  if (j && m) return `${j}j ${m}m`;
  if (j) return `${j}j`;
  return `${m}m`;
}
function nowClock() {
  const d = new Date();
  return {
    time: d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    day: d.toLocaleDateString("id-ID", { weekday: "long" }),
    date: d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
  };
}

/* ---------------------------------------------------------
   PRIORITY ENGINE
--------------------------------------------------------- */
function urgencyScore(task) {
  const d = daysUntil(task.deadline);
  let base;
  if (d < 0) base = 110;
  else if (d === 0) base = 100;
  else if (d === 1) base = 80;
  else if (d <= 3) base = 60;
  else if (d <= 7) base = 40;
  else base = 15;
  base += (LEVEL_MAP[task.level]?.weight || 1) * 6;
  if (task.status === STATUS.PROGRESS) base += 8;
  if (task.dependensi?.trim()) base -= 12;
  return base;
}
function classify(task) {
  if (task.status === STATUS.SELESAI) return "SELESAI";
  const d = daysUntil(task.deadline);
  const urgent = d <= 1;
  const important = task.level === "HARD" || task.level === "MEDIUM";
  if (task.dependensi?.trim() && task.status === STATUS.BELUM) return "MENUNGGU";
  if (urgent && important) return "KERJAKAN SEKARANG";
  if (important && !urgent) return "JADWALKAN";
  return "BISA NANTI";
}
function reasonFor(task) {
  const d = daysUntil(task.deadline);
  const parts = [];
  if (d < 0) parts.push("sudah lewat deadline");
  else if (d === 0) parts.push("deadline hari ini");
  else if (d <= 3) parts.push(`deadline ${d} hari lagi`);
  if (task.level === "HARD") parts.push("level tinggi");
  if (task.status === STATUS.PROGRESS) parts.push("sedang dikerjakan");
  if (task.status === STATUS.BELUM) parts.push("belum dimulai");
  return parts.join(" + ") || "prioritas berdasarkan urutan sistem";
}

/* ---------------------------------------------------------
   SMALL UI PIECES
--------------------------------------------------------- */
function LevelDot({ level, size = 14 }) {
  const c = LEVEL_MAP[level]?.color || "#C9A2B4";
  return <Flower2 size={size} color={c} strokeWidth={2.2} style={{ flexShrink: 0, filter: `drop-shadow(0 0 3px ${c}66)` }} />;
}
function Badge({ children, tone = "dim" }) {
  const tones = {
    red: { bg: "#FCE4EC", fg: "#D1487A", bd: "#F5C9DA" },
    amber: { bg: "#FDEEDF", fg: "#C97A3E", bd: "#F5DDBF" },
    green: { bg: "#E9F6EC", fg: "#4E9B63", bd: "#CFEAD5" },
    blue: { bg: "#F1ECFA", fg: "#8069B5", bd: "#E1D5F3" },
    dim: { bg: "#FCEEF3", fg: "#B98AA0", bd: "#F6DCE6" },
  };
  const t = tones[tone] || tones.dim;
  return (
    <span className="wcc-mono" style={{ background: t.bg, color: t.fg, border: `1px solid ${t.bd}`, borderRadius: 6, padding: "2px 7px", fontSize: 11, letterSpacing: 0.4, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

/* ---------------------------------------------------------
   TASK CARD
--------------------------------------------------------- */
function TaskCard({ task, onStart, onDone, onProgress, onEdit, onDelete, dense }) {
  const badge = formatDeadlineBadge(task.deadline);
  const lvl = LEVEL_MAP[task.level];
  return (
    <div className="wcc-card" style={{ borderLeft: `3px solid ${lvl?.color || "#333"}` }}>
      <div className="wcc-card-top">
        <div className="wcc-card-title-row">
          <LevelDot level={task.level} />
          <span className="wcc-card-title">{task.title}</span>
        </div>
        <div className="wcc-card-actions">
          <button className="wcc-icon-btn" onClick={() => onEdit(task)} aria-label="Ubah tugas"><Pencil size={14} /></button>
          <button className="wcc-icon-btn wcc-icon-btn-danger" onClick={() => onDelete(task.id)} aria-label="Hapus tugas"><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="wcc-card-meta">
        <Badge tone={badge.tone}>{badge.text}</Badge>
        <Badge>{lvl?.label}</Badge>
        {task.kategori && <Badge tone="blue">{task.kategori}</Badge>}
        {formatEstimasi(task) && <Badge>{formatEstimasi(task)}</Badge>}
        {task.dependensi?.trim() && <Badge tone="amber">Menunggu: {task.dependensi}</Badge>}
      </div>

      {!dense && (
        <>
          <div className="wcc-progress-row">
            <div className="wcc-progress-track"><div className="wcc-progress-fill" style={{ width: `${task.progress}%`, background: lvl?.color }} /></div>
            <span className="wcc-mono wcc-progress-pct">{task.progress}%</span>
          </div>
          <div className="wcc-card-buttons">
            <button className="wcc-btn wcc-btn-ghost" onClick={() => onProgress(task.id, -10)}><Minus size={13} /> 10</button>
            <button className="wcc-btn wcc-btn-ghost" onClick={() => onProgress(task.id, 10)}><Plus size={13} /> 10</button>
            {task.status !== STATUS.PROGRESS && task.status !== STATUS.SELESAI && <button className="wcc-btn wcc-btn-primary" onClick={() => onStart(task.id)}><Play size={13} /> Mulai</button>}
            {task.status !== STATUS.SELESAI && <button className="wcc-btn wcc-btn-success" onClick={() => onDone(task.id)}><Check size={13} /> Selesai</button>}
          </div>
        </>
      )}

      {task.catatan?.trim() && <div className="wcc-card-note">{task.catatan}</div>}
    </div>
  );
}

/* ---------------------------------------------------------
   ADD / EDIT MODAL
--------------------------------------------------------- */
function TaskModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || emptyForm);
  const isEdit = Boolean(initial?.id);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.title.trim()) return;
    onSave({
      ...form,
      id: form.id || `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      progress: Number(form.progress) || 0,
    });
  };

  return (
    <div className="wcc-modal-backdrop" onClick={onClose}>
      <div className="wcc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wcc-modal-head"><span>{isEdit ? "Ubah tugas" : "Tugas baru"}</span><button className="wcc-icon-btn" onClick={onClose}><X size={16} /></button></div>
        <label className="wcc-label">Pekerjaan</label>
        <input className="wcc-input" placeholder="mis. Pengecekan BPJS Kesehatan" value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus />

        <div className="wcc-form-row">
          <div style={{ flex: 1 }}><label className="wcc-label">Deadline</label><input className="wcc-input" type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} /></div>
          <div style={{ flex: 1 }}><label className="wcc-label">Estimasi</label><div className="wcc-form-row">
            <input className="wcc-input" type="number" min="0" placeholder="Jam" value={form.estimasiJam} onChange={(e) => set("estimasiJam", e.target.value)} />
            <input className="wcc-input" type="number" min="0" max="59" placeholder="Menit" value={form.estimasiMenit} onChange={(e) => set("estimasiMenit", e.target.value)} />
          </div></div>
        </div>

        <label className="wcc-label">Level</label>
        <div className="wcc-pill-row">{LEVELS.map((l) => (
          <button key={l.id} className={`wcc-pill ${form.level === l.id ? "wcc-pill-active" : ""}`} style={form.level === l.id ? { borderColor: l.color, color: l.color } : {}} onClick={() => set("level", l.id)}>
            <LevelDot level={l.id} size={8} /> {l.label}
          </button>
        ))}</div>

        <label className="wcc-label">Kategori</label>
        <div className="wcc-pill-row">{CATEGORIES.map((c) => (
          <button key={c} className={`wcc-pill ${form.kategori === c ? "wcc-pill-active" : ""}`} onClick={() => set("kategori", c)}>{c}</button>
        ))}</div>


<label className="wcc-label">Prioritas</label>
<div className="wcc-pill-row">
  {PRIORITIES.map((p) => (
    <button
      key={p.id}
      type="button"
      className={`wcc-pill ${form.priority === p.id ? "wcc-pill-active" : ""}`}
      onClick={() => set("priority", p.id)}
    >
      {p.label}
    </button>
  ))}
</div>

        <label className="wcc-label">Dependensi (opsional)</label>
        <input className="wcc-input" placeholder="mis. Menunggu data karyawan" value={form.dependensi} onChange={(e) => set("dependensi", e.target.value)} />

        <label className="wcc-label">Catatan (opsional)</label>
        <textarea className="wcc-input wcc-textarea" placeholder="Catatan tambahan..." value={form.catatan} onChange={(e) => set("catatan", e.target.value)} />

        <div className="wcc-form-row"><div style={{ flex: 1 }}>
          <label className="wcc-label">Progress ({form.progress}%)</label>
          <input className="wcc-range" type="range" min="0" max="100" step="5" value={form.progress} onChange={(e) => set("progress", e.target.value)} />
        </div></div>

        <button className="wcc-btn wcc-btn-primary wcc-btn-block" onClick={submit}>{isEdit ? "Simpan perubahan" : "Tambah tugas"}</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   WHAT SHOULD I DO MODAL
--------------------------------------------------------- */
function WhatShouldIDoModal({ task, onClose, onStart }) {
  if (!task) return (
    <div className="wcc-modal-backdrop" onClick={onClose}>
      <div className="wcc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wcc-modal-head"><span>Semua aman 🌸</span><button className="wcc-icon-btn" onClick={onClose}><X size={16} /></button></div>
        <div className="wcc-empty-flower">🌷</div>
        <p className="wcc-empty-text">Tidak ada tugas mendesak saat ini. Waktunya istirahat atau lanjutkan yang sedang dikerjakan.</p>
      </div>
    </div>
  );

  const lvl = LEVEL_MAP[task.level];
  const badge = formatDeadlineBadge(task.deadline);

  return (
    <div className="wcc-modal-backdrop" onClick={onClose}>
      <div className="wcc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wcc-modal-head"><span className="wcc-glow-text">🌷 KERJAKAN INI SEKARANG</span><button className="wcc-icon-btn" onClick={onClose}><X size={16} /></button></div>
        <div className="wcc-wsid-title"><LevelDot level={task.level} size={12} /> {task.title}</div>
        <div className="wcc-card-meta" style={{ margin: "10px 0" }}>
          <Badge tone={badge.tone}>{badge.text}</Badge><Badge>{lvl?.label}</Badge>{formatEstimasi(task) && <Badge>{formatEstimasi(task)}</Badge>}
        </div>
        <p className="wcc-empty-text" style={{ margin: "10px 0 16px" }}>Alasan: {reasonFor(task)}.</p>
        <button className="wcc-btn wcc-btn-primary wcc-btn-block" onClick={() => { onStart(task.id); onClose(); }}><Play size={14} /> Mulai sekarang</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   VIEWS
--------------------------------------------------------- */
function EmptyState({ text }) {
  return <div className="wcc-empty"><div className="wcc-empty-flower">🌼</div><p className="wcc-empty-text">{text}</p></div>;
}
function NowView({ tasks, ...handlers }) {
  const list = tasks.filter((t) => classify(t) === "KERJAKAN SEKARANG").sort((a, b) => urgencyScore(b) - urgencyScore(a));
  return <div className="wcc-view"><div className="wcc-view-label"><Zap size={14} /> KERJAKAN SEKARANG · {list.length}</div>
    {list.length === 0 ? <EmptyState text="Tidak ada tugas kritis. Cek tab Today untuk agenda lengkap." /> : list.map((t) => <TaskCard key={t.id} task={t} {...handlers} />)}</div>;
}
function TodayView({ tasks, ...handlers }) {
  const active = tasks.filter((t) => t.status !== STATUS.SELESAI);
  const sorted = [...active].sort((a, b) => urgencyScore(b) - urgencyScore(a));
  const doneToday = tasks.filter((t) => t.status === STATUS.SELESAI && t.completedOn === todayISO());
  return <div className="wcc-view"><div className="wcc-view-label"><CalendarDays size={14} /> AGENDA · {active.length} aktif</div>
    {sorted.length === 0 ? <EmptyState text="Belum ada tugas. Tambahkan tugas pertama kamu." /> : sorted.map((t) => <TaskCard key={t.id} task={t} {...handlers} />)}
    {doneToday.length > 0 && <div className="wcc-today-stats wcc-mono">Progress hari ini: {doneToday.length}/{tasks.filter(t => t.deadline === todayISO() || t.completedOn === todayISO()).length || doneToday.length} selesai</div>}</div>;
}
function AllTasksView({ tasks, ...handlers }) {
  const sorted = [...tasks].sort((a, b) => {
    if ((a.status === STATUS.SELESAI) !== (b.status === STATUS.SELESAI)) return a.status === STATUS.SELESAI ? 1 : -1;
    return urgencyScore(b) - urgencyScore(a);
  });
  return <div className="wcc-view"><div className="wcc-view-label"><ListChecks size={14} /> SEMUA TUGAS · {tasks.length}</div>
    {sorted.length === 0 ? <EmptyState text="Database kosong. Tambahkan tugas untuk mulai." /> : sorted.map((t) => <div key={t.id}><TaskCard task={t} {...handlers} dense={false} /><div className="wcc-status-line wcc-mono">Status: {t.status} {t.kategori ? `· ${t.kategori}` : ""}</div></div>)}</div>;
}
function UpcomingView({ tasks, ...handlers }) {
  const list = tasks.filter((t) => t.status !== STATUS.SELESAI && daysUntil(t.deadline) > 1).sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline));
  return <div className="wcc-view"><div className="wcc-view-label"><Clock size={14} /> AKAN DATANG · {list.length}</div>
    {list.length === 0 ? <EmptyState text="Tidak ada tugas jangka panjang yang tertunda." /> : list.map((t) => <TaskCard key={t.id} task={t} {...handlers} dense />)}</div>;
}
function monthLabelID(monthStr) {
  if (!monthStr) return "-";
  const [y, m] = monthStr.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}
function totalEstimasiLabel(list) {
  let totalMin = 0;
  list.forEach((t) => { totalMin += (Number(t.estimasiJam) || 0) * 60 + (Number(t.estimasiMenit) || 0); });
  if (!totalMin) return "-";
  const j = Math.floor(totalMin / 60), m = totalMin % 60;
  if (j && m) return `${j}j ${m}m`;
  if (j) return `${j}j`;
  return `${m}m`;
}
function DoneView({ tasks, ...handlers }) {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const allDone = tasks.filter((t) => t.status === STATUS.SELESAI).sort((a, b) => (b.completedOn || "").localeCompare(a.completedOn || ""));
  const list = allDone.filter((t) => (t.completedOn || "").slice(0, 7) === month);
  const byLevel = { HARD: 0, MEDIUM: 0, EASY: 0 };
  const byKategori = {};
  list.forEach((t) => { if (byLevel[t.level] !== undefined) byLevel[t.level]++; if (t.kategori) byKategori[t.kategori] = (byKategori[t.kategori] || 0) + 1; });

  return <div className="wcc-view"><div className="wcc-view-label"><CheckCircle2 size={14} /> SELESAI · {allDone.length} total</div>
    <div className="wcc-report-card">
      <div className="wcc-report-head"><span className="wcc-report-title">🗓️ Laporan bulanan</span>
        <input className="wcc-input wcc-month-input" type="month" value={month} max={todayISO().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} />
      </div>
      <div className="wcc-report-big"><span className="wcc-glow-text">{list.length}</span> tugas selesai di {monthLabelID(month)}</div>
      {list.length > 0 && <>
        <div className="wcc-report-row"><span className="wcc-label" style={{ margin: "8px 0 4px" }}>Berdasarkan level</span><div className="wcc-card-meta">{LEVELS.map((l) => byLevel[l.id] > 0 && <Badge key={l.id}>{l.label}: {byLevel[l.id]}</Badge>)}</div></div>
        {Object.keys(byKategori).length > 0 && <div className="wcc-report-row"><span className="wcc-label" style={{ margin: "10px 0 4px" }}>Berdasarkan kategori</span><div className="wcc-card-meta">{Object.entries(byKategori).map(([k, v]) => <Badge key={k} tone="blue">{k}: {v}</Badge>)}</div></div>}
        <div className="wcc-report-row"><span className="wcc-label" style={{ margin: "10px 0 4px" }}>Total estimasi waktu dikerjakan</span><div className="wcc-card-meta"><Badge>{totalEstimasiLabel(list)}</Badge></div></div>
      </>}
    </div>
    {list.length === 0 ? <EmptyState text={`Belum ada tugas selesai di ${monthLabelID(month)}.`} /> : list.map((t) => <TaskCard key={t.id} task={t} {...handlers} dense />)}
  </div>;
}

/* ---------------------------------------------------------
   MISSION / PROJECT CARD & MODAL
--------------------------------------------------------- */
function MissionCard({ mission, expanded, onToggle, onEdit, onDelete }) {
  return <div className="wcc-mission-card">
    <button className="wcc-mission-head" onClick={() => onToggle(mission.id)}>
      <Target size={16} color="#EA6E93" style={{ flexShrink: 0 }} /><span className="wcc-mission-title">{mission.title}</span><span className="wcc-mono wcc-mission-pct">{mission.progress}%</span>
      <ChevronDown size={16} className={`wcc-mission-chevron ${expanded ? "wcc-mission-chevron-open" : ""}`} />
    </button>
    <div className="wcc-progress-row" style={{ padding: "0 14px 12px" }}><div className="wcc-progress-track"><div className="wcc-progress-fill" style={{ width: `${mission.progress}%`, background: "#EA6E93" }} /></div></div>
    {expanded && <div className="wcc-mission-body">
      <div className="wcc-label">Tujuan</div><p className="wcc-mission-text">{mission.tujuan?.trim() || "Belum diisi."}</p>
      <div className="wcc-label">Keterangan progress</div><p className="wcc-mission-text">{mission.keterangan?.trim() || "Belum diisi."}</p>
      <div className="wcc-card-buttons"><button className="wcc-btn wcc-btn-ghost" onClick={() => onEdit(mission)}><Pencil size={13} /> Ubah</button><button className="wcc-btn wcc-btn-ghost" onClick={() => onDelete(mission.id)}><Trash2 size={13} /> Hapus</button></div>
    </div>}
  </div>;
}
function MissionModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || emptyMissionForm);
  const isEdit = Boolean(initial?.id);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.title.trim()) return;
    onSave({ ...form, id: form.id || `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, progress: Number(form.progress) || 0 });
  };
  return <div className="wcc-modal-backdrop" onClick={onClose}>
    <div className="wcc-modal" onClick={(e) => e.stopPropagation()}>
      <div className="wcc-modal-head"><span>{isEdit ? "Ubah misi" : "Misi / proyek baru"}</span><button className="wcc-icon-btn" onClick={onClose}><X size={16} /></button></div>
      <label className="wcc-label">Nama misi / proyek</label><input className="wcc-input" placeholder="mis. Digitalisasi arsip karyawan" value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus />
      <label className="wcc-label">Tujuan</label><textarea className="wcc-input wcc-textarea" placeholder="Kenapa misi ini penting, hasil akhir yang ingin dicapai..." value={form.tujuan} onChange={(e) => set("tujuan", e.target.value)} />
      <label className="wcc-label">Keterangan progress</label><textarea className="wcc-input wcc-textarea" placeholder="Sudah sampai mana, langkah berikutnya..." value={form.keterangan} onChange={(e) => set("keterangan", e.target.value)} />
      <label className="wcc-label">Progress ({form.progress}%)</label><input className="wcc-range" type="range" min="0" max="100" step="5" value={form.progress} onChange={(e) => set("progress", e.target.value)} />
      <button className="wcc-btn wcc-btn-primary wcc-btn-block" style={{ marginTop: 14 }} onClick={submit}>{isEdit ? "Simpan perubahan" : "Tambah misi"}</button>
    </div>
  </div>;
}
function MissionsView({ missions, expandedId, onToggle, onEdit, onDelete }) {
  return <div className="wcc-view"><div className="wcc-view-label"><Target size={14} /> MISI & PROYEK · {missions.length}</div>
    {missions.length === 0 ? <EmptyState text="Belum ada misi. Catat proyek jangka panjang yang ingin kamu ingat di sini." /> :
      missions.map((m) => <MissionCard key={m.id} mission={m} expanded={expandedId === m.id} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />)}
  </div>;
}

/* ---------------------------------------------------------
   MAIN APP
--------------------------------------------------------- */
export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("now");
  const [modalTask, setModalTask] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showWSID, setShowWSID] = useState(false);
  const [clock, setClock] = useState(nowClock());
  const [error, setError] = useState("");

  const [missions, setMissions] = useState([]);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [modalMission, setModalMission] = useState(null);
  const [showAddMission, setShowAddMission] = useState(false);
  const [expandedMissionId, setExpandedMissionId] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setClock(nowClock()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem(STORAGE_KEY);
      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks);
        if (Array.isArray(parsedTasks)) setTasks(parsedTasks);
      }
    } catch (e) {
      console.error("Gagal membaca data tugas:", e);
      setError("Data tugas tidak dapat dibaca.");
    } finally {
      setLoading(false);
    }

    try {
      const savedMissions = localStorage.getItem(MISSION_STORAGE_KEY);
      if (savedMissions) {
        const parsedMissions = JSON.parse(savedMissions);
        if (Array.isArray(parsedMissions)) setMissions(parsedMissions);
      }
    } catch (e) {
      console.error("Gagal membaca data misi:", e);
      setError("Data misi tidak dapat dibaca.");
    } finally {
      setLoadingMissions(false);
    }
  }, []);

  const persist = useCallback((next) => {
    setTasks(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setError("");
    } catch (e) {
      console.error("Gagal menyimpan tugas:", e);
      setError("Gagal menyimpan. Penyimpanan browser mungkin penuh.");
    }
  }, []);

  const persistMissions = useCallback((next) => {
    setMissions(next);
    try {
      localStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(next));
      setError("");
    } catch (e) {
      console.error("Gagal menyimpan misi:", e);
      setError("Gagal menyimpan misi. Penyimpanan browser mungkin penuh.");
    }
  }, []);

  const handleSaveTask = (task) => {
    const exists = tasks.some((t) => t.id === task.id);
    const next = exists ? tasks.map((t) => (t.id === task.id ? task : t)) : [...tasks, task];
    persist(next);
    setModalTask(null);
    setShowAdd(false);
  };

  const handleDelete = (id) => persist(tasks.filter((t) => t.id !== id));
  const handleStart = (id) => persist(tasks.map((t) => t.id === id ? { ...t, status: STATUS.PROGRESS } : t));
  const handleDone = (id) => persist(tasks.map((t) => t.id === id ? { ...t, status: STATUS.SELESAI, progress: 100, completedOn: todayISO() } : t));
  const handleProgress = (id, delta) => persist(tasks.map((t) => {
    if (t.id !== id) return t;
    const p = Math.max(0, Math.min(100, (Number(t.progress) || 0) + delta));
    const completed = p >= 100;
    return {
      ...t,
      progress: p,
      status: completed ? STATUS.SELESAI : t.status === STATUS.BELUM ? STATUS.PROGRESS : t.status,
      completedOn: completed ? todayISO() : t.completedOn,
    };
  }));
  const handleEdit = (task) => setModalTask(task);

  const handleSaveMission = (mission) => {
    const exists = missions.some((m) => m.id === mission.id);
    const next = exists ? missions.map((m) => m.id === mission.id ? mission : m) : [...missions, mission];
    persistMissions(next);
    setModalMission(null);
    setShowAddMission(false);
  };
  const handleDeleteMission = (id) => {
    persistMissions(missions.filter((m) => m.id !== id));
    if (expandedMissionId === id) setExpandedMissionId(null);
  };
  const handleEditMission = (mission) => setModalMission(mission);
  const handleToggleMission = (id) => setExpandedMissionId((cur) => cur === id ? null : id);

  const whatShouldIDo = useMemo(() => {
    const candidates = tasks
      .filter((t) => t.status !== STATUS.SELESAI && !(t.dependensi?.trim() && t.status === STATUS.BELUM))
      .sort((a, b) => urgencyScore(b) - urgencyScore(a));
    return candidates[0] || null;
  }, [tasks]);

  const handlers = { onStart: handleStart, onDone: handleDone, onProgress: handleProgress, onEdit: handleEdit, onDelete: handleDelete };

  const tabs = [
    { id: "now", label: "Now", icon: Zap },
    { id: "today", label: "Today", icon: CalendarDays },
    { id: "all", label: "All", icon: ListChecks },
    { id: "upcoming", label: "Upcoming", icon: Clock },
    { id: "done", label: "Done", icon: CheckCircle2 },
    { id: "misi", label: "Misi", icon: Target },
  ];

  const criticalCount = tasks.filter((t) => classify(t) === "KERJAKAN SEKARANG").length;

  return (
    <div className="wcc-root">
      <style>{CSS}</style>

      <header className="wcc-header">
        <span className="wcc-deco-flower wcc-deco-flower-1">🌸</span>
        <span className="wcc-deco-flower wcc-deco-flower-2">🌷</span>
        <div className="wcc-header-top">
          <span className="wcc-mono wcc-clock">{clock.time}</span>
          <span className="wcc-mono wcc-day">{clock.day.toUpperCase()}</span>
        </div>
        <h1 className="wcc-title"><Flower2 size={14} className="wcc-title-flower" /> WORK COMMAND CENTER</h1>
        <div className="wcc-subtitle">HR & Operations Generalist</div>
        <div className="wcc-date">{clock.date}</div>
        {criticalCount > 0 && <div className="wcc-critical-strip wcc-mono"><AlertTriangle size={13} /> {criticalCount} tugas butuh perhatian sekarang</div>}
      </header>

      <button className="wcc-wsid-btn" onClick={() => setShowWSID(true)}>
        <Flower2 size={16} /> WHAT SHOULD I DO? <ChevronRight size={16} />
      </button>

      {error && <div className="wcc-error-strip wcc-mono">{error}</div>}

      <main className="wcc-main">
        {view === "misi" ? (
          loadingMissions ? (
            <div className="wcc-empty"><p className="wcc-empty-text">Memuat data...</p></div>
          ) : (
            <MissionsView missions={missions} expandedId={expandedMissionId} onToggle={handleToggleMission} onEdit={handleEditMission} onDelete={handleDeleteMission} />
          )
        ) : loading ? (
          <div className="wcc-empty"><p className="wcc-empty-text">Memuat data...</p></div>
        ) : (
          <>
            {view === "now" && <NowView tasks={tasks} {...handlers} />}
            {view === "today" && <TodayView tasks={tasks} {...handlers} />}
            {view === "all" && <AllTasksView tasks={tasks} {...handlers} />}
            {view === "upcoming" && <UpcomingView tasks={tasks} {...handlers} />}
            {view === "done" && <DoneView tasks={tasks} {...handlers} />}
          </>
        )}
      </main>

      <button
        className="wcc-fab"
        onClick={() => (view === "misi" ? setShowAddMission(true) : setShowAdd(true))}
        aria-label={view === "misi" ? "Tambah misi" : "Tambah tugas"}
      >
        <Plus size={22} />
      </button>

      <nav className="wcc-tabbar">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = view === t.id;
          return (
            <button key={t.id} className={`wcc-tab ${active ? "wcc-tab-active" : ""}`} onClick={() => setView(t.id)}>
              <Icon size={18} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {(showAdd || modalTask) && (
        <TaskModal
          initial={modalTask}
          onClose={() => { setShowAdd(false); setModalTask(null); }}
          onSave={handleSaveTask}
        />
      )}

      {showWSID && <WhatShouldIDoModal task={whatShouldIDo} onClose={() => setShowWSID(false)} onStart={handleStart} />}

      {(showAddMission || modalMission) && (
        <MissionModal
          initial={modalMission}
          onClose={() => { setShowAddMission(false); setModalMission(null); }}
          onSave={handleSaveMission}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   STYLES
--------------------------------------------------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&family=Fredoka:wght@500;600;700&family=Caveat:wght@600;700&display=swap');

.wcc-root {
  min-height: 100vh;
  background: #FFF6F8;
  background-image:
    radial-gradient(circle at 12% 0%, #FFE9F0 0%, transparent 45%),
    radial-gradient(circle at 100% 20%, #FFF1E6 0%, transparent 40%),
    radial-gradient(circle at 0% 90%, #F3ECFB 0%, transparent 45%);
  color: #5C3A46;
  font-family: 'Quicksand', system-ui, sans-serif;
  padding-bottom: 90px;
  position: relative;
}
.wcc-mono { font-family: 'Quicksand', sans-serif; font-weight: 600; }
.wcc-header { padding: 22px 18px 16px; border-bottom: 1px dashed #F3D2E0; position: relative; overflow: hidden; }
.wcc-deco-flower { position: absolute; opacity: 0.35; pointer-events: none; filter: saturate(0.9); }
.wcc-deco-flower-1 { top: 6px; right: 14px; font-size: 34px; transform: rotate(12deg); }
.wcc-deco-flower-2 { top: 58px; right: 62px; font-size: 18px; opacity: 0.25; transform: rotate(-8deg); }
.wcc-header-top { display: flex; justify-content: space-between; align-items: baseline; }
.wcc-clock { font-size: 22px; color: #E8779B; letter-spacing: 1px; }
.wcc-day { font-size: 11px; color: #C79AAE; letter-spacing: 2px; }
.wcc-title { font-family: 'Fredoka', 'Quicksand', sans-serif; font-size: 15px; letter-spacing: 1.5px; color: #D1487A; margin: 12px 0 2px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.wcc-title-flower { color: #F3A76C; flex-shrink: 0; }
.wcc-subtitle { font-family: 'Caveat', cursive; font-size: 18px; color: #C589A3; margin-bottom: 4px; }
.wcc-date { font-size: 19px; font-weight: 700; color: #6B4652; }
.wcc-critical-strip { margin-top: 12px; display: flex; align-items: center; gap: 6px; color: #C2557C; font-size: 12px; background: #FDE9F0; border: 1px solid #F6CBDD; padding: 7px 11px; border-radius: 12px; width: fit-content; font-weight: 600; }
.wcc-wsid-btn { width: calc(100% - 36px); margin: 16px 18px 4px; padding: 15px 16px; background: linear-gradient(135deg, #FFE3ED, #FFF1DF); border: 1.5px solid #F7C9DC; border-radius: 18px; color: #C2557C; font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 13px; letter-spacing: 0.6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 6px 16px rgba(240,150,180,0.25); }
.wcc-wsid-btn:active { transform: scale(0.98); }
.wcc-error-strip { margin: 10px 18px 0; color: #C2557C; font-size: 11px; }
.wcc-main { padding: 16px 14px 8px; }
.wcc-view-label { display: flex; align-items: center; gap: 6px; font-size: 12px; letter-spacing: 1px; color: #B98AA0; font-weight: 700; margin-bottom: 10px; padding-left: 2px; }
.wcc-card { background: #FFFFFF; border: 1px solid #F7DEE8; border-radius: 16px; padding: 13px 15px; margin-bottom: 12px; box-shadow: 0 3px 10px rgba(220,150,180,0.08); }
.wcc-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.wcc-card-title-row { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.wcc-card-title { font-size: 14.5px; font-weight: 600; color: #5C3A46; line-height: 1.3; }
.wcc-card-actions { display: flex; gap: 4px; flex-shrink: 0; }
.wcc-icon-btn { background: transparent; border: none; color: #C9A2B4; padding: 4px; cursor: pointer; border-radius: 8px; display: flex; }
.wcc-icon-btn:active { background: #FCEEF3; }
.wcc-icon-btn-danger:active { color: #E8607D; }
.wcc-card-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.wcc-progress-row { display: flex; align-items: center; gap: 8px; margin-top: 11px; }
.wcc-progress-track { flex: 1; height: 7px; background: #FBEAF0; border-radius: 6px; overflow: hidden; }
.wcc-progress-fill { height: 100%; border-radius: 6px; transition: width 0.2s; }
.wcc-progress-pct { font-size: 11px; color: #C9A2B4; min-width: 32px; text-align: right; }
.wcc-card-buttons { display: flex; gap: 6px; margin-top: 11px; flex-wrap: wrap; }
.wcc-btn { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; padding: 7px 12px; border-radius: 999px; border: 1px solid #F3D8E4; background: #FFF8FA; color: #8A6373; cursor: pointer; }
.wcc-btn-ghost { color: #C9A2B4; }
.wcc-btn-primary { background: #FFE3ED; border-color: #F6C6D9; color: #D1487A; }
.wcc-btn-success { background: #E9F6EC; border-color: #CFEAD5; color: #4E9B63; }
.wcc-btn-block { width: 100%; justify-content: center; padding: 13px; font-size: 13px; }
.wcc-btn:active { transform: scale(0.97); }
.wcc-card-note { margin-top: 10px; font-size: 12.5px; color: #A8798C; border-top: 1px dashed #F3D8E4; padding-top: 8px; }
.wcc-status-line { font-size: 10.5px; color: #C9A2B4; margin: -8px 0 14px 6px; }
.wcc-today-stats, .wcc-done-stat { margin-top: 6px; padding: 11px 13px; background: #FFF1F6; border: 1px solid #F7DEE8; border-radius: 12px; font-size: 12px; color: #A8798C; }
.wcc-glow-text { color: #D1487A; font-weight: 700; }
.wcc-report-card { background: #FFF9FB; border: 1.5px dashed #F3C6D9; border-radius: 16px; padding: 13px 15px 15px; margin-bottom: 14px; }
.wcc-report-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.wcc-report-title { font-family: 'Fredoka', sans-serif; font-size: 13px; font-weight: 600; color: #C2557C; }
.wcc-month-input { width: auto; padding: 6px 10px; font-size: 12.5px; }
.wcc-report-big { font-size: 15px; color: #6B4652; margin-top: 10px; font-weight: 600; }
.wcc-report-row { display: flex; flex-direction: column; }
.wcc-empty { padding: 34px 10px 40px; text-align: center; }
.wcc-empty-flower { font-size: 34px; opacity: 0.6; margin-bottom: 6px; }
.wcc-empty-text { color: #C29AAC; font-size: 13px; line-height: 1.6; }
.wcc-fab { position: fixed; right: 18px; bottom: 88px; width: 54px; height: 54px; border-radius: 50%; background: linear-gradient(135deg, #F0A6C4, #EA6E93); color: #FFF8FA; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(234,110,147,0.4); cursor: pointer; z-index: 20; }
.wcc-fab:active { transform: scale(0.94); }
.wcc-tabbar { position: fixed; bottom: 0; left: 0; right: 0; background: #FFFBFC; border-top: 1px solid #F7DEE8; display: flex; padding: 6px 4px calc(env(safe-area-inset-bottom, 0px) + 6px); z-index: 15; }
.wcc-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; background: transparent; border: none; color: #D4B4C2; font-size: 10px; font-weight: 600; padding: 6px 2px; cursor: pointer; }
.wcc-tab-active { color: #D1487A; }
.wcc-modal-backdrop { position: fixed; inset: 0; background: rgba(90,50,65,0.35); display: flex; align-items: flex-end; justify-content: center; z-index: 50; }
.wcc-modal { background: #FFFBFC; border: 1px solid #F7DEE8; border-top-left-radius: 22px; border-top-right-radius: 22px; width: 100%; max-width: 480px; padding: 18px 18px 26px; max-height: 88vh; overflow-y: auto; }
.wcc-modal-head { display: flex; justify-content: space-between; align-items: center; font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 15px; margin-bottom: 14px; color: #6B4652; }
.wcc-label { display: block; font-size: 11px; color: #B98AA0; letter-spacing: 0.5px; margin: 12px 0 5px; font-weight: 700; }
.wcc-input { width: 100%; background: #FFF6F8; border: 1.5px solid #F3D8E4; border-radius: 12px; padding: 10px 12px; color: #5C3A46; font-size: 14px; font-family: inherit; box-sizing: border-box; }
.wcc-input:focus { outline: none; border-color: #EFA9C4; }
.wcc-textarea { min-height: 64px; resize: vertical; }
.wcc-form-row { display: flex; gap: 10px; }
.wcc-range { width: 100%; accent-color: #EA6E93; }
.wcc-pill-row { display: flex; flex-wrap: wrap; gap: 6px; }
.wcc-pill { display: flex; align-items: center; gap: 5px; padding: 6px 11px; border-radius: 999px; border: 1.5px solid #F3D8E4; background: #FFF6F8; color: #B98AA0; font-size: 12px; font-weight: 600; cursor: pointer; }
.wcc-pill-active { background: #FFE3ED; color: #C2557C; }
.wcc-wsid-title { font-family: 'Fredoka', sans-serif; font-size: 17px; font-weight: 600; color: #6B4652; display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.wcc-mission-card { background: #FFFFFF; border: 1px solid #F7DEE8; border-radius: 16px; margin-bottom: 12px; box-shadow: 0 3px 10px rgba(220,150,180,0.08); overflow: hidden; }
.wcc-mission-head { width: 100%; display: flex; align-items: center; gap: 9px; padding: 13px 14px 8px; background: transparent; border: none; cursor: pointer; text-align: left; }
.wcc-mission-title { flex: 1; font-size: 14.5px; font-weight: 600; color: #5C3A46; }
.wcc-mission-pct { font-size: 12px; color: #C9A2B4; }
.wcc-mission-chevron { color: #D4B4C2; transition: transform 0.2s; flex-shrink: 0; }
.wcc-mission-chevron-open { transform: rotate(180deg); }
.wcc-mission-body { padding: 4px 14px 14px; border-top: 1px dashed #F3D8E4; margin-top: 2px; padding-top: 12px; }
.wcc-mission-text { font-size: 13px; color: #7A5764; line-height: 1.6; margin: 2px 0 12px; white-space: pre-wrap; }
@media (min-width: 520px) {
  .wcc-modal-backdrop { align-items: center; }
  .wcc-modal { border-radius: 22px; }
}
`;

if (typeof document !== "undefined") {
  // Keep browser tab title useful.
  document.title = "Work Command Center";
}
