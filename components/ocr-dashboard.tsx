"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import * as XLSX from "xlsx";

type TableData = { columns: string[]; rows: string[][] };

const ACCEPT = "image/png,image/jpeg,image/jpg";

function isAllowedImage(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === "image/png" || t === "image/jpeg" || t === "image/jpg") return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg");
}

function safeExcelBasename(source: string | undefined): string {
  const raw = (source ?? "ocr-table").replace(/\.[^.]+$/, "") || "ocr-table";
  return raw.replace(/[<>:"/\\|?*]/g, "_").slice(0, 120);
}

function downloadTableAsExcel(data: TableData, imageFileName: string | undefined) {
  const aoa = [data.columns, ...data.rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const name = `${safeExcelBasename(imageFileName)}-table.xlsx`;
  XLSX.writeFile(wb, name);
}

export function OcrDashboard() {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [table, setTable] = useState<TableData | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [editing, setEditing] = useState<{ kind: "h" | "c"; row: number; col: number } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const revokePreview = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  useEffect(() => {
    return () => revokePreview();
  }, [revokePreview]);

  const applyFile = useCallback(
    (next: File) => {
      if (!isAllowedImage(next)) {
        setError("Please use a PNG or JPG image.");
        return;
      }
      setError(null);
      setTable(null);
      setFile(next);
      revokePreview();
      const url = URL.createObjectURL(next);
      setPreviewUrl(url);
    },
    [revokePreview]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) applyFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) applyFile(f);
  };

  const extractOcr = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      // FastAPI expects the uploaded file field name to be `file`.
      fd.append("file", file);
      const apiBaseUrl = (
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"
      ).replace(/\/$/, "");
      const url = `${apiBaseUrl}/api/ocr`;
      console.log("Target URL:", url);
      const res = await fetch(url, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Extraction failed.");
        return;
      }
      setTable({
        columns: data.columns as string[],
        rows: data.rows as string[][],
      });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateHeader = (col: number, value: string) => {
    setTable((t) => {
      if (!t) return t;
      const columns = [...t.columns];
      columns[col] = value;
      return { ...t, columns };
    });
  };

  const updateCell = (row: number, col: number, value: string) => {
    setTable((t) => {
      if (!t) return t;
      const rows = t.rows.map((r) => [...r]);
      if (!rows[row]) return t;
      rows[row][col] = value;
      return { ...t, rows };
    });
  };

  const addRow = () => {
    setTable((t) => {
      if (!t) return t;
      const n = t.columns.length;
      return {
        ...t,
        rows: [...t.rows, Array.from({ length: n }, () => "")],
      };
    });
  };

  const deleteRow = (row: number) => {
    setTable((t) => {
      if (!t || t.rows.length <= 1) return t;
      const rows = t.rows.filter((_, i) => i !== row);
      return { ...t, rows };
    });
  };

  const addColumn = () => {
    setTable((t) => {
      if (!t) return t;
      const idx = t.columns.length + 1;
      return {
        columns: [...t.columns, `Column ${idx}`],
        rows: t.rows.map((r) => [...r, ""]),
      };
    });
  };

  const deleteColumn = (col: number) => {
    setTable((t) => {
      if (!t || t.columns.length <= 1) return t;
      return {
        columns: t.columns.filter((_, i) => i !== col),
        rows: t.rows.map((r) => r.filter((_, i) => i !== col)),
      };
    });
  };

  const clearImage = () => {
    setFile(null);
    revokePreview();
    setTable(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="glass-panel px-6 py-8 sm:px-10">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300/90">
          Vision OCR
        </p>
        <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Table extraction studio
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Drop a PNG or JPG, preview it, then run Gemini 2.5 Flash OCR. Edit any cell, or reshape
          the grid with add/remove rows and columns.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload PNG or JPG image"
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragActive(false);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={onDrop}
            className={[
              "glass-panel group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-12 transition-colors",
              dragActive
                ? "border-indigo-400/60 bg-indigo-500/10"
                : "border-white/15 hover:border-white/25 hover:bg-white/[0.04]",
            ].join(" ")}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              id={inputId}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={onInputChange}
            />
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/30 to-sky-500/20 ring-1 ring-white/10">
              <svg
                className="h-7 w-7 text-indigo-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-200">Drop image here or browse</p>
              <p className="mt-1 text-xs text-slate-500">PNG and JPG only</p>
            </div>
          </div>

          {previewUrl && file && (
            <div className="glass-panel overflow-hidden p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Preview
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      extractOcr();
                    }}
                    disabled={loading}
                    className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Extracting…" : "Extract table"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearImage();
                    }}
                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
                <Image
                  src={previewUrl}
                  alt="Uploaded preview"
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  unoptimized
                />
                {loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/75 backdrop-blur-sm">
                    <div
                      className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-400"
                      aria-hidden
                    />
                    <p className="text-sm font-medium text-indigo-200">Running OCR…</p>
                  </div>
                )}
              </div>
              <p className="mt-2 truncate text-xs text-slate-500" title={file.name}>
                {file.name}
              </p>
            </div>
          )}
        </div>

        <div className="glass-panel flex min-h-[320px] flex-col p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-mono text-lg font-semibold text-white">Extracted data</h2>
              <p className="text-xs text-slate-500">Click a cell to edit. Use toolbar to add or remove.</p>
            </div>
            {table && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadTableAsExcel(table, file?.name)}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25"
                >
                  Download as Excel
                </button>
                <button
                  type="button"
                  onClick={addRow}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
                >
                  + Row
                </button>
                <button
                  type="button"
                  onClick={addColumn}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
                >
                  + Column
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          {!table && !loading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center text-slate-500">
              <p className="text-sm">Upload an image and run extraction to populate the table.</p>
            </div>
          )}

          {table && (
            <div className="flex-1 overflow-auto rounded-xl ring-1 ring-white/10">
              <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-white/[0.04]">
                    {table.columns.map((h, col) => (
                      <th
                        key={col}
                        className="group relative border-b border-white/10 px-2 py-3 text-left font-mono text-xs font-semibold uppercase tracking-wide text-indigo-200/95"
                      >
                        <div className="flex items-start gap-1">
                          <span className="min-w-0 flex-1">
                            {editing?.kind === "h" && editing.col === col ? (
                              <input
                                autoFocus
                                className="w-full min-w-[4rem] rounded border border-indigo-400/40 bg-slate-950/80 px-2 py-1 text-xs font-normal normal-case tracking-normal text-white outline-none ring-1 ring-indigo-500/30"
                                defaultValue={h}
                                onBlur={(e) => {
                                  updateHeader(col, e.target.value);
                                  setEditing(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  if (e.key === "Escape") setEditing(null);
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                className="w-full rounded px-1 text-left hover:bg-white/5"
                                onClick={() => setEditing({ kind: "h", row: 0, col })}
                              >
                                {h || "—"}
                              </button>
                            )}
                          </span>
                          {table.columns.length > 1 && (
                            <button
                              type="button"
                              title="Delete column"
                              className="shrink-0 rounded p-1 text-slate-500 opacity-0 transition hover:bg-rose-500/20 hover:text-rose-300 group-hover:opacity-100"
                              onClick={() => deleteColumn(col)}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th
                      className="w-12 border-b border-white/10 bg-white/[0.04] px-1 py-3 text-center text-[10px] font-normal uppercase tracking-wider text-slate-500"
                      scope="col"
                    >
                      Row
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-white/[0.06] hover:bg-white/[0.02]">
                      {row.map((cell, ci) => (
                        <td key={ci} className="max-w-[200px] px-2 py-2 align-top text-slate-200">
                          {editing?.kind === "c" && editing.row === ri && editing.col === ci ? (
                            <textarea
                              autoFocus
                              rows={2}
                              className="w-full resize-y rounded border border-sky-400/40 bg-slate-950/90 px-2 py-1.5 text-xs text-white outline-none ring-1 ring-sky-500/30"
                              defaultValue={cell}
                              onBlur={(e) => {
                                updateCell(ri, ci, e.target.value);
                                setEditing(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") setEditing(null);
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  (e.target as HTMLTextAreaElement).blur();
                                }
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              className="w-full rounded px-1 py-0.5 text-left text-xs leading-relaxed hover:bg-white/5 sm:text-sm"
                              onClick={() => setEditing({ kind: "c", row: ri, col: ci })}
                            >
                              {cell || <span className="text-slate-600">Empty</span>}
                            </button>
                          )}
                        </td>
                      ))}
                      <td className="w-10 px-1 align-middle">
                        {table.rows.length > 1 && (
                          <button
                            type="button"
                            title="Delete row"
                            className="rounded p-1.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300"
                            onClick={() => deleteRow(ri)}
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
