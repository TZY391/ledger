"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { evalExpr, toCents } from "@/lib/money";

const TYPES = [
  { value: "discretionary_expense", label: "Discretionary" },
  { value: "fixed_expense", label: "Fixed expense" },
  { value: "income", label: "Income" },
  { value: "investment_contribution", label: "Investment" },
  { value: "transfer", label: "Transfer" },
];

const KEYPAD = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "+", "⌫"];

export default function AddTransactionSheet({ onClose, onSaved, initial }) {
  const supabase = createClient();
  const [type, setType] = useState(initial?.type || "discretionary_expense");
  const [expr, setExpr] = useState(initial ? String((initial.amount_cents ?? 0) / 100) : "");
  const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState(initial?.category_id || "");
  const [accountId, setAccountId] = useState(initial?.account_id || "");
  const [toAccountId, setToAccountId] = useState(initial?.to_account_id || "");
  const [investmentId, setInvestmentId] = useState(initial?.investment_id || "");
  const [note, setNote] = useState(initial?.note || "");
  const [newCategory, setNewCategory] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const needsCategory = type === "discretionary_expense" || type === "fixed_expense" || type === "income";
  const isTransfer = type === "transfer";
  const isInvestment = type === "investment_contribution";
  const categoryKind = type === "income" ? "income" : "expense";

  useEffect(() => {
    (async () => {
      const [{ data: acc }, { data: cat }, { data: inv }] = await Promise.all([
        supabase.from("accounts").select("id,name,type").eq("is_archived", false).order("name"),
        supabase.from("categories").select("id,name,kind").eq("is_archived", false).order("name"),
        supabase.from("investments").select("id,name").eq("is_archived", false).order("name"),
      ]);
      setAccounts(acc || []);
      setCategories(cat || []);
      setInvestments(inv || []);
      if (!accountId && acc?.length) setAccountId(acc[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pressKey = (k) => {
    if (k === "⌫") return setExpr((e) => e.slice(0, -1));
    setExpr((e) => e + k);
  };

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("categories")
      .insert({ name, kind: categoryKind })
      .select()
      .single();
    if (!error && data) {
      setCategories((c) => [...c, data]);
      setCategoryId(data.id);
      setNewCategory("");
    }
  };

  const save = async () => {
    setErr("");
    const cents = toCents(expr);
    if (!cents || cents <= 0) return setErr("Enter an amount greater than zero.");
    if (!accountId) return setErr(isTransfer ? "Pick a from-account." : "Pick an account.");
    if (isTransfer && !toAccountId) return setErr("Pick a destination account.");
    if (isTransfer && toAccountId === accountId) return setErr("From and to accounts must differ.");
    if (isInvestment && !investmentId) return setErr("Pick an investment.");
    if (needsCategory && !categoryId) return setErr("Pick a category.");

    setSaving(true);
    const payload = {
      type,
      amount_cents: cents,
      date,
      account_id: accountId,
      to_account_id: isTransfer ? toAccountId : null,
      category_id: needsCategory ? categoryId : null,
      investment_id: isInvestment ? investmentId : null,
      note: note.trim() || null,
    };

    const { error } = initial?.id
      ? await supabase.from("transactions").update(payload).eq("id", initial.id)
      : await supabase.from("transactions").insert(payload);

    setSaving(false);
    if (error) return setErr(error.message);
    onSaved?.();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 430,
          margin: "0 auto",
          background: "#1B1F27",
          borderRadius: "18px 18px 0 0",
          padding: "18px 18px 28px",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{initial?.id ? "Edit transaction" : "Add transaction"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8A8F99", fontSize: 20 }}>
            ×
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16 }}>
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              style={{
                whiteSpace: "nowrap",
                padding: "7px 12px",
                borderRadius: 20,
                border: "1px solid " + (type === t.value ? "#C9A227" : "#2A2F3A"),
                background: type === t.value ? "rgba(201,162,39,0.12)" : "transparent",
                color: type === t.value ? "#C9A227" : "#8A8F99",
                fontSize: 12,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ textAlign: "right", marginBottom: 10 }}>
          <div style={{ color: "#8A8F99", fontSize: 12 }}>Amount</div>
          <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 34, color: "#ECE9E2", minHeight: 42 }}>
            S$ {expr || "0"}
          </div>
          <div style={{ color: "#8A8F99", fontSize: 12 }}>= S$ {evalExpr(expr).toFixed(2)}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
          {KEYPAD.map((k) => (
            <button
              key={k}
              onClick={() => pressKey(k)}
              style={{
                padding: "12px 0",
                borderRadius: 10,
                border: "1px solid #2A2F3A",
                background: "#20242D",
                color: "#ECE9E2",
                fontSize: 16,
              }}
            >
              {k}
            </button>
          ))}
        </div>

        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </Field>

        {needsCategory && (
          <Field label="Category">
            <div style={{ display: "flex", gap: 6 }}>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                <option value="">Select…</option>
                {categories
                  .filter((c) => c.kind === categoryKind)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input
                placeholder="New category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={addCategory} style={smallBtn}>
                Add
              </button>
            </div>
          </Field>
        )}

        {isInvestment && (
          <Field label="Investment">
            <select value={investmentId} onChange={(e) => setInvestmentId(e.target.value)} style={inputStyle}>
              <option value="">Select…</option>
              {investments.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={isTransfer ? "From account" : "Paid from"}>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={inputStyle}>
            <option value="">Select…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>

        {isTransfer && (
          <Field label="To account">
            <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} style={inputStyle}>
              <option value="">Select…</option>
              {accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </Field>
        )}

        <Field label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} placeholder="e.g. lunch with team" />
        </Field>

        {err && <div style={{ color: "#B0524A", fontSize: 13, margin: "8px 0" }}>{err}</div>}

        <button
          onClick={save}
          disabled={saving}
          style={{
            width: "100%",
            marginTop: 12,
            padding: "15px 0",
            borderRadius: 14,
            border: "none",
            background: "#C9A227",
            color: "#12151A",
            fontWeight: 700,
            fontSize: 15,
          }}
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

const smallBtn = {
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #2A2F3A",
  background: "#20242D",
  color: "#C9A227",
  fontSize: 13,
};
