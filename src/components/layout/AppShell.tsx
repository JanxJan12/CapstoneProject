import { Fragment, useEffect, useRef, useState } from "react";
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
  activeTitle,
  onSelect,
  user,
  children,
  notifications = [],
  notificationError = false,
  onNotificationsRead,
  onNotificationSelect,
  onLogout,
}: {
  groups: NavGroup<T>[];
  active: T;
  activeTitle?: string;
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
  notificationError?: boolean;
  onNotificationsRead?: () => void;
  onNotificationSelect?: (notificationId: string) => void;
  onLogout?: () => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [collapsedSubgroups, setCollapsedSubgroups] = useState<string[]>([]);
  const navigationTriggerRef = useRef<HTMLButtonElement>(null);
  const navigationCloseRef = useRef<HTMLButtonElement>(null);
  const navigationDrawerRef = useRef<HTMLElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const [now, setNow] = useState(() => new Date());
  const roleSlug = user.role.toLowerCase().replace(/\s+/g, "-");
  const isCashier = roleSlug === "cashier";
  const isManager = roleSlug === "manager";
  const isCashierPOS = isCashier && String(active) === "walkin-pos";
  const activeLabel =
    activeTitle ??
    groups.flatMap((group) => [
      ...group.items,
      ...(group.subgroups?.flatMap((subgroup) => subgroup.items) ?? []),
    ]).find((item) => item.id === active)
      ?.label ??
    "Workspace";
  const activeGroup = groups.find((group) =>
    [...group.items, ...(group.subgroups?.flatMap((subgroup) => subgroup.items) ?? [])]
      .some((item) => item.id === active),
  );
  const activeSubgroup = activeGroup?.subgroups?.find((subgroup) =>
    subgroup.items.some((item) => item.id === active),
  );
  useEffect(() => {
    if (activeGroup) {
      setCollapsedGroups((current) => current.filter((label) => label !== activeGroup.label));
    }
    if (activeSubgroup) {
      setCollapsedSubgroups((current) => current.filter((label) => label !== activeSubgroup.label));
    }
  }, [activeGroup?.label, activeSubgroup?.label]);
  const unreadCount = notifications.filter((entry) => !entry.read).length;
  const closeNavigation = (
    focusTarget: "trigger" | "content" | null = "trigger",
  ) => {
    setSidebarOpen(false);

    window.requestAnimationFrame(() => {
      if (focusTarget === "trigger") {
        navigationTriggerRef.current?.focus();
      } else if (focusTarget === "content") {
        mainContentRef.current?.focus();
      }
    });
  };

  useEffect(() => {
    if (!isCashierPOS) return;
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [isCashierPOS]);
  useEffect(() => {
    if (!isManager) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeAtDesktop = () => {
      if (desktop.matches) setSidebarOpen(false);
    };
    desktop.addEventListener("change", closeAtDesktop);
    closeAtDesktop();
    return () => desktop.removeEventListener("change", closeAtDesktop);
  }, [isManager]);
  useEffect(() => {
    if (!sidebarOpen) return;
    window.requestAnimationFrame(() => navigationCloseRef.current?.focus());
    const handleDrawerKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeNavigation();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const drawer = navigationDrawerRef.current;

      if (!drawer) {
        return;
      }

      const focusableElements = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (!firstElement || !lastElement) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleDrawerKeyboard);
    return () => window.removeEventListener("keydown", handleDrawerKeyboard);
  }, [sidebarOpen]);

  useEffect(() => {
    const drawer = navigationDrawerRef.current;

    if (!drawer) {
      return;
    }

    if (sidebarOpen) {
      drawer.removeAttribute("inert");
    } else {
      drawer.setAttribute("inert", "");
    }
  }, [sidebarOpen]);

  const renderSidebarContent = (desktop: boolean) => (
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
          ref={desktop ? undefined : navigationCloseRef}
          onClick={() => closeNavigation()}
          className={`h-12 w-12 items-center justify-center rounded-xl text-white/60 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${desktop ? "hidden" : "flex"}`}
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="rrj-shell-nav flex-1 overflow-y-auto px-2.5 py-4">
        {groups.map((g) => {
          const groupActive = [...g.items, ...(g.subgroups?.flatMap((subgroup) => subgroup.items) ?? [])]
            .some((item) => item.id === active);
          const isExpanded = !g.collapsible || !collapsedGroups.includes(g.label);
          const GroupIcon = g.icon;
          return (
            <div key={g.label} className="mb-3">
              {g.collapsible ? (
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={`app-shell-group-${desktop ? "desktop" : "mobile"}-${g.label.toLowerCase()}`}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${g.label} navigation`}
                  onClick={() => setCollapsedGroups((groups) =>
                    groups.includes(g.label)
                      ? groups.filter((label) => label !== g.label)
                      : [...groups, g.label],
                  )}
                  className={`rrj-shell-nav-group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${groupActive ? "is-current text-amber-200" : "text-white/75 hover:bg-white/[0.07] hover:text-white"}`}
                >
                  {GroupIcon && <GroupIcon className="h-4 w-4 shrink-0" />}
                  <span className="flex-1">{g.label}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>
              ) : (
                <p className="px-3 pb-2 pt-2 text-[8px] font-black uppercase tracking-[0.22em] text-white/32">
                  {g.label}
                </p>
              )}
              <div
                id={`app-shell-group-${desktop ? "desktop" : "mobile"}-${g.label.toLowerCase()}`}
                hidden={!isExpanded}
                className={
                  g.collapsible
                    ? "rrj-shell-nav-children ml-4 border-l border-white/15 pl-2"
                    : undefined
                }
              >
                {g.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Fragment key={item.id}>
                      {item.section && (
                        <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-white/60">
                          {item.section}
                        </p>
                      )}
                      <button
                        onClick={() => {
                          onSelect(item.id);
                          if (!desktop) closeNavigation("content");
                        }}
                        aria-current={active === item.id ? "page" : undefined}
                        className={`rrj-shell-nav-item mb-1 flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1d1713] ${active === item.id ? "is-active border-amber-300/20 bg-gradient-to-r from-[#bd5417] to-[#df7c2d] text-white shadow-[0_10px_24px_rgba(0,0,0,0.22)]" : "border-transparent text-white/55 hover:border-white/[0.08] hover:bg-white/[0.07] hover:text-white"}`}
                      >
                        <Icon
                          className={`h-4 w-4 flex-shrink-0 ${active === item.id ? "text-white" : "text-white/45"}`}
                          strokeWidth={active === item.id ? 2.5 : 1.8}
                        />
                        <span className="min-w-0 flex-1 break-words text-left text-[11px] font-bold leading-tight">
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
                    </Fragment>
                  );
                })}
                {g.subgroups?.map((subgroup) => {
                  const subgroupActive = subgroup.items.some((item) => item.id === active);
                  const subgroupExpanded = !collapsedSubgroups.includes(subgroup.label);
                  const SubgroupIcon = subgroup.icon;
                  const subgroupId = `app-shell-subgroup-${desktop ? "desktop" : "mobile"}-${subgroup.label.toLowerCase().replace(/\s+/g, "-")}`;
                  return (
                    <div key={subgroup.label} className="mt-2">
                      <button
                        type="button"
                        aria-expanded={subgroupExpanded}
                        aria-controls={subgroupId}
                        onClick={() => setCollapsedSubgroups((subgroups) =>
                          subgroups.includes(subgroup.label)
                            ? subgroups.filter((label) => label !== subgroup.label)
                            : [...subgroups, subgroup.label],
                        )}
                        className={`rrj-shell-nav-group flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${subgroupActive ? "is-current text-amber-200" : "text-white/75 hover:bg-white/[0.07] hover:text-white"}`}
                      >
                        {SubgroupIcon && <SubgroupIcon className="h-4 w-4 shrink-0" />}
                        <span className="flex-1">{subgroup.label}</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${subgroupExpanded ? "rotate-180" : ""}`} />
                      </button>
                      <div id={subgroupId} hidden={!subgroupExpanded} className="rrj-shell-nav-children ml-3 border-l border-white/15 pl-2">
                        {subgroup.items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                onSelect(item.id);
                                if (!desktop) closeNavigation("content");
                              }}
                              aria-current={active === item.id ? "page" : undefined}
                              className={`rrj-shell-nav-item mb-1 flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${active === item.id ? "is-active border-amber-300/20 bg-[#26724d] text-white" : "border-transparent text-white/65 hover:bg-white/[0.07] hover:text-white"}`}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 flex-1 text-xs font-bold">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
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
      <a
        href="#app-shell-main-content"
        className="sr-only fixed left-3 top-3 z-[60] rounded-lg bg-white px-4 py-2 text-sm font-bold text-foreground shadow-xl focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Skip to main content
      </a>

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className={`fixed inset-0 z-30 bg-black/45 backdrop-blur-[2px] ${isManager ? "lg:hidden" : ""}`}
          aria-hidden="true"
          onClick={() => closeNavigation()}
        />
      )}

      {isManager && (
        <aside
          aria-label="Manager navigation"
          className="app-shell-sidebar relative hidden h-full w-[272px] shrink-0 flex-col overflow-hidden border-r border-white/[0.06] lg:flex"
        >
          {renderSidebarContent(true)}
        </aside>
      )}

      {/* Navigation drawer */}
      <aside
        ref={navigationDrawerRef}
        id="app-shell-navigation"
        role="dialog"
        aria-modal={sidebarOpen}
        aria-label={`${user.role} navigation`}
        aria-hidden={!sidebarOpen}
        className={[
          "app-shell-sidebar z-40 flex h-full flex-col overflow-hidden border-r border-white/[0.06] bg-[#1d1713] shadow-[12px_0_45px_rgba(31,20,13,0.14)] transition-transform duration-200",
          "fixed inset-y-0 left-0 w-72 max-w-[calc(100vw-2rem)]",
          "flex-shrink-0",
          isManager ? "lg:hidden" : "",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {renderSidebarContent(false)}
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
            className={`h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-border/70 bg-white/75 text-muted-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isManager ? "flex lg:hidden" : "flex"}`}
            aria-label="Open navigation"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            {isManager ? (
              <nav aria-label="Breadcrumb" className="hidden truncate text-[10px] font-bold text-primary/75 sm:block">
                {activeGroup?.label ?? "Manager"}{activeSubgroup ? ` / ${activeSubgroup.label}` : ""}
              </nav>
            ) : (
              <p className="hidden text-[9px] font-black uppercase tracking-[0.2em] text-primary/70 sm:block">
                {isCashierPOS ? "RRJ's Food-Haus" : `${user.role} workspace`}
              </p>
            )}
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
                  ["walkin-pos", "pending-payments", "orders-receipts"].includes(
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
                {notificationError && (
                  <DropdownMenuItem disabled className="text-xs text-destructive">
                    Some notifications could not be refreshed. Check your connection.
                  </DropdownMenuItem>
                )}
                {notifications.length === 0 ? (
                  <DropdownMenuItem disabled>
                    {notificationError ? "Notifications unavailable" : "No new notifications"}
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
                <button
                  aria-label={`Account: ${user.name}, ${user.role}`}
                  className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
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
                  <span className="block break-words text-sm font-bold">
                    {user.name}
                  </span>
                  <span className="mt-1 block text-sm font-normal text-muted-foreground">
                    {user.role}
                  </span>
                </DropdownMenuLabel>
                {onLogout && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="min-h-11 rounded-lg px-3 text-sm font-semibold"
                      variant="destructive"
                      onSelect={onLogout}
                    >
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
          ref={mainContentRef}
          id="app-shell-main-content"
          tabIndex={-1}
          className={`app-shell-main rrj-main-canvas min-h-0 flex-1 ${isCashierPOS ? "overflow-hidden p-0" : "overflow-y-auto p-4 sm:p-5 lg:p-6 xl:p-8"}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
