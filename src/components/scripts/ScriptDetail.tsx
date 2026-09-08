"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { FormEvent } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Copy,
  ExternalLink,
  FileCode2,
  History,
  Pencil,
  Play,
  Repeat2,
  Save,
  Sliders,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Input,
  Label,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui";
import { CodeBlock, ConfirmDialog, CopyButton, DiffViewer, EmptyState } from "@/components/shared";
import { routes } from "@/config/nav";
import { cn, formatCompact, formatRelative } from "@/lib/utils";
import {
  KIND_META,
  SOURCE_META,
  bareName,
  relatedSurface,
  scriptFilename,
  scriptReference,
  sourceHref,
} from "./ScriptCard";
import type { ScriptEntry, ScriptParam } from "@/lib/api/types";

export const SCRIPT_TABS = ["code", "params", "versions", "usage"] as const;
export type ScriptTab = (typeof SCRIPT_TABS)[number];

export const readScriptTab = (value: string | null): ScriptTab =>
  SCRIPT_TABS.find((tab) => tab === value) ?? "code";

const defaultValues = (params: ScriptParam[]): Record<string, string> =>
  Object.fromEntries(
    params.map((param) => [param.name, param.default ?? (param.type === "boolean" ? "false" : "")]),
  );

/** Booleans are never "missing" — an unchecked switch is a real answer. */
const missingRequired = (params: ScriptParam[], values: Record<string, string>) =>
  params
    .filter((param) => param.required && param.type !== "boolean" && !values[param.name]?.trim())
    .map((param) => param.name);

/**
 * Who else calls this asset. The model holds no reverse index, so it is derived
 * from the library itself: an asset is referenced when another asset's source
 * mentions the identifier its name exposes. Textual, so a name shadowed by an
 * unrelated local would over-report — cheap enough to be worth that.
 */
function referencedBy(script: ScriptEntry, library: ScriptEntry[]): ScriptEntry[] {
  const needle = bareName(script.name);
  if (needle.length < 3) return [];
  return library.filter((other) => other.id !== script.id && other.code.includes(needle));
}

export interface ScriptDetailProps {
  script: ScriptEntry;
  /** The whole library — the Usage tab derives its reverse references from it. */
  library: ScriptEntry[];
  tab: ScriptTab;
  onTabChange: (tab: ScriptTab) => void;
  /** Start an agent task with the filled params and jump to the workbench. */
  onRun: (script: ScriptEntry, values: Record<string, string>) => void;
  onInsert: (script: ScriptEntry) => void;
  onDuplicate: (script: ScriptEntry) => void;
  onSave: (next: ScriptEntry) => void;
  saving?: boolean;
}

