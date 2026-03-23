import "./globals.css";

export const metadata = {
  title: "ZapTrend Control Tower",
  description: "Futuristic trend intelligence and automation console"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}