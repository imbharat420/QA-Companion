"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { ToneDot } from "./ToneDot";

export interface TreeNode {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
  /** Tone name for a leading dot — folder colours, suite health. */
  colorToken?: string;
  children?: TreeNode[];
  href?: string;
  /** Whatever the caller needs handed back in `onSelect`. */
  data?: unknown;
}

export interface TreeViewProps {
  nodes: TreeNode[];
  selectedId?: string;
  onSelect?: (node: TreeNode) => void;
  defaultExpanded?: string[];
  testId: string;
}

interface FlatNode {
  node: TreeNode;
  level: number;
  parentId: string | null;
  expandable: boolean;
  expanded: boolean;
}

/** Visible nodes in render order — the list arrow-key navigation walks. */
function flatten(
  nodes: TreeNode[],
  expanded: ReadonlySet<string>,
  level = 1,
  parentId: string | null = null,
  out: FlatNode[] = [],
): FlatNode[] {
  for (const node of nodes) {
    const expandable = Boolean(node.children?.length);
    const isOpen = expandable && expanded.has(node.id);
    out.push({ node, level, parentId, expandable, expanded: isOpen });
    if (isOpen && node.children) flatten(node.children, expanded, level + 1, node.id, out);
  }
  return out;
}

export function TreeView({ nodes, selectedId, onSelect, defaultExpanded, testId }: TreeViewProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(defaultExpanded ?? []),
  );
  const [focusId, setFocusId] = useState<string | null>(null);
  const items = useRef(new Map<string, HTMLDivElement>());
  const links = useRef(new Map<string, HTMLAnchorElement>());

  const flat = useMemo(() => flatten(nodes, expanded), [nodes, expanded]);

  // Roving tabindex: exactly one item is tabbable, and it stays valid when the
  // focused node's ancestor collapses out from under it.
  const activeId =
    flat.find((f) => f.node.id === focusId)?.node.id ??
    flat.find((f) => f.node.id === selectedId)?.node.id ??
    flat[0]?.node.id ??
    null;

  const focus = useCallback((id: string) => {
    setFocusId(id);
    items.current.get(id)?.focus();
  }, []);

  const toggle = useCallback((id: string, open: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const activate = useCallback(
    (entry: FlatNode) => {
      if (entry.expandable) toggle(entry.node.id, !entry.expanded);
      onSelect?.(entry.node);
      // Click the anchor rather than reimplementing navigation, so keyboard
      // activation and a real mouse click take exactly the same path.
      if (entry.node.href) links.current.get(entry.node.id)?.click();
    },
    [onSelect, toggle],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const index = flat.findIndex((f) => f.node.id === activeId);
      if (index < 0) return;
      const entry = flat[index];

      switch (event.key) {
        case "ArrowDown": {
          const next = flat[index + 1];
          if (next) focus(next.node.id);
          break;
        }
        case "ArrowUp": {
          const prev = flat[index - 1];
          if (prev) focus(prev.node.id);
          break;
        }
        case "ArrowRight": {
          if (!entry.expandable) return;
          if (entry.expanded) {
            const child = flat[index + 1];
            if (child) focus(child.node.id);
          } else {
            toggle(entry.node.id, true);
          }
          break;
        }
        case "ArrowLeft": {
          if (entry.expanded) toggle(entry.node.id, false);
          else if (entry.parentId) focus(entry.parentId);
          else return;
          break;
        }
        case "Home": {
          const first = flat[0];
          if (first) focus(first.node.id);
          break;
        }
        case "End": {
          const last = flat[flat.length - 1];
          if (last) focus(last.node.id);
          break;
        }
        case "Enter":
        case " ": {
          activate(entry);
          break;
        }
        default:
          return;
      }
      event.preventDefault();
    },
    [activate, activeId, flat, focus, toggle],
  );

  return (
    <div
      role="tree"
      aria-label="Tree"
      data-testid={testId}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-0.5"
    >
      {flat.map((entry) => {
        const { node, level, expandable, expanded: isOpen } = entry;
        const Icon = node.icon;
        const selected = node.id === selectedId;
        const rowClass = cn(
          "flex min-w-0 flex-1 items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 py-1",
          "text-xs transition-colors duration-100",
          selected
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        );

        const rowBody = (
          <>
            {node.colorToken ? <ToneDot tone={node.colorToken} size={7} /> : null}
            {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
            <span className="truncate">{node.label}</span>
            {node.badge === undefined ? null : (
              <Badge variant="muted" size="xs" className="ml-auto shrink-0">
                {node.badge}
              </Badge>
            )}
          </>
        );

        return (
          <div
            key={node.id}
            role="treeitem"
            // Pins the accessible name to this node's own label: a treeitem is
            // the ancestor of its group, so without this it would be announced
            // with the whole subtree's text.
            aria-label={node.label}
            aria-level={level}
            aria-selected={selected}
            aria-expanded={expandable ? isOpen : undefined}
            tabIndex={node.id === activeId ? 0 : -1}
            ref={(el) => {
              if (el) items.current.set(node.id, el);
              else items.current.delete(node.id);
            }}
            onFocus={() => setFocusId(node.id)}
            data-testid={`${testId}-item-${node.id}`}
            className="flex items-center rounded-[var(--radius-sm)]"
            style={{ paddingLeft: (level - 1) * 12 }}
          >
            {expandable ? (
              <button
                type="button"
                tabIndex={-1}
                aria-label={isOpen ? `Collapse ${node.label}` : `Expand ${node.label}`}
                onClick={() => toggle(node.id, !isOpen)}
                className="grid size-4 shrink-0 place-items-center text-subtle-foreground hover:text-foreground"
              >
                <ChevronRight
                  aria-hidden
                  className={cn("size-3 transition-transform duration-150", isOpen && "rotate-90")}
                />
              </button>
            ) : (
              <span aria-hidden className="size-4 shrink-0" />
            )}

            {node.href ? (
              <Link
                href={node.href}
                tabIndex={-1}
                ref={(el) => {
                  if (el) links.current.set(node.id, el);
                  else links.current.delete(node.id);
                }}
                onClick={() => onSelect?.(node)}
                className={rowClass}
              >
                {rowBody}
              </Link>
            ) : (
              <button type="button" tabIndex={-1} onClick={() => activate(entry)} className={rowClass}>
                {rowBody}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
