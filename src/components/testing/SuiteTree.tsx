"use client";

import { memo, useCallback, useMemo } from "react";
import { FileCode2, FolderGit2 } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { TreeView } from "@/components/shared";
import { formatPercent } from "@/lib/utils";
import type { TreeNode } from "@/components/shared";
import type { Suite, SuiteStatus } from "@/lib/api/types";

/** Suite health -> the tone token TreeView paints its leading dot with. */
const STATUS_TONE: Record<SuiteStatus, string> = {
  passing: "success",
  failing: "error",
  flaky: "warning",
};

const STATUS_ORDER: SuiteStatus[] = ["failing", "flaky", "passing"];
const STATUS_LABEL: Record<SuiteStatus, string> = {
  failing: "Failing",
  flaky: "Flaky",
  passing: "Passing",
};

export interface SuiteTreeProps {
  suites: Suite[];
  /** Project row label — the tree's root. */
  projectName?: string;
  projectHref?: string;
  selectedSuiteId?: string;
  onSelectSuite: (suiteId: string) => void;
  loading?: boolean;
  /** Cached rows are dimmed rather than dropped while a refetch is failing. */
  stale?: boolean;
}

/**
 * Project -> status group -> suite. The status tier is what makes the tree worth
 * having over the table: a failing spec is one glance away instead of a sort.
 */
function SuiteTreeImpl({
  suites,
  projectName,
  projectHref,
  selectedSuiteId,
  onSelectSuite,
  loading = false,
  stale = false,
}: SuiteTreeProps) {
  const nodes = useMemo<TreeNode[]>(() => {
    const groups = STATUS_ORDER.filter((status) => suites.some((s) => s.status === status)).map(
      (status) => {
        const members = suites.filter((suite) => suite.status === status);
        return {
          id: `group-${status}`,
          label: STATUS_LABEL[status],
          colorToken: STATUS_TONE[status],
          badge: members.length,
          children: members.map((suite) => ({
            id: suite.id,
            label: suite.name,
            icon: FileCode2,
            colorToken: STATUS_TONE[suite.status],
            badge: `${suite.cases} · ${formatPercent(suite.passRate / 100, 0)}`,
            data: suite,
          })),
        } satisfies TreeNode;
      },
    );

    return [
      {
        id: "project-root",
        label: projectName ?? "Project",
        icon: FolderGit2,
        badge: suites.length,
        href: projectHref,
        children: groups,
      },
    ];
  }, [projectHref, projectName, suites]);

  const expanded = useMemo(
    () => ["project-root", ...STATUS_ORDER.map((status) => `group-${status}`)],
    [],
  );

  const onSelect = useCallback(
    (node: TreeNode) => {
      // Only leaves carry a Suite in `data`; group and project rows just expand.
      if (node.data) onSelectSuite(node.id);
    },
    [onSelectSuite],
  );

  if (loading) {
    return (
      <div data-testid="suite-tree-loading" aria-busy="true" className="flex flex-col gap-2 p-2">
        <span className="sr-only" role="status">
          Loading suites…
        </span>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className={i % 3 === 0 ? "h-4 w-2/3" : "h-4 w-full"} />
        ))}
      </div>
    );
  }

  return (
    <div
      data-testid="suite-tree"
      data-stale={stale || undefined}
      className={stale ? "opacity-50 transition-opacity" : undefined}
    >
      <TreeView
        nodes={nodes}
        selectedId={selectedSuiteId}
        onSelect={onSelect}
        defaultExpanded={expanded}
        testId="suite-tree-view"
      />
    </div>
  );
}

export const SuiteTree = memo(SuiteTreeImpl);
