import React, { useState, useEffect, useMemo } from "react";
import {
  Users, Calendar, Wallet, Megaphone, LogOut, Plus, Trash2, Pencil,
  X, Check, ChevronRight, Circle, Settings as SettingsIcon,
  Phone, CreditCard, HeartHandshake, Clock, AlertCircle, KeyRound,
  ClipboardCheck, FileText, MessageSquare, Printer, UserCheck, UserX,
  Coins, LayoutDashboard, TrendingUp, HandCoins, Gift, CalendarDays, Bell, ArrowUpRight
} from "lucide-react";
import {
  listTable, addRow, updateRowById, deleteRowById,
  fetchSettings, updateSettings, fetchAttendance, saveAttendanceForEvent, deleteRepaymentsForLoan
} from "./supabaseClient";

const TEAL = "#164B47";
const TEAL_DARK = "#0D302D";
const GOLD = "#C99A2E";
const CREAM = "#FBF7EF";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = (dateStr) => (dateStr || todayISO()).slice(0, 7);
const fmtKES = (n) => `Ksh ${Number(n || 0).toLocaleString()}`;
const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date(todayISO() + "T00:00:00");
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due - today) / 86400000);
};
const loanDueState = (loan) => {
  if (loan.status === "repaid" || loan.actual_return_date) return { key: "repaid", label: "Fully repaid", color: TEAL };
  if (!loan.due_date) return { key: "no_due_date", label: "No due date", color: "#8A8270" };
  const days = daysUntil(loan.due_date);
  if (days < 0) return { key: "overdue", label: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`, color: "#B3391F" };
  if (days === 0) return { key: "due_today", label: "Due today", color: "#B3391F" };
  if (days <= 7) return { key: "due_soon", label: `Due in ${days} day${days === 1 ? "" : "s"}`, color: GOLD };
  return { key: "active", label: "Outstanding", color: TEAL };
};
const loanDueMessage = (loan) => `Your loan is due on ${fmtDate(loan.due_date)} kindly pay up to avoid penalties.`;

function smsLink(phones, message) {
  const nums = phones.filter(Boolean).join(",");
  return `sms:${nums}?&body=${encodeURIComponent(message)}`;
}

// Table banking balance = money contributed to that fund, plus everything
// repaid on loans (principal + interest), minus principal currently out on
// loan. Interest collected on repayment stays in the fund as growth.
function tableBankingBalance(contributions, loans, loanRepayments) {
  const contributed = contributions.filter((c) => c.type === "tableBanking").reduce((s, c) => s + Number(c.amount), 0);
  const repaid = loanRepayments.reduce((s, r) => s + Number(r.amount), 0);
  const lent = loans.reduce((s, l) => s + Number(l.principal), 0);
  return contributed + repaid - lent;
}

const CONTRIB_TYPES = [
  { key: "monthly", label: "Monthly Share", settingCol: "monthly" },
  { key: "merryGoRound", label: "Merry-Go-Round", settingCol: "merry_go_round" },
  { key: "benevolent", label: "Benevolent Fund", settingCol: "benevolent" },
  { key: "tableBanking", label: "Table Banking", settingCol: "table_banking" },
];
const typeToSettingCol = (type) => CONTRIB_TYPES.find((t) => t.key === type)?.settingCol;

export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [settings, setSettings] = useState(null);
  const [attendance, setAttendanceState] = useState({});
  const [minutes, setMinutesState] = useState([]);
  const [loans, setLoansState] = useState([]);
  const [loanRepayments, setLoanRepaymentsState] = useState([]);
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [showPwModal, setShowPwModal] = useState(false);

  const loadAppData = async () => {
    const [mem, ev, con, ann, set, att, min, ln, lr] = await Promise.all([
      listTable("members"),
      listTable("events"),
      listTable("contributions"),
      listTable("announcements"),
      fetchSettings(),
      fetchAttendance(),
      listTable("minutes"),
      listTable("loans"),
      listTable("loan_repayments"),
    ]);
    setMembers(mem);
    setEvents(ev);
    setContributions(con);
    setAnnouncements(ann);
    setSettings(set);
    setAttendanceState(att);
    setMinutesState(min);
    setLoansState(ln);
    setLoanRepaymentsState(lr);
  };

  // Load only the accounts needed for login first. Financial/member data is
  // fetched only after a successful login, reducing unnecessary exposure.
  useEffect(() => {
    (async () => {
      try {
        const acc = await listTable("accounts");
        setAccounts(acc);
      } catch (e) {
        setLoadError(e.message || "Could not connect to the database.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = {
    accounts: {
      add: async (row) => setAccounts((s) => [...s, ...[]].concat()), // placeholder not used directly
    },
  };

  // Simple CRUD helpers exposed to children
  const crud = {
    addMember: async (row) => { const r = await addRow("members", row); setMembers((s) => [...s, r]); return r; },
    updateMember: async (id, patch) => { const r = await updateRowById("members", id, patch); setMembers((s) => s.map((m) => (m.id === id ? r : m))); return r; },
    removeMember: async (id) => { await deleteRowById("members", id); setMembers((s) => s.filter((m) => m.id !== id)); setAccounts((s) => s.filter((a) => a.member_id !== id)); },

    addAccount: async (row) => { const r = await addRow("accounts", row); setAccounts((s) => [...s, r]); return r; },
    updateAccount: async (id, patch) => { const r = await updateRowById("accounts", id, patch); setAccounts((s) => s.map((a) => (a.id === id ? r : a))); return r; },

    addEvent: async (row) => { const r = await addRow("events", row); setEvents((s) => [...s, r]); return r; },
    removeEvent: async (id) => { await deleteRowById("events", id); setEvents((s) => s.filter((e) => e.id !== id)); },

    addContribution: async (row) => { const r = await addRow("contributions", row); setContributions((s) => [...s, r]); return r; },
    removeContribution: async (id) => { await deleteRowById("contributions", id); setContributions((s) => s.filter((c) => c.id !== id)); },

    addAnnouncement: async (row) => { const r = await addRow("announcements", row); setAnnouncements((s) => [...s, r]); return r; },
    removeAnnouncement: async (id) => { await deleteRowById("announcements", id); setAnnouncements((s) => s.filter((a) => a.id !== id)); },

    addMinutes: async (row) => { const r = await addRow("minutes", row); setMinutesState((s) => [...s, r]); return r; },
    removeMinutes: async (id) => { await deleteRowById("minutes", id); setMinutesState((s) => s.filter((m) => m.id !== id)); },

    // Loans are validated again against fresh database data immediately
    // before writing, so an old browser state is less likely to approve an
    // unsafe loan.
    addLoan: async ({ member_id, principal, interest_rate, note, date_borrowed, due_date }) => {
      const amount = Number(principal);
      const rate = Number(interest_rate);
      if (!member_id) throw new Error("Select a member.");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid loan amount greater than zero.");
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error("Interest rate must be between 0% and 100%.");

      const [freshContributions, freshLoans, freshRepayments] = await Promise.all([
        listTable("contributions"),
        listTable("loans"),
        listTable("loan_repayments"),
      ]);
      const available = Math.max(0, tableBankingBalance(freshContributions, freshLoans, freshRepayments));
      if (amount > available) {
        throw new Error(`Not enough money in the table banking fund. Available: ${fmtKES(available)}.`);
      }

      const interestAmount = Math.round(amount * (rate / 100) * 100) / 100;
      const row = {
        member_id,
        principal: amount,
        interest_rate: rate,
        interest_amount: interestAmount,
        total_due: Math.round((amount + interestAmount) * 100) / 100,
        amount_repaid: 0,
        status: "outstanding",
        date_borrowed: date_borrowed || todayISO(),
        due_date: due_date || null,
        actual_return_date: null,
        note: note?.trim() || null,
      };
      const r = await addRow("loans", row);
      setLoansState((s) => [...s, r]);
      return r;
    },
    removeLoan: async (id) => {
      if (!window.confirm("Delete this loan and its repayment history? This cannot be undone.")) return;
      // Remove child repayment rows first so this works whether or not the
      // database foreign key is configured with ON DELETE CASCADE.
      await deleteRepaymentsForLoan(id);
      await deleteRowById("loans", id);
      setLoansState((s) => s.filter((l) => l.id !== id));
      setLoanRepaymentsState((s) => s.filter((r) => r.loan_id !== id));
    },
    addRepayment: async (loanId, amount) => {
      const payment = Number(amount);
      const current = loans.find((l) => l.id === loanId);
      if (!current) throw new Error("Loan could not be found. Refresh the page and try again.");
      const remaining = Math.max(0, Number(current.total_due) - Number(current.amount_repaid));
      if (!Number.isFinite(payment) || payment <= 0) throw new Error("Enter a valid repayment amount greater than zero.");
      if (payment > remaining + 0.000001) throw new Error(`Repayment cannot exceed the remaining balance of ${fmtKES(remaining)}.`);

      const r = await addRow("loan_repayments", { loan_id: loanId, amount: payment, date: todayISO() });
      const newRepaid = Math.min(Number(current.total_due), Number(current.amount_repaid) + payment);
      try {
        const updated = await updateRowById("loans", loanId, {
          amount_repaid: newRepaid,
          status: newRepaid >= Number(current.total_due) ? "repaid" : "outstanding",
          actual_return_date: newRepaid >= Number(current.total_due) ? todayISO() : null,
        });
        setLoanRepaymentsState((s) => [...s, r]);
        setLoansState((s) => s.map((l) => (l.id === loanId ? updated : l)));
        return r;
      } catch (e) {
        // Best-effort rollback of the repayment if the loan update fails.
        try { await deleteRowById("loan_repayments", r.id); } catch {}
        throw e;
      }
    },

    saveSettings: async (patch) => { const r = await updateSettings(patch); setSettings(r); return r; },

    saveAttendance: async (eventId, recMap) => {
      await saveAttendanceForEvent(eventId, recMap);
      setAttendanceState((prev) => ({ ...prev, [eventId]: recMap }));
    },
  };

  if (loading) {
    return (
      <div style={{ background: CREAM }} className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 animate-spin" style={{ borderColor: TEAL, borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: TEAL_DARK }}>Loading Matayia's Welfare…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ background: CREAM }} className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <AlertCircle size={28} color="#B3391F" className="mx-auto mb-3" />
          <p className="text-sm font-semibold" style={{ color: TEAL_DARK }}>Could not connect</p>
          <p className="text-xs mt-2" style={{ color: "#7A7364" }}>{loadError}</p>
          <p className="text-xs mt-3" style={{ color: "#7A7364" }}>Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly in your environment.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        accounts={accounts}
        onLogin={async (acc) => {
          try {
            setLoading(true);
            setLoadError("");
            await loadAppData();
            setSession(acc);
            setTab(acc.role === "admin" ? "dashboard" : "home");
          } catch (e) {
            setLoadError(e.message || "Could not load welfare data.");
          } finally {
            setLoading(false);
          }
        }}
      />
    );
  }

  return (
    <Shell session={session} onLogout={() => setSession(null)} tab={tab} setTab={setTab} onChangePassword={() => setShowPwModal(true)}>
      {tab === "home" && (
        <MemberHome session={session} members={members} contributions={contributions} events={events} announcements={announcements} loans={loans} />
      )}
      {tab === "dashboard" && session.role === "admin" && (
        <AdminDashboard
          members={members}
          contributions={contributions}
          loans={loans}
          loanRepayments={loanRepayments}
          events={events}
          announcements={announcements}
          settings={settings}
          setTab={setTab}
        />
      )}
      {tab === "members" && session.role === "admin" && (
        <MembersTab members={members} accounts={accounts} crud={crud} />
      )}
      {tab === "events" && (
        <EventsTab events={events} isAdmin={session.role === "admin"} members={members} attendance={attendance} crud={crud} />
      )}
      {tab === "contributions" && (
        <ContributionsTab session={session} members={members} contributions={contributions} settings={settings} crud={crud} />
      )}
      {tab === "loans" && (
        <LoansTab session={session} members={members} loans={loans} loanRepayments={loanRepayments} contributions={contributions} settings={settings} crud={crud} />
      )}
      {tab === "announcements" && (
        <AnnouncementsTab announcements={announcements} isAdmin={session.role === "admin"} members={members} crud={crud} />
      )}
      {tab === "minutes" && (
        <MinutesTab minutes={minutes} isAdmin={session.role === "admin"} crud={crud} />
      )}
      {tab === "settings" && session.role === "admin" && (
        <SettingsTab settings={settings} crud={crud} />
      )}
      {showPwModal && (
        <ChangePasswordModal session={session} accounts={accounts} crud={crud} onClose={() => setShowPwModal(false)} />
      )}
    </Shell>
  );
}

function LoginScreen({ accounts, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    const acc = accounts.find(
      (a) => a.username.toLowerCase() === username.trim().toLowerCase() && a.password === password
    );
    if (!acc) { setErr("Incorrect username or password."); return; }
    onLogin(acc);
  };

  return (
    <div style={{ background: TEAL_DARK }} className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: `conic-gradient(${GOLD} 0deg 120deg, #ffffff22 120deg 360deg)` }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: TEAL_DARK }}>
              <HeartHandshake size={22} color={GOLD} />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-center" style={{ color: CREAM }}>Matayia's Welfare</h1>
          <p className="text-xs mt-1" style={{ color: "#B9CFC9" }}>Together we stand, together we grow</p>
        </div>

        <div className="rounded-2xl p-6 space-y-4" style={{ background: CREAM }}>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: TEAL_DARK }}>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none border" style={{ borderColor: "#D8CFBB" }} placeholder="e.g. admin" autoCapitalize="none" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: TEAL_DARK }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none border" style={{ borderColor: "#D8CFBB" }} placeholder="••••••••" />
          </div>
          {err && <p className="text-xs flex items-center gap-1" style={{ color: "#B3391F" }}><AlertCircle size={13} /> {err}</p>}
          <button onClick={submit} className="w-full rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2" style={{ background: TEAL, color: CREAM }}>
            Log in <ChevronRight size={16} />
          </button>
          <p className="text-[11px] text-center pt-1" style={{ color: "#8A8270" }}>
            If this is the first setup, use the admin credentials supplied with your database setup, then change the password.
          </p>
        </div>
      </div>
    </div>
  );
}

