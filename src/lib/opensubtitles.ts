export interface SubtitleMetadata {
    id: string;
    attributes: {
        release: string;
        language: string;
        url: string;
        files: Array<{
            file_id: number;
            file_name: string;
        }>;
    };
}

const OPENSUBTITLES_API_URL = "https://api.opensubtitles.com/api/v1";

export async function searchSubtitles(query: string) {
    const apiKey = process.env.OPENSUBTITLES_API_KEY;
    const userAgent = process.env.OPENSUBTITLES_USER_AGENT;

    if (!apiKey || !userAgent) {
        throw new Error("Missing OpenSubtitles API configuration");
    }

    const response = await fetch(`${OPENSUBTITLES_API_URL}/subtitles?query=${encodeURIComponent(query)}&languages=en`, {
        headers: {
            "Api-Key": apiKey,
            "User-Agent": userAgent,
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        const error = await response.json();
        console.error("OpenSubtitles API error:", error);
        throw new Error("Failed to fetch subtitles from OpenSubtitles");
    }

    const data = await response.json();
    return data.data as SubtitleMetadata[];
}

export async function downloadSubtitle(fileId: number) {
    const apiKey = process.env.OPENSUBTITLES_API_KEY;
    const userAgent = process.env.OPENSUBTITLES_USER_AGENT;

    const response = await fetch(`${OPENSUBTITLES_API_URL}/download`, {
        method: "POST",
        headers: {
            "Api-Key": apiKey,
            "User-Agent": userAgent,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ file_id: fileId }),
    });

    if (!response.ok) {
        throw new Error("Failed to get download link");
    }

    const data = await response.json();
    const downloadUrl = data.link;

    const srtResponse = await fetch(downloadUrl);
    return await srtResponse.text();
}
