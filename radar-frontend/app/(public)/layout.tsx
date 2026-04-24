// app/(public)/layout.tsx
// Minimal layout for public pages (login, sin-acceso).
// Does NOT include AppShell or sidebar — clean full-screen experience.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
