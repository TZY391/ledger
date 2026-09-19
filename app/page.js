"use client";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase-browser";
import { fmt, toCents } from "@/lib/money";
import AddTransactionSheet from "@/components/AddTransactionSheet";

export default function OverviewPage() {
  const supabase = createClient();
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [categorySpend, setCategorySpend] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: summaryRows }, { data: recentTx }] = await Promise.all([
      supabase.from("dashboard_summary").select("*").single(),
      supabase
        .from("transactions")
        .select("*, categories(name), accounts!transactions_account_id_fkey(name), to_account:accounts!transactions_to_account_id_fkey(name)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6),
    ]);
    setSummary(summaryRows);
    setRecent(recentTx || []);

    // category breakdown for the current calendar month, discretionary + fixed only
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { data: monthTx } = await supabase
      .from("transactions")
      .select("amount_cents, categories(name)")
      .in("type", ["discretionary_expense", "fixed_expense"])
      .gte("date", startOfMonth.toISOString().slice(0, 10));

    const map = {};
    (monthTx || []).forEach((t) => {
      const name = t.categories?.name || "Other";
      map[name] = (map[name] || 0) + t.amount_cents;
    });
    setCategorySpend(Object.entries(map).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div style={{ padding: 40, color: "#8A8F99", textAlign: "center" }}>Loading…</div>;
  }

  if (!summary) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ color: "#8A8F99", fontSize: 14, marginBottom: 16 }}>
          No monthly budget set yet.
        </div>
        <button
          onClick={() => setShowBudget(true)}
          style={{
            padding: "13px 22px",
            borderRadius: 12,
            border: "none",
            background: "#C9A227",
            color: "#12151A",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Set monthly budget
        </button>
        {showBudget && (
          <BudgetSheet
            current={0}
            onClose={() => setShowBudget(false)}
            onSaved={() => {
              setShowBudget(false);
              load();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 18px 100px" }}>
      <div style={{ color: "#8A8F99", fontSize: 13, marginBottom: 2 }}>Available today</div>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 52, color: "#C9A227", lineHeight: 1.05 }}>
        S$ {fmt(summary.daily_available_cents)}
      </div>
      <div style={{ height: 2, background: "#2A2F3A", borderRadius: 2, margin: "16px 0 8px", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.max(0, Math.min(100, (summary.remaining_cents / summary.discretionary_budget_cents) * 100))}%`,
            background: "#C9A227",
          }}
        />
      </div>
      <div style={{ color: "#8A8F99", fontSize: 12 }}>{summary.days_remaining_incl_today} days left this month</div>

      <div style={{ height: 1, background: "#2A2F3A", margin: "22px 0" }} />

      <div onClick={() => setShowBudget(true)} style={{ cursor: "pointer" }}>
        <Row label="Monthly budget (tap to edit)" value={summary.discretionary_budget_cents} />
      </div>
      <Row label="Spent so far" value={summary.spent_this_month_cents} negative />
      <Row label="Remaining this month" value={summary.remaining_cents} bold />

      <div style={{ height: 1, background: "#2A2F3A", margin: "22px 0" }} />

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Recent</div>
      {recent.map((t) => (
        <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #2A2F3A" }}>
          <div>
            <div style={{ fontSize: 14 }}>{t.note || t.categories?.name || t.type.replace("_", " ")}</div>
            <div style={{ color: "#8A8F99", fontSize: 11 }}>
              {t.type === "transfer"
                ? `${t.accounts?.name} → ${t.to_account?.name}`
                : `${t.categories?.name || ""} · ${t.accounts?.name}`}{" "}
              · {new Date(t.date).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
            </div>
          </div>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 14, color: t.type === "income" ? "#C9A227" : t.type === "transfer" || t.type === "fixed_expense" ? "#8A8F99" : "#B0524A" }}>
            {t.type === "income" ? "+" : t.type === "transfer" ? "" : "−"}
            {fmt(t.amount_cents)}
          </div>
        </div>
      ))}

      <div style={{ height: 1, background: "#2A2F3A", margin: "22px 0" }} />

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>This month by category</div>
      {categorySpend.length === 0 && <div style={{ color: "#8A8F99", fontSize: 13 }}>No spending logged yet this month.</div>}
      {categorySpend.map((c) => (
        <Row key={c.name} label={c.name} value={c.amount} negative small />
      ))}

      <button
        onClick={() => setShowAdd(true)}
        style={{
          position: "fixed",
          right: 20,
          bottom: 84,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#C9A227",
          border: "none",
          color: "#12151A",
          fontSize: 28,
          boxShadow: "0 8px 24px rgba(201,162,39,0.35)",
        }}
      >
        +
      </button>

      {showAdd && (
        <AddTransactionSheet
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}

      {showBudget && (
        <BudgetSheet
          current={summary.discretionary_budget_cents}
          onClose={() => setShowBudget(false)}
          onSaved={() => {
            setShowBudget(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function BudgetSheet({ current, onClose, onSaved }) {
  const supabase = createClient();
  const [value, setValue] = useState(current ? String(current / 100) : "");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const cents = toCents(value);
    if (!cents || cents <= 0) return setErr("Enter an amount greater than zero.");
    setSaving(true);
    const { error } = await supabase.from("budget_settings").insert({
      discretionary_budget_cents: cents,
      effective_from: new Date().toISOString().slice(0, 10),
    });
    setSaving(false);
    if (error) return setErr(error.message);
    onSaved?.();
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 430, margin: "0 auto", background: "#1B1F27", borderRadius: "18px 18px 0 0", padding: "18px 18px 28px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Monthly discretionary budget</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8A8F99", fontSize: 20 }}>×</button>
        </div>
        <div style={{ color: "#8A8F99", fontSize: 12, marginBottom: 12 }}>
          Takes effect today — past months keep their old budget.
        </div>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          style={{
            width: "100%",
            background: "#20242D",
            border: "1px solid #2A2F3A",
            borderRadius: 10,
            padding: "12px 14px",
            color: "#ECE9E2",
            fontSize: 20,
            fontFamily: "IBM Plex Mono, monospace",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 10,
          }}
        />
        {err && <div style={{ color: "#B0524A", fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <button
          onClick={save}
          disabled={saving}
          style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: "none", background: "#C9A227", color: "#12151A", fontWeight: 700, fontSize: 15 }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, negative, bold, small }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: small ? "6px 0" : "8px 0" }}>
      <span style={{ color: bold ? "#ECE9E2" : "#8A8F99", fontSize: small ? 13 : 14, fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: small ? 13 : 14, color: bold ? "#C9A227" : negative ? "#B0524A" : "#ECE9E2", fontWeight: bold ? 700 : 400 }}>
        {negative ? "−" : ""}S$ {fmt(value)}
      </span>
    </div>
  );
}
