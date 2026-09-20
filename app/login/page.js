"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
         options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined },,
    });
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div style={{ padding: "60px 24px", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 28, color: "#C9A227", marginBottom: 8 }}>Ledger</div>
      <div style={{ color: "#8A8F99", fontSize: 14, marginBottom: 32 }}>Sign in with your email — no password, just a magic link.</div>

      {sent ? (
        <div style={{ color: "#ECE9E2", fontSize: 14 }}>
          Check <strong>{email}</strong> for a sign-in link.
        </div>
      ) : (
        <>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            style={{
              width: "100%",
              background: "#1B1F27",
              border: "1px solid #2A2F3A",
              borderRadius: 10,
              padding: "14px 16px",
              color: "#ECE9E2",
              fontSize: 15,
              outline: "none",
              marginBottom: 12,
              boxSizing: "border-box",
            }}
          />
          {error && <div style={{ color: "#B0524A", fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button
            onClick={handleSend}
            disabled={!email}
            style={{
              width: "100%",
              background: email ? "#C9A227" : "#20242D",
              border: "none",
              borderRadius: 14,
              padding: "15px 0",
              color: email ? "#12151A" : "#8A8F99",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            Send sign-in link
          </button>
        </>
      )}
    </div>
  );
}