function Shell({ session, onLogout, tab, setTab, children, onChangePassword }) {
  const adminTabs = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "members", label: "Members", icon: Users },
    { key: "events", label: "Events", icon: Calendar },
    { key: "contributions", label: "Funds", icon: Wallet },
    { key: "loans", label: "Loans", icon: Coins },
    { key: "minutes", label: "Minutes", icon: FileText },
    { key: "announcements", label: "News", icon: Megaphone },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];
  const memberTabs = [
    { key: "home", label: "Home", icon: Circle },
    { key: "events", label: "Events", icon: Calendar },
    { key: "contributions", label: "My Funds", icon: Wallet },
    { key: "loans", label: "Loans", icon: Coins },
    { key: "minutes", label: "Minutes", icon: FileText },
    { key: "announcements", label: "News", icon: Megaphone },
  ];
  const tabs = session.role === "admin" ? adminTabs : memberTabs;

  return (
    <div style={{ background: CREAM }} className="min-h-screen flex flex-col">
      <div style={{ background: TEAL }} className="px-4 pt-5 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide" style={{ color: "#9FC4BC" }}>{session.role === "admin" ? "Admin" : "Member"}</p>
            <h1 className="text-base font-semibold" style={{ color: CREAM }}>Matayia's Welfare</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onChangePassword} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full" style={{ background: "#ffffff1A", color: CREAM }}>
              <KeyRound size={13} /> Password
            </button>
            <button onClick={onLogout} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full" style={{ background: "#ffffff1A", color: CREAM }}>
              <LogOut size={13} /> Log out
            </button>
          </div>
        </div>
        <p className="text-xs mt-1" style={{ color: "#CFE3DE" }}>Hi, {session.name}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 max-w-3xl w-full mx-auto">{children}</div>

      <div className="fixed bottom-0 left-0 right-0 flex justify-center">
        <div className="w-full max-w-3xl flex border-t" style={{ background: CREAM, borderColor: "#E3DCC9" }}>
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className="flex-1 flex flex-col items-center gap-1 py-2.5" style={{ color: active ? TEAL : "#9A9382" }}>
                <Icon size={18} strokeWidth={active ? 2.4 : 1.8} />
                <span className="text-[10px] font-medium">{t.label}</span>
                {active && <div className="w-1 h-1 rounded-full" style={{ background: GOLD }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ children }) {
  return <div className="rounded-xl p-4 mb-3 border" style={{ background: "#fff", borderColor: "#EDE6D3" }}>{children}</div>;
}
function EmptyState({ text }) {
  return <div className="rounded-xl p-6 text-center border border-dashed" style={{ borderColor: "#D8CFBB" }}><p className="text-sm" style={{ color: "#9A9382" }}>{text}</p></div>;
}

/* ---------------- ADMIN DASHBOARD ---------------- */
function AdminDashboard({ members, contributions, loans, loanRepayments, events, announcements, settings, setTab }) {
  const today = todayISO();
  const month = monthKey(today);
  const activeLoans = loans.filter((l) => l.status !== "repaid" && !l.actual_return_date);
  const outstanding = activeLoans.reduce((s, l) => s + Math.max(0, Number(l.total_due || 0) - Number(l.amount_repaid || 0)), 0);
  const totalFundContributions = contributions.reduce((s, c) => s + Number(c.amount || 0), 0);
  const monthlyContributions = contributions.filter((c) => monthKey(c.date) === month).reduce((s, c) => s + Number(c.amount || 0), 0);
  const tableBalance = tableBankingBalance(contributions, loans, loanRepayments);
  const dueSoon = activeLoans.filter((l) => {
    const d = daysUntil(l.due_date);
    return d !== null && d >= 0 && d <= 7;
  });
  const overdue = activeLoans.filter((l) => daysUntil(l.due_date) !== null && daysUntil(l.due_date) < 0);
  const upcomingEvents = [...events].filter((e) => e.date >= today).sort((a,b) => a.date.localeCompare(b.date));
  const recentContribs = [...contributions].sort((a,b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  const memberName = (id) => members.find((m) => m.id === id)?.name || "Unknown member";

  const cards = [
    { title: "Members", value: members.length, icon: Users, bg: "#E7F3F0", iconBg: "#CDE7E1", color: TEAL, tab: "members" },
    { title: "Funds collected", value: fmtKES(totalFundContributions), icon: Wallet, bg: "#FFF4D9", iconBg: "#FBE5A6", color: "#8A6817", tab: "contributions" },
    { title: "Table banking", value: fmtKES(tableBalance), icon: HandCoins, bg: "#EAF0FF", iconBg: "#D7E1FF", color: "#3655A6", tab: "loans" },
    { title: "Loan balance", value: fmtKES(outstanding), icon: Coins, bg: "#F7E8F1", iconBg: "#EBCFDE", color: "#8B3563", tab: "loans" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-5 text-white overflow-hidden relative" style={{ background: "linear-gradient(135deg, #164B47 0%, #28756C 100%)" }}>
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-widest opacity-80">Administrator dashboard</p>
          <h2 className="text-2xl font-bold mt-1">Welcome back 👋</h2>
          <p className="text-xs mt-1 opacity-80">Here is today's welfare overview.</p>
        </div>
        <div className="absolute -right-8 -bottom-12 w-40 h-40 rounded-full" style={{ background: "#ffffff12" }} />
        <div className="absolute right-12 -top-10 w-24 h-24 rounded-full" style={{ background: "#C99A2E33" }} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return <button key={c.title} onClick={() => setTab(c.tab)} className="text-left rounded-2xl p-4 border transition-transform active:scale-[0.98]" style={{ background: c.bg, borderColor: c.iconBg }}>
            <div className="flex items-start justify-between"><div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: c.iconBg }}><Icon size={18} color={c.color} /></div><ArrowUpRight size={15} color={c.color} /></div>
            <p className="text-[11px] mt-3" style={{ color: "#6F6A5D" }}>{c.title}</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: c.color }}>{c.value}</p>
          </button>;
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setTab("contributions")} className="rounded-2xl p-4 text-left border" style={{ background: "#FFF9E9", borderColor: "#F1DFAC" }}>
          <div className="flex items-center gap-2"><TrendingUp size={17} color="#9A751D" /><span className="text-xs font-semibold" style={{ color: TEAL_DARK }}>This month</span></div>
          <p className="text-xl font-bold mt-2" style={{ color: "#9A751D" }}>{fmtKES(monthlyContributions)}</p>
          <p className="text-[10px] mt-1" style={{ color: "#7A7364" }}>Total contributions recorded</p>
        </button>
        <button onClick={() => setTab("loans")} className="rounded-2xl p-4 text-left border" style={{ background: overdue.length ? "#FFF0EC" : "#EEF8F5", borderColor: overdue.length ? "#F0C8BD" : "#CDE7E1" }}>
          <div className="flex items-center gap-2"><Bell size={17} color={overdue.length ? "#B3391F" : TEAL} /><span className="text-xs font-semibold" style={{ color: TEAL_DARK }}>Loan alerts</span></div>
          <p className="text-xl font-bold mt-2" style={{ color: overdue.length ? "#B3391F" : TEAL }}>{overdue.length + dueSoon.length}</p>
          <p className="text-[10px] mt-1" style={{ color: "#7A7364" }}>{overdue.length} overdue · {dueSoon.length} due within 7 days</p>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <SectionCard>
          <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><CalendarDays size={17} color={TEAL} /><h3 className="text-sm font-semibold" style={{ color: TEAL_DARK }}>Upcoming events</h3></div><button onClick={() => setTab("events")} className="text-[11px] font-semibold" style={{ color: GOLD }}>View all</button></div>
          {upcomingEvents.length === 0 ? <p className="text-xs" style={{ color: "#9A9382" }}>No upcoming events.</p> : upcomingEvents.slice(0, 3).map((e) => <div key={e.id} className="flex items-center gap-3 py-2 border-t" style={{ borderColor: "#EEE8D9" }}><div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center" style={{ background: "#E7F3F0" }}><span className="text-[9px] uppercase" style={{ color: TEAL }}>{new Date(e.date+"T00:00:00").toLocaleDateString("en-GB",{month:"short"})}</span><span className="text-sm font-bold" style={{ color: TEAL }}>{new Date(e.date+"T00:00:00").getDate()}</span></div><div><p className="text-xs font-semibold" style={{ color: TEAL_DARK }}>{e.title}</p><p className="text-[10px] mt-0.5" style={{ color: "#7A7364" }}>{e.location || "Welfare event"}</p></div></div>)}
        </SectionCard>

        <SectionCard>
          <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><Gift size={17} color={GOLD} /><h3 className="text-sm font-semibold" style={{ color: TEAL_DARK }}>Recent contributions</h3></div><button onClick={() => setTab("contributions")} className="text-[11px] font-semibold" style={{ color: GOLD }}>View all</button></div>
          {recentContribs.length === 0 ? <p className="text-xs" style={{ color: "#9A9382" }}>No contributions recorded.</p> : recentContribs.map((c) => <div key={c.id} className="flex items-center justify-between py-2 border-t" style={{ borderColor: "#EEE8D9" }}><div><p className="text-xs font-semibold" style={{ color: TEAL_DARK }}>{memberName(c.member_id)}</p><p className="text-[10px] mt-0.5" style={{ color: "#7A7364" }}>{c.type === "merryGoRound" ? "Merry-Go-Round" : c.type === "tableBanking" ? "Table Banking" : c.type === "benevolent" ? "Benevolent Fund" : "Monthly Share"}</p></div><div className="text-right"><p className="text-xs font-bold" style={{ color: GOLD }}>{fmtKES(c.amount)}</p><p className="text-[10px]" style={{ color: "#9A9382" }}>{fmtDate(c.date)}</p></div></div>)}
        </SectionCard>

        <SectionCard>
          <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><Megaphone size={17} color="#8B3563" /><h3 className="text-sm font-semibold" style={{ color: TEAL_DARK }}>Latest news</h3></div><button onClick={() => setTab("announcements")} className="text-[11px] font-semibold" style={{ color: GOLD }}>View all</button></div>
          {announcements.length === 0 ? <p className="text-xs" style={{ color: "#9A9382" }}>No announcements yet.</p> : [...announcements].sort((a,b)=>(a.created_at||a.date||"")<(b.created_at||b.date||"")?1:-1).slice(0,3).map((a) => <div key={a.id} className="py-2 border-t" style={{ borderColor: "#EEE8D9" }}><p className="text-xs font-semibold" style={{ color: TEAL_DARK }}>{a.title || "Announcement"}</p><p className="text-[10px] mt-1 line-clamp-2" style={{ color: "#7A7364" }}>{a.message || a.body || a.content || ""}</p></div>)}
        </SectionCard>
      </div>

      <p className="text-[10px] text-center pb-2" style={{ color: "#9A9382" }}>Matayia's Welfare · Admin overview</p>
    </div>
  );
}

/* ---------------- MEMBERS ---------------- */
function MembersTab({ members, accounts, crud }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank());
  const [accForMember, setAccForMember] = useState(null);
  function blank() { return { id: null, name: "", national_id: "", contact: "", next_of_kin_name: "", next_of_kin_contact: "" }; }

  const openNew = () => { setForm(blank()); setEditing(null); setShowForm(true); };
  const openEdit = (m) => { setForm(m); setEditing(m.id); setShowForm(true); };

  const save = async () => {
    if (!form.name.trim() || !form.national_id.trim()) return;
    if (editing) {
      const { id, ...patch } = form;
      await crud.updateMember(editing, patch);
    } else {
      const { id, ...row } = form;
      await crud.addMember(row);
    }
    setShowForm(false);
  };

  const accountFor = (memberId) => accounts.find((a) => a.member_id === memberId);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: TEAL_DARK }}>Members ({members.length})</h2>
        <button onClick={openNew} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: TEAL, color: CREAM }}>
          <Plus size={14} /> Add member
        </button>
      </div>

      {members.length === 0 && <EmptyState text="No members yet. Add your first member to get started." />}

      {members.map((m) => {
        const acc = accountFor(m.id);
        return (
          <SectionCard key={m.id}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-semibold" style={{ color: TEAL_DARK }}>{m.name}</p>
                <p className="text-xs flex items-center gap-1 mt-1" style={{ color: "#7A7364" }}><CreditCard size={12} /> {m.national_id}</p>
                <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "#7A7364" }}><Phone size={12} /> {m.contact}</p>
                {m.next_of_kin_name && <p className="text-xs mt-1" style={{ color: "#7A7364" }}>Next of kin: {m.next_of_kin_name} ({m.next_of_kin_contact})</p>}
                <p className="text-[11px] mt-2" style={{ color: acc ? TEAL : "#B3391F" }}>{acc ? `Account: ${acc.username}` : "No login account"}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(m)} className="p-1.5 rounded-full" style={{ background: "#F1ECDD" }}><Pencil size={13} color={TEAL_DARK} /></button>
                <button onClick={() => crud.removeMember(m.id)} className="p-1.5 rounded-full" style={{ background: "#F6E4DE" }}><Trash2 size={13} color="#B3391F" /></button>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setAccForMember(m)} className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: "#F1ECDD", color: TEAL_DARK }}>
                {acc ? "Edit login account" : "Create login account"}
              </button>
            </div>
          </SectionCard>
        );
      })}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title={editing ? "Edit member" : "Add member"}>
          <Field label="Full name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="National ID"><input className="input" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} /></Field>
          <Field label="Contact"><input className="input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
          <Field label="Next of kin name"><input className="input" value={form.next_of_kin_name} onChange={(e) => setForm({ ...form, next_of_kin_name: e.target.value })} /></Field>
          <Field label="Next of kin contact"><input className="input" value={form.next_of_kin_contact} onChange={(e) => setForm({ ...form, next_of_kin_contact: e.target.value })} /></Field>
          <ModalActions onCancel={() => setShowForm(false)} onSave={save} />
        </Modal>
      )}

      {accForMember && (
        <AccountModal
          member={accForMember}
          account={accountFor(accForMember.id)}
          accounts={accounts}
          onClose={() => setAccForMember(null)}
          onSave={async (username, password) => {
            const existing = accountFor(accForMember.id);
            if (existing) await crud.updateAccount(existing.id, { username, password, name: accForMember.name });
            else await crud.addAccount({ username, password, role: "member", member_id: accForMember.id, name: accForMember.name });
            setAccForMember(null);
          }}
        />
      )}
    </div>
  );
}

