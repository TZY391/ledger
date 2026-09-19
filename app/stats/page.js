"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { fmt } from "@/lib/money";

function monthBounds(offset) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end, label: start.toLocaleDateString("en-SG", { month: "long", year: "numeric" }) };
}

export default function StatsPage() {
  const supabase = createClient();
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { start, end, label } = monthBounds(offset);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("transactions")
        .select("type, amount_cents, categories(name)")
        .gte("date", start.toISOString().slice(0, 10))
        .lt("date", end.toISOString().slice(0, 10));
      setRows(data || []);
      const { data: inv } = await supabase.from("investments").select("id,name,current_value_cents").eq("is_archived", false);
      setInvestments(inv || []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount_cents, 0);
  const expense = rows
    .filter((r) => r.type === "discretionary_expense" || r.type === "fixed_expense")
    .reduce((s, r) => s + r.amount_cents, 0);
  const invested = rows.filter((r) => r.type === "investment_contribution").reduce((s, r) => s + r.amount_cents, 0);

  const byCategory = {};
  rows
    .filter((r) => r.type === "discretionary_expense" || r.type === "fixed_expense")
    .forEach((r) => {
      const name = r.categories?.name || "Other";
      byCategory[name] = (byCategory[name] || 0) + r.amount_cents;
    });
  const categoryList = Object.entries(byCategory)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
  const maxCat = Math.max(1, ...categoryList.map((c) => c.amount));

  const totalInvestmentValue = investments.reduce((s, i) => s + Number(i.current_value_cents), 0);

  if (loading) return <div style={{ padding: 40, color: "#8A8F99", textAlign: "center" }}>Loading…</div>;

  return (
    <div style={{ padding: "20px 18px 100px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <button onClick={() => setOffset((o) => o - 1)} style={navBtn}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{label}</div>
        <button onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0} style={{ ...navBtn, opacity: offset >= 0 ? 0.3 : 1 }}>›</button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <SummaryCard label="Income" value={income} color="#C9A227" />
        <SummaryCard label="Expenses" value={expense} color="#B0524A" />
        <SummaryCard label="Invested" value={invested} color="#ECE9E2" />
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Spending by category</div>
      {categoryList.length === 0 && <div style={{ color: "#8A8F99", fontSize: 13 }}>No expenses logged this month.</div>}
      {categoryList.map((c) => (
        <div key={c.name} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span>{c.name}</span>
            <span style={{ fontFamily: "IBM Plex Mono, monospace" }}>S$ {fmt(c.amount)}</span>
          </div>
          <div style={{ height: 6, background: "#20242D", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(c.amount / maxCat) * 100}%`, background: "#C9A227" }} />
          </div>
        </div>
      ))}

      <div style={{ height: 1, background: "#2A2F3A", margin: "24px 0 14px" }} />

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Investments</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ color: "#8A8F99", fontSize: 13 }}>Total value</span>
        <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 14, color: "#C9A227" }}>S$ {fmt(totalInvestmentValue)}</span>
      </div>
      {investments.map((i) => (
        <div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #2A2F3A" }}>
          <span style={{ fontSize: 13 }}>{i.name}</span>
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 13 }}>S$ {fmt(i.current_value_cents)}</span>
        </div>
      ))}
      {investments.length === 0 && <div style={{ color: "#8A8F99", fontSize: 13 }}>No investments tracked yet.</div>}
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: "#1B1F27", border: "1px solid #2A2F3A", borderRadius: 12, padding: "12px 10px" }}>
      <div style={{ color: "#8A8F99", fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 15, color }}>S$ {fmt(value)}</div>
    </div>
  );
}

const navBtn = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid #2A2F3A",
  background: "#1B1F27",
  color: "#ECE9E2",
  fontSize: 16,
};
