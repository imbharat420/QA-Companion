"use client";

import { memo } from "react";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/shared";
import { cn } from "@/lib/utils";
import type { ApiSchemaField } from "@/lib/api/types";

type Drift = NonNullable<ApiSchemaField["drift"]>;

/**
 * The drift column is the point of this table: "the API changed and nobody told
 * us" has to be visible without opening the spec. So a drifting row is tinted by
 * how badly it breaks a client, and the documented type sits next to the observed
 * one rather than in a tooltip.
 */
const DRIFT_LABEL: Record<Drift, string> = {
  missing: "Missing",
  extra: "Extra",
  "type-changed": "Type changed",
  nullability: "Nullability",
};

const DRIFT_BADGE: Record<Drift, string> = {
  missing: "border-critical/30 bg-critical/15 text-critical",
  "type-changed": "border-high/30 bg-high/15 text-high",
  nullability: "border-medium/30 bg-medium/15 text-medium",
  extra: "border-low/30 bg-low/15 text-low",
};

const DRIFT_ROW: Record<Drift, string> = {
  missing: "bg-critical/10",
  "type-changed": "bg-high/10",
  nullability: "bg-medium/10",
  extra: "bg-low/10",
};

const DRIFT_HINT: Record<Drift, string> = {
  missing: "documented, never observed",
  extra: "observed, not in the spec",
  "type-changed": "type contradicts the spec",
  nullability: "nullable in traffic, not in the spec",
};

export interface SchemaTableProps {
  fields: ApiSchemaField[];
  /** Separates the request and response instances in the DOM. */
  testId?: string;
}

function SchemaTableImpl({ fields, testId = "schema-table" }: SchemaTableProps) {
  if (fields.length === 0) {
    return (
      <EmptyState
        title="No fields observed"
        description="The proxy saw no body or parameters on this side of the exchange."
        testId={`${testId}-empty`}
      />
    );
  }

  const drifting = fields.filter((field) => field.drift).length;

  return (
    <div
      data-testid={testId}
      className="overflow-hidden rounded-[var(--radius-lg)] border border-border/70 bg-card"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-elevated px-3 py-2">
        <span className="label-mono">
          {fields.length} {fields.length === 1 ? "field" : "fields"}
        </span>
        <span
          data-testid={`${testId}-drift-count`}
          className={cn("label-mono", drifting > 0 && "text-accent")}
        >
          {drifting > 0 ? `${drifting} drifting` : "matches the spec"}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="w-24">Required</TableHead>
            <TableHead className="w-64">Drift</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field) => (
            <TableRow
              key={field.name}
              data-testid={`${testId}-row-${field.name}`}
              data-drift={field.drift ?? undefined}
              className={field.drift ? DRIFT_ROW[field.drift] : undefined}
            >
              <TableCell className="text-code font-medium text-foreground">{field.name}</TableCell>
              <TableCell className="text-code break-words text-muted-foreground">
                {field.type}
              </TableCell>
              <TableCell>
                {field.required ? (
                  <Badge variant="outline" size="xs" className="border-border text-foreground">
                    yes
                  </Badge>
                ) : (
                  <span className="text-[11px] text-subtle-foreground">optional</span>
                )}
              </TableCell>
              <TableCell>
                {field.drift ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" size="xs" className={DRIFT_BADGE[field.drift]}>
                        {DRIFT_LABEL[field.drift]}
                      </Badge>
                      {field.documentedType ? (
                        <span className="flex min-w-0 items-center gap-1">
                          <span className="text-code truncate text-muted-foreground line-through">
                            {field.documentedType}
                          </span>
                          <ArrowRight className="size-3 shrink-0 text-accent" aria-hidden />
                          <span className="text-code truncate text-accent">{field.type}</span>
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] leading-snug text-subtle-foreground">
                      {DRIFT_HINT[field.drift]}
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-subtle-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const SchemaTable = memo(SchemaTableImpl);
