"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Download, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface SubtitleLine {
    id: number;
    timestamp: string;
    english: string;
    burmese: string;
}

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

    useEffect(() => {
        if (id) {
            fetchSubtitle();
        }
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
                <p className="text-slate-400">No subtitle lines found or failed to connect to database.</p>
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
                                <span className="text-xs text-slate-500">{(lines || []).length} lines</span>
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
                {(lines || []).map((line, index) => (
                    <motion.div
                        key={line.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.01 }}
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
                                <div className="text-slate-400 text-sm mb-3 pl-2 border-l-2 border-blue-500/30 animate-in fade-in slide-in-from-top-1 duration-300">
                                    {line.english}
                                </div>
                            )}

                            <input
                                type="text"
                                value={line.burmese}
                                onChange={(e) => handleLineChange(line.id, e.target.value)}
                                placeholder="Burmese translation..."
                                className="w-full bg-transparent border-none p-0 text-slate-100 placeholder:text-slate-700 focus:ring-0 text-lg Burmese"
                            />
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
