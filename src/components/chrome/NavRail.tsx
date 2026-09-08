"use client";

import { memo, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Circle } from "lucide-react";
import { NAV_GROUPS, NAV_ITEMS, activeNavId, type NavBadgeKey, type NavItem } from "@/config/nav";
import { NAV_ICONS } from "./navIcons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { Badge } from "@/components/ui/Badge";
import { Kbd } from "@/components/ui/Kbd";
import { useRailExpanded, useUiStore } from "@/store/uiStore";
import { useDashboardSummary } from "@/lib/queries";
import { usePrefetchRoute } from "./usePrefetchRoute";
import { cn } from "@/lib/utils";

/**
 * The rail is the app's spine: every page is one click away and nothing is
 * reachable that isn't listed in `@/config/nav`. Collapsed it is icon-only at
 * 60px; expanded it shows labels and badges at 216px.
 */
export function NavRail() {
  const pathname = usePathname();
  const expanded = useRailExpanded();
  const toggleRail = useUiStore((s) => s.toggleRail);
  const active = activeNavId(pathname);

  // One summary query feeds every badge — not one query per item.
  const { data: summary } = useDashboardSummary();
  const prefetch = usePrefetchRoute();

  const badgeFor = useCallback(
    (key?: NavBadgeKey) => {
      if (!key || !summary) return undefined;
      const value = summary[key];
      return typeof value === "number" && value > 0 ? value : undefined;
    },
    [summary],
  );

  return (
    <nav
      aria-label="Primary"
      data-testid="nav-rail"
      data-expanded={expanded}
      className={cn(
        "flex shrink-0 flex-col border-r border-border bg-chrome",
        "transition-[width] duration-200 ease-out motion-reduce:transition-none",
      )}
      style={{ width: expanded ? "var(--nav-rail-w-expanded)" : "var(--nav-rail-w)" }}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((item) => item.group === group.id);
          if (!items.length) return null;
          return (
            <div key={group.id} className="mb-1.5">
              {expanded ? (
                <p className="label-mono px-3 pb-1 pt-2 text-[10px]">{group.label}</p>
              ) : (
                <div className="mx-3 my-2 border-t border-border/60" aria-hidden />
              )}
              <ul className="space-y-0.5 px-1.5">
                {items.map((item) => (
                  <NavRailItem
                    key={item.id}
                    item={item}
                    active={item.id === active}
                    expanded={expanded}
                    badge={badgeFor(item.badgeKey)}
                    onPrefetch={prefetch}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={toggleRail}
        aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
        aria-expanded={expanded}
        data-testid="nav-rail-toggle"
        className={cn(
          "m-1.5 flex h-8 items-center gap-2 rounded-[var(--radius-md)] px-2.5",
          "text-chrome-foreground hover:bg-muted hover:text-foreground",
          "transition-colors",
        )}
      >
        {expanded ? (
          <ChevronsLeft className="size-4 shrink-0" aria-hidden />
        ) : (
          <ChevronsRight className="size-4 shrink-0" aria-hidden />
        )}
        {expanded ? <span className="truncate text-xs">Collapse</span> : null}
      </button>
    </nav>
  );
}

interface NavRailItemProps {
  item: NavItem;
  active: boolean;
  expanded: boolean;
  badge?: number;
  onPrefetch: (href: string) => void;
}

/**
 * Memoized: the rail re-renders on every route change and on every dashboard
 * refetch, but an individual item only changes when its own props do.
 */
const NavRailItem = memo(function NavRailItem({
  item,
  active,
  expanded,
  badge,
  onPrefetch,
}: NavRailItemProps) {
  const Icon = NAV_ICONS[item.icon] ?? Circle;
  const handleEnter = useCallback(() => onPrefetch(item.href), [onPrefetch, item.href]);

  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={expanded ? undefined : item.label}
      data-testid={`nav-rail-${item.id}`}
      onMouseEnter={handleEnter}
      onFocus={handleEnter}
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded-[var(--radius-md)] px-2.5",
        "outline-none transition-colors",
        active
          ? "bg-primary/12 text-foreground"
          : "text-chrome-foreground hover:bg-muted hover:text-foreground",
        !expanded && "justify-center px-0",
      )}
    >
      {/* Active marker rides the left edge so it reads at both widths. */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary",
          "transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden />
      {expanded ? (
        <>
          <span className="flex-1 truncate text-xs font-medium">{item.label}</span>
          {badge !== undefined ? (
            <Badge variant={item.badgeKey === "criticalFindings" ? "error" : "muted"} size="xs">
              {badge}
            </Badge>
          ) : null}
        </>
      ) : badge !== undefined ? (
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary ring-2 ring-chrome"
        />
      ) : null}
    </Link>
  );

  // Collapsed, the icon alone isn't self-describing — the tooltip carries the
  // label, description and shortcut.
  if (expanded) return <li>{link}</li>;

  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="flex max-w-56 flex-col gap-1">
          <span className="flex items-center gap-2 text-xs font-medium">
            {item.label}
            {item.shortcut ? <Kbd value={item.shortcut} /> : null}
            {badge !== undefined ? (
              <Badge variant="muted" size="xs">
                {badge}
              </Badge>
            ) : null}
          </span>
          <span className="text-[11px] leading-snug text-muted-foreground">{item.description}</span>
        </TooltipContent>
      </Tooltip>
    </li>
  );
});
