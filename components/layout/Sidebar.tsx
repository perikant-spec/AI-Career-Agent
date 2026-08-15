"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { NAV_ITEMS } from "./navItems";

export function Sidebar({ userName, userEmail }: { userName?: string | null; userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-[238px] flex-none bg-sidebar text-sidebar-text flex flex-col py-[22px] px-3.5 sticky top-0 h-screen">
      <div className="flex items-center gap-2.5 px-2 pb-[22px]">
        <div className="w-[26px] h-[26px] rounded-lg bg-accent-teal flex items-center justify-center font-bold text-[13px] text-accent-teal-ink">
          A
        </div>
        <div className="flex flex-col leading-[1.15]">
          <span className="text-[14.5px] font-semibold tracking-tight">Career Agent</span>
          <span className="text-[11px] text-sidebar-text-dim truncate max-w-[160px]">
            {userName || userEmail}
          </span>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-[9px] text-[13.5px] font-medium transition-colors no-underline ${
                active
                  ? "bg-sidebar-hover text-sidebar-text"
                  : "text-sidebar-text-dim hover:bg-sidebar-hover hover:text-sidebar-text"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-none ${
                  active ? "bg-accent-teal" : "bg-sidebar-border"
                }`}
              />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-sidebar-border pt-3.5 flex flex-col gap-2">
        <div className="text-[11px] text-sidebar-text-dim leading-relaxed">
          Human submits. Agent prepares.
          <br />
          Nothing sends without your click.
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-left text-[12px] text-sidebar-text-dim hover:text-sidebar-text cursor-pointer bg-transparent border-0 p-0 mt-1"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