function AccountModal({ member, account, accounts, onClose, onSave }) {
  const [username, setUsername] = useState(account?.username || member.national_id);
  const [password, setPassword] = useState(account?.password || "");
  const [err, setErr] = useState("");
  const save = () => {
    if (!username.trim() || !password.trim()) { setErr("Username and password are required."); return; }
    const clash = accounts.find((a) => a.username.toLowerCase() === username.trim().toLowerCase() && a.id !== account?.id);
    if (clash) { setErr("That username is already taken."); return; }
    onSave(username.trim(), password.trim());
  };
  return (
    <Modal onClose={onClose} title={`Login for ${member.name}`}>
      <Field label="Username"><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
      <Field label="Password"><input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      {err && <p className="text-xs mb-2" style={{ color: "#B3391F" }}>{err}</p>}
      <ModalActions onCancel={onClose} onSave={save} />
    </Modal>
  );
}

/* ---------------- EVENTS ---------------- */
function EventsTab({ events, isAdmin, members, attendance, crud }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank());
  const [attendEvent, setAttendEvent] = useState(null);
  const [smsFor, setSmsFor] = useState(null);
  function blank() { return { title: "", date: "", type: "meeting", description: "" }; }

  const sorted = useMemo(() => [...events].sort((a, b) => (a.date > b.date ? 1 : -1)), [events]);
  const upcoming = sorted.filter((e) => e.date >= todayISO());
  const past = sorted.filter((e) => e.date < todayISO());

  const save = async () => {
    if (!form.title.trim() || !form.date) return;
    await crud.addEvent(form);
    setShowForm(false);
    setForm(blank());
  };

  const typeColor = { meeting: TEAL, gathering: GOLD, other: "#8A8270" };

  const Row = ({ e }) => {
    const rec = attendance[e.id] || {};
    const presentCount = Object.values(rec).filter(Boolean).length;
    return (
      <SectionCard key={e.id}>
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full" style={{ background: `${typeColor[e.type] || "#8A8270"}22`, color: typeColor[e.type] || "#8A8270" }}>{e.type}</span>
            <p className="text-sm font-semibold mt-1.5" style={{ color: TEAL_DARK }}>{e.title}</p>
            <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "#7A7364" }}><Clock size={12} /> {fmtDate(e.date)}</p>
            {e.description && <p className="text-xs mt-1.5" style={{ color: "#7A7364" }}>{e.description}</p>}
            {Object.keys(rec).length > 0 && <p className="text-[11px] mt-1.5" style={{ color: TEAL }}>{presentCount} present of {members.length}</p>}
          </div>
          {isAdmin && <button onClick={() => crud.removeEvent(e.id)} className="p-1.5 rounded-full" style={{ background: "#F6E4DE" }}><Trash2 size={13} color="#B3391F" /></button>}
        </div>
        {isAdmin && (
          <div className="mt-3 flex gap-2 flex-wrap">
            <button onClick={() => setAttendEvent(e)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: "#F1ECDD", color: TEAL_DARK }}><ClipboardCheck size={13} /> Mark attendance</button>
            <button onClick={() => setSmsFor(e)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: "#F1ECDD", color: TEAL_DARK }}><MessageSquare size={13} /> Send SMS</button>
          </div>
        )}
      </SectionCard>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: TEAL_DARK }}>Events & Meetings</h2>
        {isAdmin && <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: TEAL, color: CREAM }}><Plus size={14} /> Add event</button>}
      </div>

      <p className="text-xs font-medium mb-2" style={{ color: "#7A7364" }}>Upcoming</p>
      {upcoming.length === 0 && <EmptyState text="No upcoming events. Monthly meetings can be added here." />}
      {upcoming.map((e) => <Row key={e.id} e={e} />)}

      {past.length > 0 && (
        <>
          <p className="text-xs font-medium mb-2 mt-4" style={{ color: "#7A7364" }}>Past</p>
          {past.map((e) => <Row key={e.id} e={e} />)}
        </>
      )}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title="Add event">
          <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Monthly Meeting - August" /></Field>
          <Field label="Date"><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Type">
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="meeting">Meeting</option>
              <option value="gathering">Gathering</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Description (optional)"><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <ModalActions onCancel={() => setShowForm(false)} onSave={save} />
        </Modal>
      )}

      {attendEvent && (
        <AttendanceModal event={attendEvent} members={members} attendance={attendance} crud={crud} onClose={() => setAttendEvent(null)} />
      )}

      {smsFor && (
        <SmsModal phones={members.map((m) => m.contact)} message={`${smsFor.title} — ${fmtDate(smsFor.date)}. ${smsFor.description || ""}`.trim()} onClose={() => setSmsFor(null)} />
      )}
    </div>
  );
}

