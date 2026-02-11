"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft, Save, Download, Eye, EyeOff, CheckCircle2,
    Loader2, ChevronLeft, ChevronRight
} from "lucide-react";
import { motion } from "framer-motion";

interface SubtitleLine {
    id: number;
    timestamp: string;
    english: string;
    burmese: string;
}

const LINES_PER_PAGE = 50;

export default function Editor() {
    const params = useParams();
    const id = params?.id;
    const router = useRouter();

    const [movieTitle, setMovieTitle] = useState("");
    const [lines, setLines] = useState<SubtitleLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showOriginal, setShowOriginal] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(lines.length / LINES_PER_PAGE);
    const startIdx = (currentPage - 1) * LINES_PER_PAGE;
    const endIdx = startIdx + LINES_PER_PAGE;
    const currentLines = lines.slice(startIdx, endIdx);

    useEffect(() => {
        if (id) fetchSubtitle();
    }, [id]);

    const fetchSubtitle = async () => {
        try {
            const res = await fetch(`/api/subtitles/${id}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setMovieTitle(data.movieTitle);
            setLines(data.lines || []);
        } catch (error) {
            console.error("Failed to fetch subtitle:", error);
        } finally {
            setLoading(false);
        }
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

    const goToPage = (page: number) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Generate visible page numbers
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push("...");
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                pages.push(i);
            }
            if (currentPage < totalPages - 2) pages.push("...");
            pages.push(totalPages);
        }
        return pages;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin size-8 text-blue-500" />
            </div>
        );
    }

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

    return (
        <div className="min-h-screen bg-[#070709]">
            {/* Header */}
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
                                <span className="text-xs text-slate-600">•</span>
                                <span className="text-xs text-slate-500">Page {currentPage}/{totalPages}</span>
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
                            {showOriginal ? "Hide EN" : "Show EN"}
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

            {/* Subtitle Lines (current page only) */}
            <div className="max-w-5xl mx-auto p-6 space-y-3">
                {currentLines.map((line, index) => (
                    <motion.div
                        key={line.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.02, 0.5) }}
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
                                        English
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

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="sticky bottom-0 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800/50">
                    <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
                        <button
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="size-4" />
                            Previous
                        </button>

                        <div className="flex items-center gap-1">
                            {getPageNumbers().map((page, i) =>
                                typeof page === "string" ? (
                                    <span key={`dots-${i}`} className="px-2 text-slate-600 text-sm">…</span>
                                ) : (
                                    <button
                                        key={page}
                                        onClick={() => goToPage(page)}
                                        className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all ${currentPage === page
                                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                                : "bg-white/5 text-slate-400 hover:bg-white/10"
                                            }`}
                                    >
                                        {page}
                                    </button>
                                )
                            )}
                        </div>

                        <button
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                            <ChevronRight className="size-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
