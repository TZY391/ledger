"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { fmt, toCents } from "@/lib/money";

const TYPES = ["cash", "bank", "credit_card", "investment", "receivable", "custom"];

export default function AccountsPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("account_balances")
      .select("*")
      .order("type")
      .order("name");
    setAccounts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const netWorth = accounts.reduce((sum, a) => sum + Number(a.current_balance_cents), 0);

  if (loading) return <div style={{ padding: 40, color: "#8A8F99", textAlign: "center" }}>Loading…</div>;

  return (
    <div style={{ padding: "20px 18px 100px" }}>
      <div style={{ color: "#8A8F99", fontSize: 13, marginBottom: 2 }}>Net worth</div>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 40, color: "#C9A227" }}>S$ {fmt(netWorth)}</div>

      <div style={{ height: 1, background: "#2A2F3A", margin: "22px 0 12px" }} />

      {accounts.length === 0 && (
        <div style={{ color: "#8A8F99", fontSize: 13, marginBottom: 16 }}>
          No accounts yet — add your first one below (cash, bank, credit card…).
        </div>
      )}

      {accounts.map((a) => (
        <div
          key={a.account_id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "12px 0",
            borderBottom: "1px solid #2A2F3A",
          }}
        >
          <div>
            <div style={{ fontSize: 14 }}>{a.name}</div>
            <div style={{ color: "#8A8F99", fontSize: 11, textTransform: "capitalize" }}>{a.type.replace("_", " ")}</div>
          </div>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 14, color: Number(a.current_balance_cents) < 0 ? "#B0524A" : "#ECE9E2" }}>
            S$ {fmt(a.current_balance_cents)}
          </div>
        </div>
      ))}

      <button
        onClick={() => setShowAdd(true)}
        style={{
          width: "100%",
          marginTop: 20,
          padding: "13px 0",
          borderRadius: 12,
          border: "1px solid #2A2F3A",
          background: "#1B1F27",
          color: "#C9A227",
          fontSize: 14,
        }}
      >
        + Add account
      </button>

      {showAdd && (
        <AddAccountSheet
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddAccountSheet({ onClose, onSaved }) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [type, setType] = useState("bank");
  const [startingBalance, setStartingBalance] = useState("");
  const [startingDate, setStartingDate] = useState(new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return setErr("Give the account a name.");
    setSaving(true);
    const { error } = await supabase.from("accounts").insert({
      name: name.trim(),
      type,
      starting_balance_cents: toCents(startingBalance || "0"),
      starting_date: startingDate,
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
          <div style={{ fontSize: 16, fontWeight: 700 }}>Add account</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8A8F99", fontSize: 20 }}>×</button>
        </div>

        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. DBS Multiplier" />
        </Field>
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t.replace("_", " ")}</option>
            ))}
          </select>
        </Field>
        <Field label="Starting balance">
          <input value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} style={inputStyle} placeholder="0.00" inputMode="decimal" />
        </Field>
        <Field label="As of">
          <input type="date" value={startingDate} onChange={(e) => setStartingDate(e.target.value)} style={inputStyle} />
        </Field>

        {err && <div style={{ color: "#B0524A", fontSize: 13, margin: "8px 0" }}>{err}</div>}

        <button
          onClick={save}
          disabled={saving}
          style={{ width: "100%", marginTop: 12, padding: "15px 0", borderRadius: 14, border: "none", background: "#C9A227", color: "#12151A", fontWeight: 700, fontSize: 15 }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: "#8A8F99", fontSize: 12, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "#20242D",
  border: "1px solid #2A2F3A",
  borderRadius: 10,
  padding: "11px 12px",
  color: "#ECE9E2",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};
