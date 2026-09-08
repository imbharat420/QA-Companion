"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent as ReactDragEvent } from "react";
import { CheckCircle2, FolderUp, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Progress } from "@/components/ui";
import { isTauri } from "@/lib/api/tauri";
import { useProjectsStore, useUploadQueue } from "@/store";
import { cn } from "@/lib/utils";

export interface UploadDropzoneProps {
  /** Sidebar rendering — shorter copy, tighter padding. */
  compact?: boolean;
  className?: string;
}

/** Progress ticks per item, so the transfer is visible rather than instant. */
const TICK_MS = 260;

/**
 * The one place a project enters the app. Drops, the native folder picker
 * (Tauri) and the `<input type="file">` fallback (browser dev) all land on the
 * same queue in `projectsStore`, so the progress rows below are the single
 * account of what is being imported.
 */
export function UploadDropzone({ compact = false, className }: UploadDropzoneProps) {
  const queue = useUploadQueue();
  const enqueueUpload = useProjectsStore((s) => s.enqueueUpload);
  const updateUpload = useProjectsStore((s) => s.updateUpload);
  const clearFinishedUploads = useProjectsStore((s) => s.clearFinishedUploads);

  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef(new Map<string, number>());

  // A queue item outlives this component (the store is app-wide); its driver
  // must not, or an unmounted sidebar keeps ticking intervals forever.
  useEffect(() => {
    const running = timers.current;
    return () => {
      running.forEach((timer) => window.clearInterval(timer));
      running.clear();
    };
  }, []);

  const start = useCallback(
    (names: string[]) => {
      for (const name of names) {
        const id = enqueueUpload(name);
        updateUpload(id, { state: "uploading" });
        let progress = 0;
        const timer = window.setInterval(() => {
          progress += 6 + Math.random() * 12;
          if (progress >= 100) {
            window.clearInterval(timer);
            timers.current.delete(id);
            updateUpload(id, { progress: 100, state: "done" });
            return;
          }
          updateUpload(id, { progress: Math.round(progress) });
        }, TICK_MS);
        timers.current.set(id, timer);
      }
      if (names.length) {
        toast.success(`Importing ${names.length} ${names.length === 1 ? "folder" : "folders"}`);
      }
    },
    [enqueueUpload, updateUpload],
  );

  const openPicker = useCallback(async () => {
    if (isTauri()) {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const picked = await open({
        directory: true,
        multiple: true,
        title: "Import project folder",
      });
      if (!picked) return;
      const paths = Array.isArray(picked) ? picked : [picked];
      start(paths.map((path) => path.split(/[\\/]/).pop() || path));
      return;
    }
    inputRef.current?.click();
  }, [start]);

  const onPicked = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      start(files.map((file) => file.name));
      // Same selection twice in a row must still fire a change event.
      event.target.value = "";
    },
    [start],
  );

  const onDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      const names = Array.from(event.dataTransfer.files).map((file) => file.name);
      if (names.length) start(names);
      else toast.error("Nothing to import in that drop");
    },
    [start],
  );

  const onDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    // Ignore the crossings into child nodes; only a real exit clears the state.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragging(false);
  }, []);

  const finished = queue.filter((item) => item.state === "done").length;

  return (
    <div className={cn("flex flex-col gap-2", className)} data-testid="projects-upload">
      <div
        data-testid="projects-dropzone"
        data-dragging={dragging || undefined}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "surface-inset flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)]",
          "border border-dashed text-center transition-colors duration-150",
          compact ? "px-3 py-4" : "px-6 py-10",
          dragging
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground",
        )}
      >
        <UploadCloud className={cn(compact ? "size-5" : "size-7")} aria-hidden />
        <p className={cn("font-medium", compact ? "text-[11px]" : "text-xs")}>
          {dragging ? "Release to import" : "Drag a project folder here"}
        </p>
        {compact ? null : (
          <p className="max-w-64 text-[11px] leading-snug text-subtle-foreground">
            The folder is indexed locally — nothing is uploaded to a server.
          </p>
        )}
        <Button
          variant="outline"
          size={compact ? "xs" : "sm"}
          onClick={() => void openPicker()}
          data-testid="projects-dropzone-browse"
        >
          <FolderUp className="size-3.5" aria-hidden />
          Browse folders
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={onPicked}
          className="hidden"
          aria-hidden
          tabIndex={-1}
          data-testid="projects-dropzone-input"
        />
      </div>

      {queue.length ? (
        <div className="flex flex-col gap-1.5" data-testid="projects-upload-queue">
          <div className="flex items-center justify-between gap-2">
            <span className="label-mono">Import queue · {queue.length}</span>
            {finished ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={clearFinishedUploads}
                data-testid="projects-upload-clear"
              >
                <X className="size-3" aria-hidden />
                Clear done
              </Button>
            ) : null}
          </div>

          {queue.map((item) => (
            <div
              key={item.id}
              data-testid={`projects-upload-item-${item.id}`}
              data-state={item.state}
              className="flex flex-col gap-1 rounded-[var(--radius-sm)] bg-elevated px-2 py-1.5"
            >
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate text-foreground">{item.name}</span>
                {item.state === "done" ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden />
                ) : (
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                    {item.progress}%
                  </span>
                )}
              </div>
              <Progress
                value={item.progress}
                tone={item.state === "error" ? "error" : item.state === "done" ? "success" : "primary"}
                aria-label={`${item.name} import progress`}
              />
              {item.error ? <p className="text-[10px] text-error">{item.error}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
