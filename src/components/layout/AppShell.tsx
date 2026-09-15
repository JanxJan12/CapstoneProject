import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  ChevronDown,
  Clock3,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import type { NavGroup } from "../../types";
import { ImageWithFallback } from "@/components/media/ImageWithFallback";
import rrjLogo from "@/assets/brand/rrj-logo.jpg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppShell<T extends string>({
  groups,
  active,
  onSelect,
  user,
  children,
  notifications = [],
  onNotificationsRead,
  onNotificationSelect,
  onLogout,
}: {
  groups: NavGroup<T>[];
  active: T;
  onSelect: (p: T) => void;
  user: { name: string; role: string };
  children: React.ReactNode;
  notifications?: Array<{
    id: string;
    title: string;
    message: string;
    read: boolean;
    createdAt?: string;
  }>;
  onNotificationsRead?: () => void;
  onNotificationSelect?: (notificationId: string) => void;
  onLogout?: () => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigationTriggerRef = useRef<HTMLButtonElement>(null);
  const navigationCloseRef = useRef<HTMLButtonElement>(null);
  const navigationDrawerRef = useRef<HTMLElement>(null);
  const [now, setNow] = useState(() => new Date());
  const roleSlug = user.role.toLowerCase().replace(/\s+/g, "-");
  const isCashier = roleSlug === "cashier";
  const isCashierPOS = isCashier && String(active) === "walkin-pos";
  const activeLabel =
    groups.flatMap((group) => group.items).find((item) => item.id === active)
      ?.label ?? "Workspace";
  const unreadCount = notifications.filter((entry) => !entry.read).length;
  const closeNavigation = (returnFocus = true) => {
    setSidebarOpen(false);
    if (returnFocus) {
      window.requestAnimationFrame(() => navigationTriggerRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!isCashierPOS) return;
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [isCashierPOS]);
  useEffect(() => {
    if (!sidebarOpen) return;
    window.requestAnimationFrame(() => navigationCloseRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNavigation();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOpen]);

  useEffect(() => {
    const drawer =
      navigationDrawerRef.current;

    if (!drawer) {
      return;
    }

    if (sidebarOpen) {
      drawer.removeAttribute("inert");
    } else {
      drawer.setAttribute("inert", "");
    }
  }, [sidebarOpen]);

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="relative flex min-h-[88px] flex-shrink-0 items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-[14px] bg-black shadow-[0_12px_30px_rgba(0,0,0,0.3)] ring-1 ring-white/15">
            <ImageWithFallback
              src={rrjLogo}
              alt="RRJ's Food-Haus logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <div className="font-['Fraunces'] text-[15px] font-bold leading-none tracking-[-0.02em] text-white">
              RRJ's Food-Haus
            </div>
            <div className="mt-1.5 text-[8px] font-black uppercase tracking-[0.22em] text-amber-300/75">
              {user.role} Console
            </div>
          </div>
        </div>
        {/* Close drawer */}
        <button
          ref={navigationCloseRef}
          onClick={() => closeNavigation()}
          className="flex h-12 w-12 items-center justify-center rounded-xl text-white/60 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="rrj-shell-nav flex-1 overflow-y-auto px-2.5 py-4">
        {groups.map((g) => (
          <div key={g.label} className="mb-3">
            <p className="px-3 pb-2 pt-2 text-[8px] font-black uppercase tracking-[0.22em] text-white/32">
              {g.label}
            </p>
            {g.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelect(item.id);
                    closeNavigation(false);
                  }}
                  aria-current={active === item.id ? "page" : undefined}
                  className={`rrj-shell-nav-item mb-1 flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1d1713] ${active === item.id ? "is-active border-amber-300/20 bg-gradient-to-r from-[#bd5417] to-[#df7c2d] text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)]" : "border-transparent text-white/55 hover:border-white/[0.08] hover:bg-white/[0.07] hover:text-white"}`}
                >
                  <Icon
                    className={`h-4 w-4 flex-shrink-0 ${active === item.id ? "text-white" : "text-white/45"}`}
                    strokeWidth={active === item.id ? 2.5 : 1.8}
                  />
                  <span className="flex-1 truncate text-[11px] font-bold">
                    {item.label}
                  </span>
                  {item.badge ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${active === item.id ? "bg-white/20 text-white" : "bg-amber-400/15 text-amber-300"}`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                  {item.shortcut && (
                    <kbd className="hidden rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[8px] font-bold text-white/35 sm:inline-flex">
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="flex-shrink-0 border-t border-white/[0.08] p-3">
        <div className="flex min-h-[60px] items-center gap-2.5 rounded-2xl border border-white/[0.09] bg-white/[0.055] px-2.5 py-2 shadow-sm backdrop-blur">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-orange-500 shadow-md shadow-black/20 ring-1 ring-white/15">
            <span className="text-[11px] font-black text-[#2a1b12]">
              {user.name.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-[11px] font-black text-white/90">
              {user.name}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[9px] font-semibold text-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.1)]" />
              Active as {user.role}
            </div>
          </div>
          {onLogout && (
            <button
              aria-label="Log out"
              onClick={onLogout}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/35 hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div
      className="rrj-app-shell flex h-full overflow-hidden bg-background"
      data-role={roleSlug}
      data-page={String(active)}
    >
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[2px]"
          aria-hidden="true"
          onClick={() => closeNavigation()}
        />
      )}

      {/* Navigation drawer */}
      <aside
        ref={navigationDrawerRef}
        id="app-shell-navigation"
        aria-label={`${user.role} navigation`}
        aria-hidden={!sidebarOpen}
        className={[
          "app-shell-sidebar z-40 flex h-full flex-col overflow-hidden border-r border-white/[0.06] bg-[#1d1713] shadow-[12px_0_45px_rgba(31,20,13,0.14)] transition-transform duration-200",
          "fixed inset-y-0 left-0 w-72 max-w-[calc(100vw-2rem)]",
          "flex-shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header
          className={`app-shell-topbar flex flex-shrink-0 items-center gap-3 border-b border-border/70 bg-card/80 px-3 shadow-[0_1px_18px_rgba(65,42,26,0.035)] backdrop-blur-xl sm:px-4 lg:px-6 ${isCashierPOS ? "h-14" : isCashier ? "h-16" : "h-[72px]"}`}
        >
          {/* Open navigation */}
          <button
            ref={navigationTriggerRef}
            onClick={() => setSidebarOpen(true)}
            aria-controls="app-shell-navigation"
            aria-expanded={sidebarOpen}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-border/70 bg-white/75 text-muted-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Open navigation"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <p className="hidden text-[9px] font-black uppercase tracking-[0.2em] text-primary/70 sm:block">
              {isCashierPOS ? "RRJ's Food-Haus" : `${user.role} workspace`}
            </p>
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-black tracking-[-0.01em] text-foreground sm:mt-0.5">
                {activeLabel}
              </p>
            </div>
          </div>

          {isCashier && (
            <nav
              className="cashier-tablet-quick-nav hidden min-w-0 items-center gap-1 md:flex xl:hidden"
              aria-label="Cashier shortcuts"
            >
              {groups
                .flatMap((group) => group.items)
                .filter((item) =>
                  ["walkin-pos", "pending-payments", "order-list"].includes(
                    String(item.id),
                  ),
                )
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={String(item.id)}
                      onClick={() => onSelect(item.id)}
                      aria-current={active === item.id ? "page" : undefined}
                      className={`relative flex min-h-11 items-center gap-2 rounded-xl px-3 text-[10px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active === item.id ? "bg-[#2b1b12] text-white shadow-md" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden lg:inline">
                        {item.label.replace("Pending ", "")}
                      </span>
                      {item.badge ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[9px] text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-1">
            {isCashierPOS && (
              <div className="pos-shell-clock hidden items-center gap-2 border-l px-3 sm:flex">
                <Clock3 className="h-4 w-4" />
                <span>
                  <strong className="block text-[11px] leading-none">
                    {now.toLocaleTimeString("en-PH", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </strong>
                  <small className="mt-1 block text-[8px] font-bold uppercase tracking-wider">
                    {now.toLocaleDateString("en-PH", {
                      month: "short",
                      day: "numeric",
                    })}
                  </small>
                </span>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label={`${unreadCount} unread notifications`}
                  className="relative flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-black text-white ring-2 ring-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-80 rounded-xl border-border/80 p-2 shadow-xl"
              >
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notifications</span>
                  <span className="text-[9px] font-bold text-muted-foreground">
                    {unreadCount} unread
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <DropdownMenuItem disabled>
                    No new notifications
                  </DropdownMenuItem>
                ) : (
                  notifications.slice(0, 5).map((entry) => (
                    <DropdownMenuItem
                      key={entry.id}
                      className="items-start py-3"
                      onSelect={() => onNotificationSelect?.(entry.id)}
                    >
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${entry.read ? "bg-zinc-300" : "bg-primary"}`}
                      />
                      <span>
                        <strong className="block text-xs">{entry.title}</strong>
                        <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
                          {entry.message}
                        </span>
                        {entry.createdAt && (
                          <span className="mt-1 block text-[9px] font-semibold text-muted-foreground/75">
                            {new Date(entry.createdAt).toLocaleString("en-PH", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
                {unreadCount > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={onNotificationsRead}
                      className="justify-center text-[10px] font-bold text-primary"
                    >
                      <CheckCheck className="h-4 w-4" /> Mark all as read
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label={`Account: ${user.name}, ${user.role}`} className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-primary">
                      {user.name.charAt(0)}
                    </span>
                  </div>
                  <span className="hidden max-w-36 truncate text-sm font-semibold text-foreground sm:block">
                    {user.name.split(" ")[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 max-w-[calc(100vw-2rem)] rounded-xl border-border p-2 shadow-md"
              >
                <DropdownMenuLabel>
                  <span className="block break-words text-sm font-bold">{user.name}</span>
                  <span className="mt-1 block text-sm font-normal text-muted-foreground">
                    {user.role}
                  </span>
                </DropdownMenuLabel>
                {onLogout && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="min-h-11 rounded-lg px-3 text-sm font-semibold" variant="destructive" onSelect={onLogout}>
                      <LogOut className="h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          className={`app-shell-main rrj-main-canvas min-h-0 flex-1 ${isCashierPOS ? "overflow-hidden p-0" : "overflow-y-auto p-4 sm:p-5 lg:p-6 xl:p-8"}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
