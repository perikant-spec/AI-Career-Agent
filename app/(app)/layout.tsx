import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar userName={session.user.name} userEmail={session.user.email ?? ""} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
