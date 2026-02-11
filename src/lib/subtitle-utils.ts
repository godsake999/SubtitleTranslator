import Parser from 'srt-parser-2';

export interface SubtitleLine {
    id: number;
    startTime: string;
    endTime: string;
    text: string;
}

export interface SubtitleData {
    id: number;
    timestamp: string;
    english: string;
    burmese: string;
}

const parser = new Parser();

export function srtToJson(srtContent: string): SubtitleData[] {
    const result = parser.fromSrt(srtContent);
    return result.map((item, index) => ({
        id: index + 1,
        timestamp: `${item.startTime} --> ${item.endTime}`,
        english: item.text,
        burmese: "", // To be filled by Gemini
    }));
}

export function jsonToSrt(lines: SubtitleData[]): string {
    const srtItems = lines.map(line => ({
        id: line.id.toString(),
        startTime: line.timestamp.split(" --> ")[0],
        endTime: line.timestamp.split(" --> ")[1],
        text: line.burmese || line.english,
        startSeconds: 0, // Not used by toSrt but required by type
        endSeconds: 0,   // Not used by toSrt but required by type
    }));
    return parser.toSrt(srtItems as any); // use any to bypass strict type check if needed, or add fields
}
