"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Loader2, Play, CheckCircle2, XCircle, Clock,
  ArrowRight, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BatchDetail {
  batchIndex: number;
  startLine: number;
  endLine: number;
  linesCount: number;
  status: "queued" | "processing" | "complete" | "failed";
}

interface TranslationProgress {
  translationStatus: "processing" | "complete" | "cancelled" | "failed";
  totalBatches: number;
  completedBatches: number;
  currentBatch: number;
  batchDetails: BatchDetail[];
  movieTitle: string;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const router = useRouter();

  // Progress tracking state
  const [activeTranslationId, setActiveTranslationId] = useState<string | null>(null);
  const [progress, setProgress] = useState<TranslationProgress | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const startTranslation = async (sub: any) => {
    setTranslatingId(sub.id);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: sub.attributes.files?.[0]?.file_id,
          movieTitle: sub.attributes.release,
          imdbId: sub.attributes.imdb_id?.toString(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.id) {
        throw new Error(data.error || "Failed to start translation");
      }

      // If it already exists and is complete, go straight to editor
      if (data.status === "existing") {
        router.push(`/editor/${data.id}`);
        return;
      }

      // Open progress panel
      setActiveTranslationId(data.id);
      setProgress({
        translationStatus: "processing",
        totalBatches: data.totalBatches || 0,
        completedBatches: 0,
        currentBatch: 0,
        batchDetails: [],
        movieTitle: sub.attributes.release,
      });

    } catch (error: any) {
      console.error("Translation failed:", error);
      alert(error.message || "Something went wrong.");
    } finally {
      setTranslatingId(null);
    }
  };

  // Poll progress
  const pollProgress = useCallback(async () => {
    if (!activeTranslationId) return;
    try {
      const res = await fetch(`/api/translate/status/${activeTranslationId}`);
      const data: TranslationProgress = await res.json();
      setProgress(data);

      if (data.translationStatus === "complete") {
        // Auto-navigate to editor after a short delay
        setTimeout(() => {
          router.push(`/editor/${activeTranslationId}`);
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to poll:", error);
    }
  }, [activeTranslationId, router]);

  useEffect(() => {
    if (!activeTranslationId) return;
    const interval = setInterval(pollProgress, 2000);
    pollProgress(); // Immediate first poll
    return () => clearInterval(interval);
  }, [activeTranslationId, pollProgress]);

  const handleCancel = async () => {
    if (!activeTranslationId) return;
    try {
      await fetch(`/api/translate/status/${activeTranslationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      setActiveTranslationId(null);
      setProgress(null);
    } catch (error) {
      console.error("Failed to cancel:", error);
    }
  };

  const closeProgress = () => {
    setActiveTranslationId(null);
    setProgress(null);
  };

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <header className="mb-12 text-center">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-bold gradient-text mb-4"
        >
          Burmese Subtitle Wizard
        </motion.h1>
        <p className="text-slate-400 text-lg">
          Search, Auto-Translate, and Export Subtitles in Burmese.
        </p>
      </header>

      <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto mb-16">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter movie title..."
          className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 px-6 pl-14 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-lg glass"
        />
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" />
        <button
          disabled={loading}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-6 py-2 rounded-xl font-medium transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin size-5" /> : "Search"}
        </button>
      </form>

      {/* Main Content: Results + Progress Panel Side by Side */}
      <div className={`flex gap-6 ${activeTranslationId ? "" : ""}`}>
        {/* Search Results */}
        <div className={`${activeTranslationId ? "w-1/2" : "w-full"} transition-all duration-500`}>
          <div className={`grid ${activeTranslationId ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"} gap-4`}>
            <AnimatePresence>
              {results.map((sub, idx) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass p-5 hover:border-blue-500/50 transition-colors group cursor-pointer flex flex-col justify-between"
                  onClick={() => !activeTranslationId && startTranslation(sub)}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="bg-slate-800 text-xs text-slate-300 font-mono px-2 py-1 rounded">EN</span>
                      {sub.attributes.imdb_id && (
                        <span className="text-slate-500 text-xs">IMDb: {sub.attributes.imdb_id}</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm mb-2 line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors">
                      {sub.attributes.release}
                    </h3>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-slate-500 text-xs">{sub.attributes.language}</span>
                    <div className="flex items-center gap-2 text-blue-400 font-medium text-sm">
                      {translatingId === sub.id ? (
                        <><Loader2 className="animate-spin size-4" /><span>Starting...</span></>
                      ) : (
                        <><Play className="size-4" /><span>Translate</span></>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {!loading && query && results.length === 0 && (
            <div className="text-center text-slate-500 mt-12">
              No subtitles found. Try a different title.
            </div>
          )}
        </div>

        {/* Progress Panel (slides in from right) */}
        <AnimatePresence>
          {activeTranslationId && progress && (
            <motion.div
              initial={{ opacity: 0, x: 100, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "50%" }}
              exit={{ opacity: 0, x: 100, width: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex-shrink-0"
            >
              <div className="glass p-6 sticky top-8">
                {/* Panel Header */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-semibold text-lg gradient-text">Translating...</h2>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{progress.movieTitle}</p>
                  </div>
                  <button onClick={closeProgress} className="p-1 hover:bg-white/10 rounded-lg">
                    <X className="size-4 text-slate-400" />
                  </button>
                </div>

                {/* Progress Bar */}
                {(() => {
                  const pct = progress.totalBatches > 0
                    ? Math.round((progress.completedBatches / progress.totalBatches) * 100) : 0;
                  return (
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">
                          {progress.completedBatches}/{progress.totalBatches} batches
                        </span>
                        <span className="text-xs font-mono text-blue-400">{pct}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full"
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Batch List */}
                <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1 mb-5">
                  {progress.batchDetails.map((batch) => (
                    <div
                      key={batch.batchIndex}
                      className={`flex items-center justify-between py-2 px-3 rounded-lg text-xs transition-all ${batch.status === "processing"
                          ? "bg-blue-500/10 border border-blue-500/20"
                          : batch.status === "complete"
                            ? "bg-emerald-500/5 border border-emerald-500/10"
                            : batch.status === "failed"
                              ? "bg-red-500/5 border border-red-500/10"
                              : "bg-slate-900/20 border border-slate-800/30"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        {batch.status === "processing" && <Loader2 className="size-3 text-blue-400 animate-spin" />}
                        {batch.status === "complete" && <CheckCircle2 className="size-3 text-emerald-400" />}
                        {batch.status === "failed" && <XCircle className="size-3 text-red-400" />}
                        {batch.status === "queued" && <Clock className="size-3 text-slate-600" />}
                        <span className="text-slate-300">
                          Batch {batch.batchIndex + 1}
                        </span>
                        <span className="text-slate-600">
                          ({batch.startLine + 1}–{batch.endLine})
                        </span>
                      </div>
                      <span className={`font-medium ${batch.status === "processing" ? "text-blue-400"
                          : batch.status === "complete" ? "text-emerald-400"
                            : batch.status === "failed" ? "text-red-400"
                              : "text-slate-600"
                        }`}>
                        {batch.status === "processing" ? "Translating"
                          : batch.status === "complete" ? "Done"
                            : batch.status === "failed" ? "Failed"
                              : "Queued"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Status-based footer */}
                {progress.translationStatus === "complete" ? (
                  <motion.button
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    onClick={() => router.push(`/editor/${activeTranslationId}`)}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="size-4" />
                    Open Editor
                    <ArrowRight className="size-4" />
                  </motion.button>
                ) : progress.translationStatus === "cancelled" || progress.translationStatus === "failed" ? (
                  <button
                    onClick={closeProgress}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors"
                  >
                    Close
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={handleCancel}
                      className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
                    >
                      <XCircle className="size-4" />
                      Cancel
                    </button>
                    <motion.p
                      className="text-center text-[10px] text-slate-600"
                      animate={{ opacity: [0.3, 0.8, 0.3] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      Translating in the background...
                    </motion.p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
