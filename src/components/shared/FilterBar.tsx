"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { formatCompact } from "@/lib/utils";

export interface FilterDef {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string; count?: number }[];
}

export interface FilterBarProps {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  onFilterChange?: (id: string, value: string) => void;
  /** Trailing slot — view switchers, bulk actions, a run button. */
  right?: ReactNode;
  testId: string;
}

/**
 * Fully controlled: every page keeps its filter state in the URL, so this
 * component owns none of it and simply reports changes upward.
 */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters,
  onFilterChange,
  right,
  testId,
}: FilterBarProps) {
  return (
    <div
      data-testid={testId}
      className="flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-border/70 bg-card p-2"
    >
      {onSearchChange ? (
        <div className="min-w-48 flex-1 basis-56">
          <Input
            type="search"
            value={search ?? ""}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            leftIcon={<Search />}
            data-testid={`${testId}-search`}
          />
        </div>
      ) : null}

      {filters?.map((filter) => (
        <div key={filter.id} className="flex shrink-0 items-center gap-1.5">
          <span className="label-mono hidden text-[10px] sm:inline">{filter.label}</span>
          <Select
            value={filter.value}
            onValueChange={(value) => onFilterChange?.(filter.id, value)}
          >
            <SelectTrigger
              className="h-8 w-auto min-w-28 gap-1.5"
              aria-label={filter.label}
              data-testid={`${testId}-filter-${filter.id}`}
            >
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              {filter.options.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  data-testid={`${testId}-filter-${filter.id}-${option.value}`}
                >
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="truncate">{option.label}</span>
                    {option.count === undefined ? null : (
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                        {formatCompact(option.count)}
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      {right ? <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}