function AttendanceModal({ event, members, attendance, crud, onClose }) {
  const [rec, setRec] = useState(attendance[event.id] || {});
  const toggle = (memberId) => setRec((prev) => ({ ...prev, [memberId]: !prev[memberId] }));
  const save = async () => { await crud.saveAttendance(event.id, rec); onClose(); };
  return (
    <Modal onClose={onClose} title={`Attendance — ${event.title}`}>
      {members.length === 0 && <EmptyState text="No members to mark yet." />}
      <div className="space-y-2 mb-3">
        {members.map((m) => {
          const present = !!rec[m.id];
          return (
            <button key={m.id} onClick={() => toggle(m.id)} className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 border" style={{ borderColor: present ? TEAL : "#D8CFBB", background: present ? "#EAF2F0" : "#fff" }}>
              <span className="text-sm" style={{ color: TEAL_DARK }}>{m.name}</span>
              {present ? <UserCheck size={16} color={TEAL} /> : <UserX size={16} color="#B0A992" />}
            </button>
          );
        })}
      </div>
      <ModalActions onCancel={onClose} onSave={save} />
    </Modal>
  );
}

function SmsModal({ phones, message, onClose }) {
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedNums, setCopiedNums] = useState(false);
  const nums = phones.filter(Boolean);
  const copy = async (text, setFlag) => {
    try { await navigator.clipboard.writeText(text); setFlag(true); setTimeout(() => setFlag(false), 1500); } catch { setFlag(false); }
  };
  return (
    <Modal onClose={onClose} title="Send SMS">
      <p className="text-xs mb-3" style={{ color: "#7A7364" }}>Tap below to open your phone's SMS app with the numbers and message ready. If nothing opens, copy the message and numbers instead.</p>
      <a href={smsLink(nums, message)} className="w-full rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2 mb-3" style={{ background: TEAL, color: CREAM, textDecoration: "none" }}>
        <MessageSquare size={16} /> Open SMS app
      </a>
      <Field label={`Recipients (${nums.length})`}>
        <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "#D8CFBB", background: "#fff", color: TEAL_DARK, wordBreak: "break-all" }}>{nums.join(", ") || "No member phone numbers on file."}</div>
        <button onClick={() => copy(nums.join(", "), setCopiedNums)} className="text-xs mt-1.5 font-medium" style={{ color: TEAL }}>{copiedNums ? "Copied ✓" : "Copy numbers"}</button>
      </Field>
      <Field label="Message">
        <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "#D8CFBB", background: "#fff", color: TEAL_DARK, whiteSpace: "pre-wrap" }}>{message}</div>
        <button onClick={() => copy(message, setCopiedMsg)} className="text-xs mt-1.5 font-medium" style={{ color: TEAL }}>{copiedMsg ? "Copied ✓" : "Copy message"}</button>
      </Field>
    </Modal>
  );
}

