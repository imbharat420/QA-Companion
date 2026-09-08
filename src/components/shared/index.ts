/**
 * THE SHARED COMPOSITE BARREL.
 *
 * Eight pages build on these, so the surface here is the contract: import from
 * "@/components/shared", never from a file inside it, so a composite can be
 * split or re-shaped without touching a page.
 */

export { AgentStatusPill, type AgentStatusPillProps } from "./AgentStatusPill";
export { CodeBlock, type CodeBlockProps } from "./CodeBlock";
export { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
export { CopyButton, type CopyButtonProps } from "./CopyButton";
export { DataTable, type Column, type DataTableProps } from "./DataTable";
export { DiffViewer, type DiffViewerProps } from "./DiffViewer";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { ErrorState, type ErrorStateProps } from "./ErrorState";
export { FailureCockpit, type FailureCockpitProps } from "./FailureCockpit";
export { FilterBar, type FilterBarProps, type FilterDef } from "./FilterBar";
export { ImageDiffSlider, type ImageDiffSliderProps } from "./ImageDiffSlider";
export { LoadingState, type LoadingStateProps } from "./LoadingState";
export { PageHeader, type Breadcrumb, type PageHeaderProps } from "./PageHeader";
export { ResizableSplit, type ResizableSplitProps } from "./ResizableSplit";
export { ScoreRing, type ScoreRingProps } from "./ScoreRing";
export { SeverityBadge, type SeverityBadgeProps } from "./SeverityBadge";
export { StatGrid, type StatGridProps } from "./StatGrid";
export { StatTile, type StatTileProps, type StatTone } from "./StatTile";
export { StatusBadge, type StatusBadgeProps } from "./StatusBadge";
export { ToneDot, toneTextClass, type ToneDotProps } from "./ToneDot";
export { TreeView, type TreeNode, type TreeViewProps } from "./TreeView";
