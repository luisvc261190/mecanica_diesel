import * as React from "react";
import { NavLink } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_SECTIONS } from "@/constants/navigation";
import { useAuth } from "@/features/auth/context/AuthContext";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "ltd.sidebar.collapsed";

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { can } = useAuth();
  const [collapsed, setCollapsed] = React.useState(() => window.localStorage.getItem(COLLAPSE_KEY) === "1");

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const nav = (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 shrink-0 items-center border-b", collapsed ? "justify-center px-0" : "justify-between px-4")}>
        <div className={cn("flex items-center gap-2 overflow-hidden", collapsed && "justify-center")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <WrenchIcon />
          </div>
          {!collapsed ? (
            <div className="leading-tight">
              <p className="truncate text-sm font-semibold">Laboratorio</p>
              <p className="truncate text-[11px] text-muted-foreground">Tecnología Diesel</p>
            </div>
          ) : null}
        </div>
        {!collapsed ? (
          <Button variant="ghost" size="icon-sm" onClick={toggleCollapsed} aria-label="Colapsar menú">
            <ChevronsLeft />
          </Button>
        ) : null}
      </div>

      <ScrollArea className="flex-1">
        <nav className="space-y-5 p-3">
          {NAV_SECTIONS.map((section, i) => {
            const visible = section.items.filter((item) => !item.permission || can(item.permission));
            if (visible.length === 0) return null;
            return (
              <div key={i} className="space-y-1">
                {section.title && !collapsed ? (
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.title}
                  </p>
                ) : null}
                {visible.map((item) => {
                  const link = (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.end}
                      onClick={onCloseMobile}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          isActive && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
                          collapsed && "justify-center px-0",
                        )
                      }
                    >
                      <item.icon className="size-4 shrink-0" />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </NavLink>
                  );
                  return collapsed ? (
                    <Tooltip key={item.path}>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <React.Fragment key={item.path}>{link}</React.Fragment>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {collapsed ? (
        <div className="border-t p-3">
          <Button variant="ghost" size="icon" className="w-full" onClick={toggleCollapsed} aria-label="Expandir menú">
            <ChevronsRight />
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          "hidden shrink-0 border-r bg-sidebar text-sidebar-foreground lg:block",
          collapsed ? "w-14" : "w-60",
          "transition-[width] duration-200",
        )}
      >
        {nav}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-background/70" onClick={onCloseMobile} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 border-r bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="absolute right-2 top-3 z-10">
              <Button variant="ghost" size="icon-sm" onClick={onCloseMobile} aria-label="Cerrar menú">
                <X />
              </Button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}
    </>
  );
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
      <path
        d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7Z"
        fill="currentColor"
      />
    </svg>
  );
}