/* ---------------- CONTRIBUTIONS ---------------- */
function ContributionsTab({ session, members, contributions, settings, crud }) {
  const isAdmin = session.role === "admin";
  const [showForm, setShowForm] = useState(false);
  const [filterMember, setFilterMember] = useState(isAdmin ? "all" : session.member_id);
  const [form, setForm] = useState(blank());
  function blank() {
    return { member_id: members[0]?.id || "", type: "monthly", amount: settings.monthly, date: todayISO(), note: "", recipient_id: "", sugar_given: false };
  }

  const visible = isAdmin ? (filterMember === "all" ? contributions : contributions.filter((c) => c.member_id === filterMember)) : contributions.filter((c) => c.member_id === session.member_id);
  const sorted = [...visible].sort((a, b) => (a.date < b.date ? 1 : -1));

  const totals = useMemo(() => {
    const t = { monthly: 0, merryGoRound: 0, benevolent: 0, tableBanking: 0 };
    visible.forEach((c) => { t[c.type] = (t[c.type] || 0) + Number(c.amount); });
    return t;
  }, [visible]);

  const mgrRounds = useMemo(() => {
    const mgr = contributions.filter((c) => c.type === "merryGoRound" && c.recipient_id);
    const map = {};
    mgr.forEach((c) => {
      const key = `${monthKey(c.date)}_${c.recipient_id}`;
      if (!map[key]) map[key] = { month: monthKey(c.date), recipient_id: c.recipient_id, total: 0, contributors: [] };
      map[key].total += Number(c.amount);
      map[key].contributors.push(c);
    });
    return Object.values(map).sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [contributions]);

  const myReceivedRounds = !isAdmin ? mgrRounds.filter((r) => r.recipient_id === session.member_id) : [];

  const save = async () => {
    if (!form.member_id || !form.amount) return;
    const record = { ...form, amount: Number(form.amount) };
    if (record.type !== "merryGoRound") { record.recipient_id = null; record.sugar_given = false; }
    if (!record.recipient_id) record.recipient_id = null;
    await crud.addContribution(record);
    setShowForm(false);
  };

  const typeLabel = (k) => CONTRIB_TYPES.find((t) => t.key === k)?.label || k;
  const memberName = (id) => members.find((m) => m.id === id)?.name || "Unknown";
  const monthLabel = (mk) => { const [y, m] = mk.split("-"); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" }); };
  const contribLine = (c) => `${memberName(c.member_id)} (${fmtKES(c.amount)}${c.sugar_given ? " + 1kg sugar" : ""})`;

  // For a member, group all Merry-Go-Round contributions they have given by recipient.
  // Each recipient appears once with the total amount, sugar contributions and dates.
  const myGivenRounds = useMemo(() => {
    if (isAdmin) return [];
    const grouped = {};
    contributions
      .filter((c) => c.type === "merryGoRound" && c.member_id === session.member_id && c.recipient_id)
      .forEach((c) => {
        const key = c.recipient_id;
        if (!grouped[key]) grouped[key] = { recipient_id: key, total: 0, sugar: 0, records: [] };
        grouped[key].total += Number(c.amount || 0);
        if (c.sugar_given) grouped[key].sugar += 1;
        grouped[key].records.push(c);
      });
    return Object.values(grouped).sort((a, b) => memberName(a.recipient_id).localeCompare(memberName(b.recipient_id)));
  }, [contributions, isAdmin, session.member_id]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: TEAL_DARK }}>{isAdmin ? "Contributions" : "My Contributions"}</h2>
        {isAdmin && <button onClick={() => { setForm(blank()); setShowForm(true); }} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: TEAL, color: CREAM }}><Plus size={14} /> Record</button>}
      </div>

      {isAdmin && (
        <div className="mb-3">
          <select className="input" value={filterMember} onChange={(e) => setFilterMember(e.target.value)}>
            <option value="all">All members</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        {CONTRIB_TYPES.map((t) => (
          <div key={t.key} className="rounded-xl p-3 text-center border" style={{ background: "#fff", borderColor: "#EDE6D3" }}>
            <p className="text-[10px] font-medium" style={{ color: "#8A8270" }}>{t.label}</p>
            <p className="text-sm font-semibold mt-1" style={{ color: TEAL_DARK }}>{fmtKES(totals[t.key])}</p>
          </div>
        ))}
      </div>

      {!isAdmin && (
        <>
          <p className="text-xs font-medium mb-2 mt-1" style={{ color: "#7A7364" }}>Table Banking: your contribution history</p>
          {visible.filter((c) => c.type === "tableBanking").length === 0 ? (
            <SectionCard>
              <p className="text-xs" style={{ color: "#9A9382" }}>No Table Banking contributions recorded for you yet.</p>
            </SectionCard>
          ) : (
            <>
              <SectionCard>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium" style={{ color: "#7A7364" }}>Total Table Banking contributed</p>
                    <p className="text-lg font-bold mt-1" style={{ color: TEAL_DARK }}>{fmtKES(totals.tableBanking)}</p>
                  </div>
                  <div className="rounded-full px-3 py-1.5" style={{ background: "#EAF0FF", color: "#3655A6" }}>
                    <Wallet size={18} />
                  </div>
                </div>
              </SectionCard>
              {visible.filter((c) => c.type === "tableBanking").sort((a, b) => (a.date < b.date ? 1 : -1)).map((c) => (
                <SectionCard key={`tb-${c.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: TEAL_DARK }}>{fmtKES(c.amount)}</p>
                      <p className="text-xs mt-1" style={{ color: "#7A7364" }}>{fmtDate(c.date)}</p>
                      {c.note && <p className="text-xs mt-1" style={{ color: "#7A7364" }}>{c.note}</p>}
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: "#E7F3F0", color: TEAL }}>Table Banking</span>
                  </div>
                </SectionCard>
              ))}
            </>
          )}
        </>
      )}

      {!isAdmin && myGivenRounds.length > 0 && (
        <>
          <p className="text-xs font-medium mb-2 mt-4" style={{ color: "#7A7364" }}>Merry-Go-Round: people you have given</p>
          <SectionCard>
            <div className="space-y-2">
              {myGivenRounds.map((r) => (
                <div key={r.recipient_id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: "#F8F3E7" }}>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: TEAL_DARK }}>{memberName(r.recipient_id)}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#7A7364" }}>
                      {r.records.length} contribution{r.records.length === 1 ? "" : "s"}{r.sugar ? ` · ${r.sugar}kg sugar` : ""}
                    </p>
                  </div>
                  <p className="text-xs font-semibold" style={{ color: GOLD }}>{fmtKES(r.total)}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}

      {!isAdmin && myReceivedRounds.length > 0 && (
        <>
          <p className="text-xs font-medium mb-2 mt-4" style={{ color: "#7A7364" }}>Merry-go-round: money you received</p>
          {myReceivedRounds.map((r) => (
            <SectionCard key={r.month + r.recipient_id}>
              <p className="text-sm font-semibold" style={{ color: TEAL_DARK }}>{monthLabel(r.month)} — {fmtKES(r.total)}</p>
              <p className="text-xs mt-1" style={{ color: "#7A7364" }}>From: {r.contributors.map(contribLine).join(", ")}</p>
            </SectionCard>
          ))}
        </>
      )}

      {isAdmin && mgrRounds.length > 0 && (
        <>
          <p className="text-xs font-medium mb-2" style={{ color: "#7A7364" }}>Merry-go-round rounds</p>
          {mgrRounds.map((r) => (
            <SectionCard key={r.month + r.recipient_id}>
              <p className="text-sm font-semibold" style={{ color: TEAL_DARK }}>{monthLabel(r.month)} → <span style={{ color: GOLD }}>{memberName(r.recipient_id)}</span></p>
              <p className="text-xs mt-1" style={{ color: "#7A7364" }}>Total collected: {fmtKES(r.total)}</p>
              <p className="text-xs mt-1" style={{ color: "#7A7364" }}>Contributors: {r.contributors.map(contribLine).join(", ")}</p>
            </SectionCard>
          ))}
        </>
      )}

      <p className="text-xs font-medium mb-2 mt-4" style={{ color: "#7A7364" }}>{isAdmin ? "All records" : "Your records"}</p>
      {sorted.length === 0 && <EmptyState text="No contributions recorded yet." />}
      {sorted.map((c) => (
        <SectionCard key={c.id}>
          <div className="flex justify-between items-start">
            <div>
              {isAdmin && <p className="text-xs font-semibold" style={{ color: TEAL_DARK }}>{memberName(c.member_id)}</p>}
              <p className="text-sm font-semibold mt-0.5" style={{ color: GOLD }}>{fmtKES(c.amount)} <span className="text-xs font-normal" style={{ color: "#7A7364" }}>· {typeLabel(c.type)}</span></p>
              {c.type === "merryGoRound" && c.recipient_id && (
                <p className="text-xs mt-0.5" style={{ color: TEAL }}>
                  → Given to {memberName(c.recipient_id)}{c.sugar_given ? " + 1kg sugar" : ""}
                </p>
              )}
              <p className="text-xs mt-1" style={{ color: "#7A7364" }}>{fmtDate(c.date)}{c.note ? ` · ${c.note}` : ""}</p>
            </div>
            {isAdmin && <button onClick={() => crud.removeContribution(c.id)} className="p-1.5 rounded-full" style={{ background: "#F6E4DE" }}><Trash2 size={13} color="#B3391F" /></button>}
          </div>
        </SectionCard>
      ))}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title="Record contribution">
          <Field label="Member">
            <select className="input" value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <select className="input" value={form.type} onChange={(e) => {
              const type = e.target.value;
              const defaultAmt = settings[typeToSettingCol(type)];
              setForm({ ...form, type, amount: defaultAmt, recipient_id: type === "merryGoRound" ? form.recipient_id : "" });
            }}>
              {CONTRIB_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </Field>
          {form.type === "merryGoRound" && (
            <>
              <Field label="Recipient (who this round goes to)">
                <select className="input" value={form.recipient_id} onChange={(e) => setForm({ ...form, recipient_id: e.target.value })}>
                  <option value="">Select recipient…</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
              <label className="flex items-center gap-2 mb-3 text-sm" style={{ color: TEAL_DARK }}>
                <input type="checkbox" checked={form.sugar_given} onChange={(e) => setForm({ ...form, sugar_given: e.target.checked })} />
                1kg sugar contributed
              </label>
            </>
          )}
          <Field label="Amount (Ksh)"><input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Date"><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Note (optional)"><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. for bereavement of..." /></Field>
          <ModalActions onCancel={() => setShowForm(false)} onSave={save} />
        </Modal>
      )}
    </div>
  );
}

/* ---------------- LOANS ---------------- */
function LoansTab({ session, members, loans, loanRepayments, contributions, settings, crud }) {
  const isAdmin = session.role === "admin";
  const [showForm, setShowForm] = useState(false);
  const [repayFor, setRepayFor] = useState(null);
  const [formErr, setFormErr] = useState("");
  const [form, setForm] = useState(blank());
  function blank() {
    const borrowed = todayISO();
    const due = new Date(borrowed + "T00:00:00");
    due.setDate(due.getDate() + 30);
    return { member_id: members[0]?.id || "", principal: "", interest_rate: settings.loan_interest_rate ?? 10, date_borrowed: borrowed, due_date: due.toISOString().slice(0, 10), note: "" };
  }

  const balance = useMemo(() => Math.max(0, tableBankingBalance(contributions, loans, loanRepayments)), [contributions, loans, loanRepayments]);
  const outstandingPrincipal = useMemo(() => loans.reduce((sum, l) => {
    const remaining = Math.max(0, Number(l.principal) - Math.min(Number(l.principal), Number(l.amount_repaid)));
    return sum + remaining;
  }, 0), [loans]);
  const outstandingDue = useMemo(() => loans.reduce((sum, l) => sum + Math.max(0, Number(l.total_due) - Number(l.amount_repaid)), 0), [loans]);
  const totalRepaid = useMemo(() => loanRepayments.reduce((sum, r) => sum + Number(r.amount), 0), [loanRepayments]);

  const visibleLoans = isAdmin ? loans : loans.filter((l) => l.member_id === session.member_id);
  const sorted = [...visibleLoans].sort((a, b) => (a.date_borrowed < b.date_borrowed ? 1 : -1));
  const dueSoonLoans = visibleLoans.filter((l) => {
    const d = daysUntil(l.due_date);
    return l.status !== "repaid" && l.due_date && d >= 0 && d <= 7;
  });
  const overdueLoans = visibleLoans.filter((l) => l.status !== "repaid" && l.due_date && daysUntil(l.due_date) < 0);

  const memberName = (id) => members.find((m) => m.id === id)?.name || "Unknown";
  const memberPhone = (id) => members.find((m) => m.id === id)?.contact || "";
  const repaymentsFor = (loanId) => loanRepayments.filter((r) => r.loan_id === loanId).sort((a, b) => (a.date < b.date ? 1 : -1));

  // Automatic in-app due notice: it appears to the member from 7 days before
  // the due date and remains visible until the loan is fully repaid.
  useEffect(() => {
    if (!isAdmin && dueSoonLoans.length > 0 && "Notification" in window && Notification.permission === "granted") {
      dueSoonLoans.forEach((l) => new Notification("Matayia's Welfare — Loan due", { body: loanDueMessage(l) }));
    }
  }, [isAdmin, dueSoonLoans.map((l) => `${l.id}:${l.due_date}`).join("|")]);

  const save = async () => {
    setFormErr("");
    const amount = Number(form.principal);
    const rate = Number(form.interest_rate);
    if (!form.member_id) { setFormErr("Select a member."); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setFormErr("Enter a valid loan amount greater than zero."); return; }
    if (!form.date_borrowed) { setFormErr("Select the date the loan was borrowed."); return; }
    if (!form.due_date) { setFormErr("Select the loan due/return date."); return; }
    if (form.due_date < form.date_borrowed) { setFormErr("Due/return date cannot be before the borrowing date."); return; }
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) { setFormErr("Interest rate must be between 0% and 100%."); return; }
    try {
      await crud.addLoan(form);
      setShowForm(false);
    } catch (e) {
      setFormErr(e.message || "Couldn't record loan.");
    }
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) return;
    try { await Notification.requestPermission(); } catch {}
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: TEAL_DARK }}>{isAdmin ? "Loans" : "My Loans"}</h2>
        {isAdmin && <button onClick={() => { setForm(blank()); setFormErr(""); setShowForm(true); }} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: TEAL, color: CREAM }}><Plus size={14} /> New loan</button>}
      </div>

      {!isAdmin && dueSoonLoans.length > 0 && (
        <SectionCard>
          <div className="flex items-start gap-2">
            <AlertCircle size={18} color="#B3391F" className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#B3391F" }}>Loan payment reminder</p>
              {dueSoonLoans.map((l) => <p key={l.id} className="text-xs mt-1" style={{ color: TEAL_DARK }}>{loanDueMessage(l)}</p>)}
              {"Notification" in window && Notification.permission !== "granted" && <button onClick={requestNotifications} className="text-xs underline mt-2" style={{ color: TEAL }}>Enable phone notifications</button>}
            </div>
          </div>
        </SectionCard>
      )}

      {isAdmin && (dueSoonLoans.length > 0 || overdueLoans.length > 0) && (
        <SectionCard>
          <p className="text-xs font-semibold" style={{ color: overdueLoans.length ? "#B3391F" : GOLD }}>Loan due alerts</p>
          {overdueLoans.map((l) => <p key={l.id} className="text-xs mt-1" style={{ color: "#B3391F" }}>{memberName(l.member_id)} — overdue since {fmtDate(l.due_date)}.</p>)}
          {dueSoonLoans.map((l) => <p key={l.id} className="text-xs mt-1" style={{ color: TEAL_DARK }}>{memberName(l.member_id)} — {loanDueMessage(l)}</p>)}
        </SectionCard>
      )}

      <SectionCard>
        <p className="text-xs font-medium" style={{ color: "#8A8270" }}>Table banking fund available</p>
        <p className="text-lg font-semibold mt-1" style={{ color: balance > 0 ? TEAL_DARK : "#B3391F" }}>{fmtKES(balance)}</p>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-lg p-2" style={{ background: "#F7F1E4" }}><p className="text-[10px]" style={{ color: "#8A8270" }}>Outstanding principal</p><p className="text-xs font-semibold mt-0.5" style={{ color: TEAL_DARK }}>{fmtKES(outstandingPrincipal)}</p></div>
          <div className="rounded-lg p-2" style={{ background: "#F7F1E4" }}><p className="text-[10px]" style={{ color: "#8A8270" }}>Amount still due</p><p className="text-xs font-semibold mt-0.5" style={{ color: TEAL_DARK }}>{fmtKES(outstandingDue)}</p></div>
          <div className="rounded-lg p-2" style={{ background: "#F7F1E4" }}><p className="text-[10px]" style={{ color: "#8A8270" }}>Repayments received</p><p className="text-xs font-semibold mt-0.5" style={{ color: TEAL_DARK }}>{fmtKES(totalRepaid)}</p></div>
        </div>
      </SectionCard>

      <p className="text-xs font-medium mb-2 mt-4" style={{ color: "#7A7364" }}>{isAdmin ? "All loans" : "Your loans"}</p>
      {sorted.length === 0 && <EmptyState text="No loans recorded yet." />}
      {sorted.map((l) => {
        const remaining = Math.max(0, Number(l.total_due) - Number(l.amount_repaid));
        const reps = repaymentsFor(l.id);
        const dueState = loanDueState(l);
        return (
          <SectionCard key={l.id}>
            <div className="flex justify-between items-start">
              <div className="min-w-0">
                {isAdmin && <p className="text-xs font-semibold" style={{ color: TEAL_DARK }}>{memberName(l.member_id)}</p>}
                <p className="text-sm font-semibold mt-0.5" style={{ color: GOLD }}>{fmtKES(l.principal)} borrowed <span className="text-xs font-normal" style={{ color: "#7A7364" }}>· {l.interest_rate}% interest</span></p>
                <p className="text-xs mt-1" style={{ color: "#7A7364" }}>Total due {fmtKES(l.total_due)} · Repaid {fmtKES(l.amount_repaid)} · Balance <b style={{ color: remaining > 0 ? "#B3391F" : TEAL }}>{fmtKES(remaining)}</b></p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div><p className="text-[10px]" style={{ color: "#9A9382" }}>Borrowed</p><p className="text-xs font-medium" style={{ color: TEAL_DARK }}>{fmtDate(l.date_borrowed)}</p></div>
                  <div><p className="text-[10px]" style={{ color: "#9A9382" }}>Due / return date</p><p className="text-xs font-medium" style={{ color: dueState.color }}>{fmtDate(l.due_date) || "Not set"}</p></div>
                </div>
                {l.actual_return_date && <p className="text-xs mt-1" style={{ color: TEAL }}>Actually returned/cleared: {fmtDate(l.actual_return_date)}</p>}
                {l.note && <p className="text-xs mt-1" style={{ color: "#7A7364" }}>{l.note}</p>}
                <span className="inline-block text-[10px] font-semibold uppercase mt-1.5 px-2 py-0.5 rounded-full" style={{ background: dueState.key === "repaid" ? "#E3F0EA" : dueState.key === "overdue" || dueState.key === "due_today" ? "#FBEDE7" : "#F7F1E4", color: dueState.color }}>
                  {dueState.label}
                </span>
              </div>
              {isAdmin && <button onClick={() => crud.removeLoan(l.id)} className="p-1.5 rounded-full" style={{ background: "#F6E4DE" }}><Trash2 size={13} color="#B3391F" /></button>}
            </div>

            {reps.length > 0 && (
              <div className="mt-2 pt-2" style={{ borderTop: "1px solid #EDE6D3" }}>
                <p className="text-[11px] font-medium mb-1" style={{ color: "#8A8270" }}>Repayment history</p>
                {reps.map((r) => <p key={r.id} className="text-xs" style={{ color: "#7A7364" }}>{fmtDate(r.date)} — {fmtKES(r.amount)}</p>)}
              </div>
            )}

            {isAdmin && l.status !== "repaid" && <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => setRepayFor(l)} className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: "#F1ECDD", color: TEAL_DARK }}>Record repayment</button>
              {l.due_date && <a href={smsLink([memberPhone(l.member_id)], loanDueMessage(l))} className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: "#E7F0ED", color: TEAL_DARK }}>SMS reminder</a>}
            </div>}
          </SectionCard>
        );
      })}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title="Record a new loan">
          <Field label="Member">
            <select className="input" value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}>
              <option value="">Select a member</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Date borrowed"><input type="date" className="input" value={form.date_borrowed} onChange={(e) => setForm({ ...form, date_borrowed: e.target.value })} /></Field>
          <Field label="Due / return date"><input type="date" min={form.date_borrowed} className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /><p className="text-[10px] mt-1" style={{ color: "#8A8270" }}>The member will receive an in-app reminder automatically during the 7 days before this date.</p></Field>
          <Field label="Amount to borrow (Ksh)"><input type="number" min="0.01" step="0.01" max={Math.max(0, balance)} className="input" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} /></Field>
          <Field label="Interest rate (%)"><input type="number" min="0" max="100" step="0.01" className="input" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} /></Field>
          <Field label="Note (optional)"><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          {formErr && <p className="text-xs mb-2" style={{ color: "#B3391F" }}>{formErr}</p>}
          <ModalActions onCancel={() => setShowForm(false)} onSave={save} />
        </Modal>
      )}

      {repayFor && <RepaymentModal loan={repayFor} onClose={() => setRepayFor(null)} onSave={async (amount) => { await crud.addRepayment(repayFor.id, amount); setRepayFor(null); }} />}
    </div>
  );
}

function RepaymentModal({ loan, onClose, onSave }) {
  const remaining = Number(loan.total_due) - Number(loan.amount_repaid);
  const [amount, setAmount] = useState(remaining);
  const [err, setErr] = useState("");
  const save = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { setErr("Enter a valid amount greater than zero."); return; }
    if (value > remaining + 0.000001) { setErr(`Repayment cannot exceed ${fmtKES(remaining)}.`); return; }
    try { await onSave(value); } catch (e) { setErr(e.message || "Couldn't record repayment."); }
  };
  return (
    <Modal onClose={onClose} title="Record repayment">
      <p className="text-xs mb-3" style={{ color: "#7A7364" }}>Balance remaining: {fmtKES(remaining)}</p>
      <Field label="Amount received (Ksh)"><input type="number" min="0.01" step="0.01" max={remaining} className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      {err && <p className="text-xs mb-2" style={{ color: "#B3391F" }}>{err}</p>}
      <ModalActions onCancel={onClose} onSave={save} />
    </Modal>
  );
}

/* ---------------- ANNOUNCEMENTS ---------------- */
function AnnouncementsTab({ announcements, isAdmin, members, crud }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });
  const [smsFor, setSmsFor] = useState(null);
  const sorted = [...announcements].sort((a, b) => (a.date < b.date ? 1 : -1));

  const save = async () => {
    if (!form.title.trim()) return;
    await crud.addAnnouncement({ ...form, date: todayISO() });
    setShowForm(false);
    setForm({ title: "", body: "" });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: TEAL_DARK }}>Announcements</h2>
        {isAdmin && <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: TEAL, color: CREAM }}><Plus size={14} /> Post</button>}
      </div>
      {sorted.length === 0 && <EmptyState text="No announcements yet." />}
      {sorted.map((a) => (
        <SectionCard key={a.id}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-semibold" style={{ color: TEAL_DARK }}>{a.title}</p>
              <p className="text-xs mt-1" style={{ color: "#7A7364" }}>{a.body}</p>
              <p className="text-[11px] mt-1.5" style={{ color: "#B0A992" }}>{fmtDate(a.date)}</p>
            </div>
            {isAdmin && <button onClick={() => crud.removeAnnouncement(a.id)} className="p-1.5 rounded-full" style={{ background: "#F6E4DE" }}><Trash2 size={13} color="#B3391F" /></button>}
          </div>
          {isAdmin && <button onClick={() => setSmsFor(a)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium mt-3" style={{ background: "#F1ECDD", color: TEAL_DARK }}><MessageSquare size={13} /> Send SMS</button>}
        </SectionCard>
      ))}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title="Post announcement">
          <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Message"><textarea rows={3} className="input" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
          <ModalActions onCancel={() => setShowForm(false)} onSave={save} />
        </Modal>
      )}

      {smsFor && <SmsModal phones={members.map((m) => m.contact)} message={`${smsFor.title}: ${smsFor.body}`} onClose={() => setSmsFor(null)} />}
    </div>
  );
}

/* ---------------- MINUTES ---------------- */
function MinutesTab({ minutes, isAdmin, crud }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", date: todayISO(), content: "" });
  const sorted = [...minutes].sort((a, b) => (a.date < b.date ? 1 : -1));

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    await crud.addMinutes(form);
    setShowForm(false);
    setForm({ title: "", date: todayISO(), content: "" });
  };

  const downloadPdf = (m) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>${m.title}</title>
      <style>
        body { font-family: Georgia, serif; padding: 40px; color: #0D302D; max-width: 700px; margin: auto; }
        h1 { font-size: 20px; border-bottom: 2px solid #C99A2E; padding-bottom: 10px; }
        .date { color: #7A7364; font-size: 13px; margin-bottom: 24px; }
        .content { white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
        .header { font-size: 12px; color: #164B47; text-transform: uppercase; letter-spacing: 1px; }
      </style></head>
      <body>
        <div class="header">Matayia's Welfare — Minutes</div>
        <h1>${m.title}</h1>
        <div class="date">${fmtDate(m.date)}</div>
        <div class="content">${m.content.replace(/</g, "&lt;")}</div>
      </body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: TEAL_DARK }}>Minutes</h2>
        {isAdmin && <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: TEAL, color: CREAM }}><Plus size={14} /> Add minutes</button>}
      </div>
      {sorted.length === 0 && <EmptyState text="No minutes recorded yet." />}
      {sorted.map((m) => (
        <SectionCard key={m.id}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: TEAL_DARK }}>{m.title}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "#B0A992" }}>{fmtDate(m.date)}</p>
              <p className="text-xs mt-1.5" style={{ color: "#7A7364", whiteSpace: "pre-wrap" }}>{m.content.length > 160 ? m.content.slice(0, 160) + "…" : m.content}</p>
            </div>
            {isAdmin && <button onClick={() => crud.removeMinutes(m.id)} className="p-1.5 rounded-full ml-2" style={{ background: "#F6E4DE" }}><Trash2 size={13} color="#B3391F" /></button>}
          </div>
          <button onClick={() => downloadPdf(m)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium mt-3" style={{ background: "#F1ECDD", color: TEAL_DARK }}><Printer size={13} /> Save as PDF</button>
        </SectionCard>
      ))}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title="Add minutes">
          <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. August Monthly Meeting" /></Field>
          <Field label="Date"><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Minutes"><textarea rows={8} className="input" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Record what was discussed, decisions made, and action points…" /></Field>
          <ModalActions onCancel={() => setShowForm(false)} onSave={save} />
        </Modal>
      )}
    </div>
  );
}

/* ---------------- SETTINGS ---------------- */
function SettingsTab({ settings, crud }) {
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);
  const save = async () => {
    await crud.saveSettings({
      monthly: Number(form.monthly),
      merry_go_round: Number(form.merry_go_round),
      benevolent: Number(form.benevolent),
      table_banking: Number(form.table_banking),
      loan_interest_rate: Number(form.loan_interest_rate),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  return (
    <div>
      <h2 className="text-sm font-semibold mb-3" style={{ color: TEAL_DARK }}>Contribution amounts</h2>
      <SectionCard>
        <Field label="Monthly Share (Ksh)"><input type="number" className="input" value={form.monthly} onChange={(e) => setForm({ ...form, monthly: e.target.value })} /></Field>
        <Field label="Merry-Go-Round (Ksh)"><input type="number" className="input" value={form.merry_go_round} onChange={(e) => setForm({ ...form, merry_go_round: e.target.value })} /></Field>
        <Field label="Benevolent Fund (Ksh)"><input type="number" className="input" value={form.benevolent} onChange={(e) => setForm({ ...form, benevolent: e.target.value })} /></Field>
        <Field label="Table Banking (Ksh)"><input type="number" className="input" value={form.table_banking} onChange={(e) => setForm({ ...form, table_banking: e.target.value })} /></Field>
        <Field label="Loan interest rate (%)"><input type="number" className="input" value={form.loan_interest_rate} onChange={(e) => setForm({ ...form, loan_interest_rate: e.target.value })} /></Field>
        <button onClick={save} className="w-full rounded-lg py-2.5 text-sm font-semibold mt-2 flex items-center justify-center gap-2" style={{ background: TEAL, color: CREAM }}>
          {saved ? <><Check size={15} /> Saved</> : "Save changes"}
        </button>
      </SectionCard>
    </div>
  );
}

/* ---------------- CHANGE PASSWORD ---------------- */
function ChangePasswordModal({ session, accounts, crud, onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const save = async () => {
    const acc = accounts.find((a) => a.id === session.id);
    if (!acc || acc.password !== current) { setErr("Current password is incorrect."); return; }
    if (!next.trim() || next.length < 4) { setErr("New password must be at least 4 characters."); return; }
    if (next !== confirm) { setErr("New passwords do not match."); return; }
    await crud.updateAccount(session.id, { password: next });
    setDone(true);
    setTimeout(onClose, 1000);
  };

  return (
    <Modal onClose={onClose} title="Change password">
      <Field label="Current password"><input type="password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
      <Field label="New password"><input type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      <Field label="Confirm new password"><input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
      {err && <p className="text-xs mb-2" style={{ color: "#B3391F" }}>{err}</p>}
      {done ? <div className="flex items-center gap-2 text-sm py-2" style={{ color: TEAL }}><Check size={16} /> Password changed</div> : <ModalActions onCancel={onClose} onSave={save} />}
    </Modal>
  );
}

/* ---------------- MEMBER HOME ---------------- */
function MemberHome({ session, members, contributions, events, announcements, loans }) {
  const me = members.find((m) => m.id === session.member_id);
  const mine = contributions.filter((c) => c.member_id === session.member_id);
  const myLoans = loans.filter((l) => l.member_id === session.member_id && l.status !== "repaid");
  const dueSoon = myLoans.filter((l) => l.due_date && daysUntil(l.due_date) >= 0 && daysUntil(l.due_date) <= 7);
  const overdue = myLoans.filter((l) => l.due_date && daysUntil(l.due_date) < 0);
  const totals = { monthly: 0, merryGoRound: 0, benevolent: 0, tableBanking: 0 };
  mine.forEach((c) => { totals[c.type] = (totals[c.type] || 0) + Number(c.amount); });

  // Money/sugar this member has received from Merry-Go-Round contributions.
  // Each contribution keeps the giver in member_id and the recipient in recipient_id.
  const memberName = (id) => members.find((m) => m.id === id)?.name || "Unknown member";
  const receivedMgr = contributions
    .filter((c) => c.type === "merryGoRound" && c.recipient_id === session.member_id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const receivedTotal = receivedMgr.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const sugarCount = receivedMgr.reduce((sum, c) => sum + (c.sugar_given ? 1 : 0), 0);

  const upcoming = [...events].filter((e) => e.date >= todayISO()).sort((a, b) => (a.date > b.date ? 1 : -1)).slice(0, 3);
  const news = [...announcements].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);

  return (
    <div>
      {me && <SectionCard><p className="text-xs font-medium" style={{ color: "#8A8270" }}>Your profile</p><p className="text-sm font-semibold mt-1" style={{ color: TEAL_DARK }}>{me.name}</p><p className="text-xs mt-0.5" style={{ color: "#7A7364" }}>ID: {me.national_id} · {me.contact}</p></SectionCard>}

      {overdue.length > 0 && <SectionCard><div className="flex items-start gap-2"><AlertCircle size={18} color="#B3391F" className="mt-0.5" /><div><p className="text-sm font-semibold" style={{ color: "#B3391F" }}>Loan overdue</p>{overdue.map((l) => <p key={l.id} className="text-xs mt-1" style={{ color: TEAL_DARK }}>Your loan was due on {fmtDate(l.due_date)}. Kindly pay up to avoid penalties.</p>)}</div></div></SectionCard>}
      {dueSoon.length > 0 && <SectionCard><div className="flex items-start gap-2"><AlertCircle size={18} color={GOLD} className="mt-0.5" /><div><p className="text-sm font-semibold" style={{ color: TEAL_DARK }}>Loan due reminder</p>{dueSoon.map((l) => <p key={l.id} className="text-xs mt-1" style={{ color: TEAL_DARK }}>Your loan is due on {fmtDate(l.due_date)} kindly pay up to avoid penalties.</p>)}</div></div></SectionCard>}

      <p className="text-xs font-medium mb-2 mt-4" style={{ color: "#7A7364" }}>Your contributions so far</p>
      <div className="grid grid-cols-2 gap-2 mb-4">{CONTRIB_TYPES.map((t) => <div key={t.key} className="rounded-xl p-3 text-center border" style={{ background: "#fff", borderColor: "#EDE6D3" }}><p className="text-[10px] font-medium" style={{ color: "#8A8270" }}>{t.label}</p><p className="text-sm font-semibold mt-1" style={{ color: TEAL_DARK }}>{fmtKES(totals[t.key])}</p></div>)}</div>

      {receivedMgr.length > 0 && (
        <>
          <p className="text-xs font-medium mb-2 mt-4" style={{ color: "#7A7364" }}>Merry-Go-Round &amp; Sugar received</p>
          <SectionCard>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-lg p-2 border text-center" style={{ background: "#fff", borderColor: "#EDE6D3" }}>
                <p className="text-[10px]" style={{ color: "#8A8270" }}>Money received</p>
                <p className="text-sm font-semibold mt-1" style={{ color: TEAL_DARK }}>{fmtKES(receivedTotal)}</p>
              </div>
              <div className="rounded-lg p-2 border text-center" style={{ background: "#fff", borderColor: "#EDE6D3" }}>
                <p className="text-[10px]" style={{ color: "#8A8270" }}>Sugar received</p>
                <p className="text-sm font-semibold mt-1" style={{ color: TEAL_DARK }}>{sugarCount} kg</p>
              </div>
            </div>
            <p className="text-xs font-medium mb-2" style={{ color: TEAL_DARK }}>Given by:</p>
            <div className="space-y-2">
              {receivedMgr.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "#F8F3E7" }}>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: TEAL_DARK }}>{memberName(c.member_id)}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "#7A7364" }}>{fmtDate(c.date)}{c.note ? ` · ${c.note}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold" style={{ color: GOLD }}>{fmtKES(c.amount)}</p>
                    {c.sugar_given && <p className="text-[10px] mt-0.5" style={{ color: TEAL }}>+ 1kg sugar</p>}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}

      <p className="text-xs font-medium mb-2 mt-4" style={{ color: "#7A7364" }}>Upcoming events</p>
      {upcoming.length === 0 && <EmptyState text="No upcoming events." />}
      {upcoming.map((e) => <SectionCard key={e.id}><p className="text-sm font-semibold" style={{ color: TEAL_DARK }}>{e.title}</p><p className="text-xs mt-0.5" style={{ color: "#7A7364" }}>{fmtDate(e.date)}</p></SectionCard>)}

      <p className="text-xs font-medium mb-2 mt-4" style={{ color: "#7A7364" }}>Latest announcements</p>
      {news.length === 0 && <EmptyState text="No announcements yet." />}
      {news.map((a) => <SectionCard key={a.id}><p className="text-sm font-semibold" style={{ color: TEAL_DARK }}>{a.title}</p><p className="text-xs mt-0.5" style={{ color: "#7A7364" }}>{a.body}</p></SectionCard>)}
    </div>
  );
}

/* ---------------- SHARED UI ---------------- */
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "#0D302D99" }}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto" style={{ background: CREAM }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: TEAL_DARK }}>{title}</h3>
          <button onClick={onClose}><X size={18} color="#8A8270" /></button>
        </div>
        {children}
      </div>
      <style>{`.input{width:100%;border:1px solid #D8CFBB;border-radius:8px;padding:9px 11px;font-size:13px;background:#fff;outline:none;color:${TEAL_DARK};margin-bottom:2px;}`}</style>
    </div>
  );
}
function Field({ label, children }) {
  return <div className="mb-3"><label className="text-xs font-medium block mb-1" style={{ color: TEAL_DARK }}>{label}</label>{children}</div>;
}
function ModalActions({ onCancel, onSave }) {
  return (
    <div className="flex gap-2 mt-4">
      <button onClick={onCancel} className="flex-1 rounded-lg py-2.5 text-sm font-medium" style={{ background: "#EDE6D3", color: TEAL_DARK }}>Cancel</button>
      <button onClick={onSave} className="flex-1 rounded-lg py-2.5 text-sm font-semibold" style={{ background: TEAL, color: CREAM }}>Save</button>
    </div>
  );
}
