"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft, Save, Download, Eye, EyeOff, CheckCircle2,
    Loader2, XCircle, Clock, RotateCcw, Circle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SubtitleLine {
    id: number;
    timestamp: string;
    english: string;
    burmese: string;
}

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

export default function Editor() {
    const params = useParams();
    const id = params?.id;
    const router = useRouter();

    // Editor state
    const [movieTitle, setMovieTitle] = useState("");
    const [lines, setLines] = useState<SubtitleLine[]>([]);
    const [saving, setSaving] = useState(false);
    const [showOriginal, setShowOriginal] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Progress state
    const [progress, setProgress] = useState<TranslationProgress | null>(null);
    const [isTranslating, setIsTranslating] = useState(true);
    const [initialLoading, setInitialLoading] = useState(true);

    // Poll for translation progress
    const pollProgress = useCallback(async () => {
        if (!id) return;
        try {
            const res = await fetch(`/api/translate/status/${id}`);
            const data: TranslationProgress = await res.json();
            setProgress(data);
            setMovieTitle(data.movieTitle);

            if (data.translationStatus === "complete" || !data.translationStatus) {
                // Translation done — load the full subtitle data
                setIsTranslating(false);
                const subRes = await fetch(`/api/subtitles/${id}`);
                const subData = await subRes.json();
                setLines(subData.lines || []);
                setInitialLoading(false);
            } else if (data.translationStatus === "cancelled" || data.translationStatus === "failed") {
                setIsTranslating(false);
                setInitialLoading(false);
            } else {
                setInitialLoading(false);
            }
        } catch (error) {
            console.error("Failed to poll progress:", error);
            setInitialLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (!id) return;
        pollProgress(); // Initial poll

        const interval = setInterval(() => {
            if (isTranslating) {
                pollProgress();
            }
        }, 2000); // Poll every 2 seconds

        return () => clearInterval(interval);
    }, [id, isTranslating, pollProgress]);

    const handleCancel = async () => {
        if (!id) return;
        try {
            await fetch(`/api/translate/status/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "cancel" }),
            });
            setIsTranslating(false);
            if (progress) {
                setProgress({ ...progress, translationStatus: "cancelled" });
            }
        } catch (error) {
            console.error("Failed to cancel:", error);
        }
    };

    const handleRetry = () => {
        router.push("/");
    };

    const handleLineChange = (lineId: number, value: string) => {
        setLines(prev => prev.map(l => l.id === lineId ? { ...l, burmese: value } : l));
    };

    const handleSave = async () => {
        if (!id) return;
        setSaving(true);
        try {
            await fetch(`/api/subtitles/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lines }),
            });
            setLastSaved(new Date());
        } catch (error) {
            console.error("Failed to save:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async () => {
        try {
            const res = await fetch("/api/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lines, movieTitle }),
            });
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${movieTitle}_MM.srt`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (error) {
            console.error("Export failed:", error);
        }
    };

    // === LOADING SCREEN ===
    if (initialLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin size-8 text-blue-500" />
            </div>
        );
    }

    // === PROGRESS TRACKER SCREEN ===
    if (isTranslating && progress) {
        const percentComplete = progress.totalBatches > 0
            ? Math.round((progress.completedBatches / progress.totalBatches) * 100)
            : 0;

        return (
            <div className="min-h-screen bg-[#070709]">
                <div className="max-w-2xl mx-auto px-6 py-12">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <button
                            onClick={() => router.push("/")}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="size-5" />
                        </button>
                        <div>
                            <h1 className="font-semibold text-xl gradient-text">
                                Translating to Burmese
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">{movieTitle}</p>
                        </div>
                    </div>

                    {/* Overall Progress Bar */}
                    <div className="glass p-6 mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-slate-300">
                                Overall Progress
                            </span>
                            <span className="text-sm font-mono text-blue-400">
                                {percentComplete}%
                            </span>
                        </div>
                        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${percentComplete}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            {progress.completedBatches} of {progress.totalBatches} batches completed
                        </p>
                    </div>

                    {/* Batch List */}
                    <div className="glass p-6 mb-6">
                        <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">
                            Translation Batches
                        </h2>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                            <AnimatePresence>
                                {progress.batchDetails.map((batch) => (
                                    <motion.div
                                        key={batch.batchIndex}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: batch.batchIndex * 0.03 }}
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${batch.status === "processing"
                                                ? "bg-blue-500/10 border-blue-500/30"
                                                : batch.status === "complete"
                                                    ? "bg-emerald-500/5 border-emerald-500/20"
                                                    : batch.status === "failed"
                                                        ? "bg-red-500/5 border-red-500/20"
                                                        : "bg-slate-900/30 border-slate-800/40"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Status Icon */}
                                            {batch.status === "processing" && (
                                                <Loader2 className="size-4 text-blue-400 animate-spin" />
                                            )}
                                            {batch.status === "complete" && (
                                                <CheckCircle2 className="size-4 text-emerald-400" />
                                            )}
                                            {batch.status === "failed" && (
                                                <XCircle className="size-4 text-red-400" />
                                            )}
                                            {batch.status === "queued" && (
                                                <Clock className="size-4 text-slate-600" />
                                            )}

                                            <div>
                                                <span className="text-sm font-medium text-slate-200">
                                                    Batch {batch.batchIndex + 1}
                                                </span>
                                                <span className="text-xs text-slate-500 ml-2">
                                                    Lines {batch.startLine + 1}–{batch.endLine}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Status Label */}
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${batch.status === "processing"
                                                ? "text-blue-400 bg-blue-500/20"
                                                : batch.status === "complete"
                                                    ? "text-emerald-400 bg-emerald-500/20"
                                                    : batch.status === "failed"
                                                        ? "text-red-400 bg-red-500/20"
                                                        : "text-slate-500 bg-slate-800"
                                            }`}>
                                            {batch.status === "processing" ? "Translating..."
                                                : batch.status === "complete" ? "Done"
                                                    : batch.status === "failed" ? "Failed"
                                                        : "Queued"}
                                        </span>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleCancel}
                            className="flex-1 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
                        >
                            <XCircle className="size-4" />
                            Cancel Translation
                        </button>
                    </div>

                    {/* Animated Tip */}
                    <motion.p
                        className="text-center text-xs text-slate-600 mt-6"
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 3, repeat: Infinity }}
                    >
                        Translation is running in the background. Please don&apos;t close this page.
                    </motion.p>
                </div>
            </div>
        );
    }

    // === CANCELLED / FAILED STATE ===
    if (progress && (progress.translationStatus === "cancelled" || progress.translationStatus === "failed")) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-6">
                <div className="text-center">
                    <XCircle className="size-12 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-200 mb-2">
                        Translation {progress.translationStatus === "cancelled" ? "Cancelled" : "Failed"}
                    </h2>
                    <p className="text-sm text-slate-500">
                        {progress.completedBatches} of {progress.totalBatches} batches were completed.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleRetry}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                        <RotateCcw className="size-4" />
                        Try Again
                    </button>
                    <button
                        onClick={() => router.push("/")}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    // === NO LINES FALLBACK ===
    if (!lines || lines.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <p className="text-slate-400">No subtitle lines found.</p>
                <button
                    onClick={() => router.push("/")}
                    className="px-6 py-2 bg-blue-600 rounded-xl hover:bg-blue-500"
                >
                    Go Back Home
                </button>
            </div>
        );
    }

    // === EDITOR VIEW ===
    return (
        <div className="min-h-screen bg-[#070709]">
            <div className="sticky top-0 z-50 glass rounded-none border-x-0 border-t-0 bg-slate-900/80 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push("/")}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="size-5" />
                        </button>
                        <div>
                            <h1 className="font-semibold text-lg line-clamp-1">{movieTitle || "Untitled Movie"}</h1>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">{lines.length} lines</span>
                                {lastSaved && (
                                    <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                                        <CheckCircle2 className="size-3" />
                                        Saved {lastSaved.toLocaleTimeString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowOriginal(!showOriginal)}
                            className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${showOriginal ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-slate-400"
                                }`}
                        >
                            {showOriginal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            {showOriginal ? "Hide English" : "Show English"}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="animate-spin size-4" /> : <Save className="size-4" />}
                            Save
                        </button>
                        <button
                            onClick={handleExport}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                            <Download className="size-4" />
                            Export SRT
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-6 space-y-4">
                {lines.map((line, index) => (
                    <motion.div
                        key={line.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(index * 0.01, 2) }}
                        className="group relative"
                    >
                        <div className="absolute -left-12 top-4 text-[10px] font-mono text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            {line.id}
                        </div>
                        <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4 transition-all hover:bg-slate-900/60 focus-within:ring-1 focus-within:ring-blue-500/30">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800">
                                    {line.timestamp}
                                </span>
                                {showOriginal && (
                                    <span className="text-[10px] font-medium text-blue-500/70 uppercase tracking-wider">
                                        English Reference
                                    </span>
                                )}
                            </div>

                            {showOriginal && (
                                <div className="text-slate-400 text-sm mb-3 pl-2 border-l-2 border-blue-500/30">
                                    {line.english}
                                </div>
                            )}

                            <input
                                type="text"
                                value={line.burmese}
                                onChange={(e) => handleLineChange(line.id, e.target.value)}
                                placeholder="Burmese translation..."
                                className="w-full bg-transparent border-none p-0 text-slate-100 placeholder:text-slate-700 focus:ring-0 text-lg"
                            />
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
