import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata = {
  title: "Ledger",
  description: "Personal finance tracker",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#12151A",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div style={{ paddingBottom: 84 }}>{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
