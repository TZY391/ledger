"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Overview" },
  { href: "/stats", label: "Stats" },
  { href: "/accounts", label: "Accounts" },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null; // no nav on the auth screen

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        maxWidth: 430,
        margin: "0 auto",
        background: "#1B1F27",
        borderTop: "1px solid #2A2F3A",
        display: "flex",
      }}
    >
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            style={{
              flex: 1,
              padding: "12px 0 10px",
              textAlign: "center",
              color: active ? "#C9A227" : "#8A8F99",
              fontSize: 11,
              textDecoration: "none",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
