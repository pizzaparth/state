"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Inbox,
  Activity,
  History,
  BarChart3,
  User,
  Users,
  FolderKanban,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  href: Route;
  icon: React.ComponentType<{ className?: string }>;
}

const navSections: Array<{ title?: string; items: NavItem[] }> = [
  {
    items: [
      { name: "Today", href: "/today", icon: Calendar },
      { name: "Inbox", href: "/inbox", icon: Inbox },
    ],
  },
  {
    title: "Execution",
    items: [
      { name: "Activity", href: "/activity", icon: Activity },
      { name: "History", href: "/history", icon: History },
      { name: "Metrics", href: "/metrics", icon: BarChart3 },
    ],
  },
  {
    title: "Work",
    items: [
      { name: "Personal", href: "/personal", icon: User },
      { name: "Organisation", href: "/org", icon: Users },
      { name: "Projects", href: "/projects", icon: FolderKanban },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen bg-[#DEDEDA] p-4 flex flex-col justify-between shadow-neu-raised shrink-0 border-r border-black/5 select-none">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="px-3 py-2">
          <Link href="/today" className="block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-black">
            <span className="text-xs font-semibold tracking-eyebrow text-[#5F5F5B] uppercase block">
              Ksan Relay
            </span>
            <span className="text-xl font-bold tracking-display text-[#171717] block">
              STATE
            </span>
          </Link>
        </div>

        {/* Navigation Sections */}
        <nav className="space-y-5" aria-label="Main Navigation">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {section.title && (
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#8B8B86]">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-control transition-all",
                      isActive
                        ? "bg-[#101010] text-[#F2F2EF] shadow-md"
                        : "text-[#5F5F5B] hover:text-[#171717] hover:bg-black/5"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-[#F2F2EF]" : "text-[#5F5F5B]")} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer / Settings */}
      <div className="pt-4 border-t border-black/5">
        <Link
          href="/personal"
          className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-[#5F5F5B] hover:text-[#171717] hover:bg-black/5 rounded-control transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