export function ScriptDetail({
  script,
  library,
  tab,
  onTabChange,
  onRun,
  onInsert,
  onDuplicate,
  onSave,
  saving = false,
}: ScriptDetailProps) {
  /** Non-null while the Code tab is in edit mode; `base` is the version it forked from. */
  const [draft, setDraft] = useState<{ code: string; base: number } | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => defaultValues(script.params));
  const [missing, setMissing] = useState<string[]>([]);

  const kind = KIND_META[script.kind];
  const KindIcon = kind.icon;
  const source = script.sourceKind ? SOURCE_META[script.sourceKind] : null;
  const SourceIcon = source?.icon ?? FileCode2;
  const provenance = sourceHref(script);
  const related = relatedSurface(script);
  const reference = scriptReference(script.name);
  const filename = scriptFilename(script);

  const versions = useMemo(
    () => script.versions.slice().sort((a, b) => b.version - a.version),
    [script.versions],
  );

  const references = useMemo(() => referencedBy(script, library), [script, library]);

  const commit = useCallback(
    (code: string) => {
      onSave({ ...script, code });
      setDraft(null);
      setConflictOpen(false);
    },
    [onSave, script],
  );

  const save = useCallback(() => {
    if (!draft) return;
    // Someone else's save landed while this edit was open — do not clobber it silently.
    if (script.version !== draft.base) {
      setConflictOpen(true);
      return;
    }
    commit(draft.code);
  }, [commit, draft, script.version]);

  const setValue = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setMissing((prev) => prev.filter((entry) => entry !== name));
  }, []);

  const run = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const gaps = missingRequired(script.params, values);
      if (gaps.length > 0) {
        setMissing(gaps);
        return;
      }
      setMissing([]);
      onRun(script, values);
    },
    [onRun, script, values],
  );

  const runFromHeader = useCallback(() => {
    const gaps = missingRequired(script.params, values);
    if (gaps.length > 0) {
      setMissing(gaps);
      onTabChange("params");
      return;
    }
    onRun(script, values);
  }, [onRun, onTabChange, script, values]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="scripts-detail">
      {/* --- identity ------------------------------------------------- */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={kind.variant} size="xs" title={kind.hint}>
            <KindIcon className="size-2.5" aria-hidden />
            {kind.label}
          </Badge>
          <Badge variant="muted" size="xs">
            {script.language}
          </Badge>
          <Badge variant="outline" size="xs" data-testid="scripts-detail-version">
            v{script.version}
          </Badge>
          <span
            className="flex items-center gap-1 font-mono text-[11px] tabular-nums text-foreground"
            title={`${script.usageCount} recorded uses`}
            data-testid="scripts-detail-uses"
          >
            <Repeat2 className="size-3 text-primary" aria-hidden />
            {formatCompact(script.usageCount)} uses
          </span>
          <span className="label-mono flex items-center gap-1 text-[9px]" title={source?.hint}>
            <SourceIcon className="size-3" aria-hidden />
            {source ? source.label : "Unknown source"}
          </span>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">{script.description}</p>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-code flex items-center gap-1 rounded-[var(--radius-sm)] bg-elevated px-1.5 py-0.5 text-primary"
            title="Reference this asset from chat"
          >
            {reference}
          </span>
          <CopyButton value={reference} testId="scripts-detail-copy-reference" />
          <span className="text-[11px] text-subtle-foreground">
            Paste that into chat to call this asset by name.
          </span>
        </div>
      </div>

      {/* --- actions --------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={runFromHeader}
          data-testid="scripts-detail-run-btn"
        >
          <Play className="size-3.5" aria-hidden />
          Run now
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onInsert(script)}
          data-testid="scripts-detail-insert-btn"
        >
          <ArrowUpRight className="size-3.5" aria-hidden />
          Insert into test
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDuplicate(script)}
          data-testid="scripts-detail-duplicate-btn"
        >
          <Copy className="size-3.5" aria-hidden />
          Duplicate
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={save}
          disabled={!draft || draft.code === script.code}
          loading={saving}
          data-testid="scripts-detail-save-btn"
        >
          <Save className="size-3.5" aria-hidden />
          Save v{script.version + 1}
        </Button>
      </div>

      {/* --- tabs ------------------------------------------------------ */}
      {/* The tab is URL state, so the list can deep-link straight at Params or
          Versions. Only the active panel mounts — a DiffViewer per version
          behind a hidden tab is wasted work. */}
      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(readScriptTab(value))}
        className="min-h-0 flex-1"
      >
        <TabsList>
          {SCRIPT_TABS.map((id) => {
            const count =
              id === "params" ? script.params.length : id === "versions" ? versions.length : null;
            return (
              <TabsTrigger key={id} value={id} data-testid={`scripts-detail-tab-${id}`}>
                {TAB_LABEL[id]}
                {count === null ? null : (
                  <span className="font-mono text-[10px] tabular-nums text-subtle-foreground">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="code" className="min-h-0 flex-1 overflow-y-auto">
          <section aria-label="Source" className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-code truncate text-muted-foreground">{filename}</span>
              <div className="ml-auto flex items-center gap-1.5">
                <CopyButton value={script.code} label="Copy code" testId="scripts-detail-copy-code" />
                {draft ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setDraft(null)}
                    data-testid="scripts-detail-cancel-edit"
                  >
                    <X className="size-3.5" aria-hidden />
                    Discard edit
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setDraft({ code: script.code, base: script.version })}
                    data-testid="scripts-detail-edit-code"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {draft ? (
              <>
                <Label htmlFor="scripts-detail-code-editor" className="sr-only">
                  {filename} source
                </Label>
                <Textarea
                  id="scripts-detail-code-editor"
                  value={draft.code}
                  onChange={(event) => setDraft({ ...draft, code: event.target.value })}
                  spellCheck={false}
                  rows={20}
                  className="text-code min-h-[320px] leading-[1.6]"
                  data-testid="scripts-detail-code-editor"
                />
                <p className="text-[11px] text-muted-foreground">
                  Saving records a v{script.version + 1} entry in the history with this diff.
                </p>
              </>
            ) : (
              <CodeBlock
                code={script.code}
                language={script.language}
                filename={filename}
                lineNumbers
                maxHeight={420}
              />
            )}
          </section>
        </TabsContent>

        <TabsContent value="params" className="min-h-0 flex-1 overflow-y-auto">
          <form onSubmit={run} className="flex flex-col gap-3" data-testid="scripts-detail-params-form">
            {script.params.length === 0 ? (
              <EmptyState
                icon={Sliders}
                title="No parameters"
                description="This asset takes no inputs — Run now starts it as-is."
                testId="scripts-detail-params-empty"
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {script.params.map((param) => (
                  <ParamField
                    key={param.name}
                    param={param}
                    value={values[param.name] ?? ""}
                    invalid={missing.includes(param.name)}
                    onChange={setValue}
                  />
                ))}
              </div>
            )}

            {missing.length > 0 ? (
              <p
                role="alert"
                className="flex items-center gap-1.5 text-[11px] text-destructive"
                data-testid="scripts-detail-params-error"
              >
                <AlertTriangle className="size-3.5" aria-hidden />
                Fill {missing.join(", ")} before running.
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <Button variant="primary" size="lg" type="submit" data-testid="scripts-detail-params-run">
                <Play className="size-3.5" aria-hidden />
                Run now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  setValues(defaultValues(script.params));
                  setMissing([]);
                }}
                data-testid="scripts-detail-params-reset"
              >
                Reset to defaults
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="versions" className="min-h-0 flex-1 overflow-y-auto">
          <section aria-label="Version history" className="flex flex-col gap-3">
            {versions.length === 0 ? (
              <EmptyState
                icon={History}
                title="No recorded history"
                description="This asset has not been saved since it entered the library."
                testId="scripts-detail-versions-empty"
              />
            ) : (
              versions.map((version) => (
                <article
                  key={version.version}
                  className="surface-inset flex flex-col gap-2 p-2.5"
                  data-testid={`scripts-detail-version-${version.version}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={version.version === script.version ? "primary" : "outline"}
                      size="xs"
                    >
                      v{version.version}
                    </Badge>
                    <span className="text-[11px] text-foreground">{version.author}</span>
                    <span className="text-[11px] text-subtle-foreground" title={version.createdAt}>
                      {formatRelative(version.createdAt)}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">{version.note}</p>
                  <DiffViewer diff={version.diff} filename={filename} maxHeight={260} />
                </article>
              ))
            )}
          </section>
        </TabsContent>

        <TabsContent value="usage" className="min-h-0 flex-1 overflow-y-auto">
          <section aria-label="Usage and provenance" className="flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="surface-inset p-2.5">
                <span className="label-mono text-[9px]">Recorded uses</span>
                <p className="font-mono text-lg tabular-nums text-foreground">
                  {formatCompact(script.usageCount)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Every call from a spec, a skill or a chat session counts once.
                </p>
              </div>
              <div className="surface-inset flex flex-col gap-1.5 p-2.5">
                <span className="label-mono text-[9px]">Provenance</span>
                <span className="flex items-center gap-1.5 text-[12px] text-foreground">
                  <SourceIcon className="size-3.5 text-primary" aria-hidden />
                  {source ? source.label : "Unknown"}
                </span>
                {script.sourceRef ? (
                  provenance ? (
                    <Link
                      href={provenance}
                      className="text-code w-fit rounded text-primary underline-offset-2 hover:underline"
                      data-testid="scripts-detail-source-link"
                    >
                      {script.sourceRef}
                    </Link>
                  ) : (
                    <span className="text-code text-muted-foreground">{script.sourceRef}</span>
                  )
                ) : (
                  <span className="text-[11px] text-subtle-foreground">No source reference</span>
                )}
                {related ? (
                  <Link
                    href={related.href}
                    className="flex w-fit items-center gap-1 rounded text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    data-testid="scripts-detail-related-link"
                  >
                    <ExternalLink className="size-3" aria-hidden />
                    {related.label}
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="label-mono text-[10px]">Referenced by</h3>
              {references.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No other asset in the library calls{" "}
                  <code className="text-code text-foreground">{bareName(script.name)}</code>. It is
                  invoked from specs and chat instead.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {references.map((other) => (
                    <li key={other.id}>
                      <Link
                        href={routes.scripts({ scriptId: other.id })}
                        className={cn(
                          "surface-inset flex items-center gap-2 px-2.5 py-1.5",
                          "transition-colors hover:border-border",
                        )}
                        data-testid={`scripts-detail-reference-${other.id}`}
                      >
                        <Badge variant={KIND_META[other.kind].variant} size="xs">
                          {KIND_META[other.kind].label}
                        </Badge>
                        <span className="text-code truncate text-foreground">{other.name}</span>
                        <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
                          {formatCompact(other.usageCount)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="label-mono text-[10px]">Call it from chat</h3>
              <CodeBlock
                code={`Run ${reference} against staging with the default params.`}
                language="chat"
                maxHeight={80}
              />
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={conflictOpen}
        onOpenChange={setConflictOpen}
        title={`Overwrite v${script.version}?`}
        description={`This asset was saved to v${script.version} elsewhere while your edit was open. Saving now writes v${script.version + 1} from your copy and drops those changes.`}
        confirmLabel="Overwrite"
        destructive
        onConfirm={() => {
          if (draft) commit(draft.code);
        }}
        testId="scripts-detail-conflict-dialog"
      />
    </div>
  );
}

/* ==========================================================================
   TAB SHELL
   ======================================================================== */

const TAB_LABEL: Record<ScriptTab, string> = {
  code: "Code",
  params: "Params",
  versions: "Versions",
  usage: "Usage",
};

/* ==========================================================================
   PARAM FIELD
   ======================================================================== */

interface ParamFieldProps {
  param: ScriptParam;
  value: string;
  invalid: boolean;
  onChange: (name: string, value: string) => void;
}

const TYPE_HINT: Record<ScriptParam["type"], string> = {
  string: "string",
  number: "number",
  boolean: "boolean",
  secret: "secret",
};

function ParamField({ param, value, invalid, onChange }: ParamFieldProps) {
  const id = `scripts-param-${param.name}`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Label htmlFor={id} className="text-code text-[11.5px] text-foreground">
          {param.name}
        </Label>
        <Badge variant={param.type === "secret" ? "warning" : "muted"} size="xs">
          {TYPE_HINT[param.type]}
        </Badge>
        {param.required ? (
          <span className="label-mono text-[9px] text-destructive" aria-hidden>
            required
          </span>
        ) : (
          <span className="label-mono text-[9px]">optional</span>
        )}
        {param.default ? (
          <span className="text-code ml-auto text-[10px] text-subtle-foreground">
            default {param.default}
          </span>
        ) : null}
      </div>

      {param.type === "boolean" ? (
        <span className="flex items-center gap-2">
          <Switch
            id={id}
            checked={value === "true"}
            onCheckedChange={(on) => onChange(param.name, on ? "true" : "false")}
            data-testid={`scripts-param-${param.name}-switch`}
          />
          <span className="text-[11px] text-muted-foreground">
            {value === "true" ? "true" : "false"}
          </span>
        </span>
      ) : (
        <Input
          id={id}
          type={param.type === "secret" ? "password" : param.type === "number" ? "number" : "text"}
          inputMode={param.type === "number" ? "decimal" : undefined}
          autoComplete={param.type === "secret" ? "off" : undefined}
          value={value}
          required={param.required}
          invalid={invalid}
          placeholder={param.default ?? (param.required ? "Required" : "Optional")}
          onChange={(event) => onChange(param.name, event.target.value)}
          data-testid={`scripts-param-${param.name}-input`}
        />
      )}

      {param.description ? (
        <p className="text-[11px] leading-snug text-muted-foreground">{param.description}</p>
      ) : null}
    </div>
  );
}
