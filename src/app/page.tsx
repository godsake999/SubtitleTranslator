"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Play, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const router = useRouter();

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

      router.push(`/editor/${data.id}`);
    } catch (error: any) {
      console.error("Translation failed:", error);
      alert(error.message || "Something went wrong. Please check your MongoDB connection or API keys.");
      setTranslatingId(null);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {results.map((sub, idx) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="glass p-6 hover:border-blue-500/50 transition-colors group cursor-pointer h-full flex flex-col justify-between"
              onClick={() => startTranslation(sub)}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-slate-800 text-xs text-slate-300 font-mono px-2 py-1 rounded">
                    EN
                  </span>
                  {sub.attributes.imdb_id && (
                    <span className="text-slate-500 text-xs">
                      IMDb: {sub.attributes.imdb_id}
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-lg mb-2 line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors">
                  {sub.attributes.release}
                </h3>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-slate-500 text-sm">
                  {sub.attributes.language}
                </span>
                <div className="flex items-center gap-2 text-blue-400 font-medium">
                  {translatingId === sub.id ? (
                    <>
                      <Loader2 className="animate-spin size-4" />
                      <span>Translating...</span>
                    </>
                  ) : (
                    <>
                      <Play className="size-4" />
                      <span>Translate</span>
                    </>
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
    </main>
  );
}
