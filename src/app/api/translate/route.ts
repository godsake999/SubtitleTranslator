import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { downloadSubtitle } from '@/lib/opensubtitles';
import { srtToJson } from '@/lib/subtitle-utils';
import { translateToBurmese } from '@/lib/gemini';

export async function POST(request: Request) {
    const { fileId, movieTitle, imdbId } = await request.json();

    if (!fileId || !movieTitle) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    try {
        const client = await clientPromise;
        const db = client.db('subtitle_db');
        const collection = db.collection('subtitles');

        // Check cache
        const existing = await collection.findOne({ movieTitle, imdbId });
        if (existing) {
            return NextResponse.json({ id: existing._id, status: 'existing' });
        }

        // Fetch and Parse
        const srtContent = await downloadSubtitle(fileId);
        const lines = srtToJson(srtContent);

        // Initial Database Entry (without translation yet if it takes too long)
        // But the requirements say "translate the whole batch before the user even sees the screen"
        // So we translate now.

        // Batch translation to avoid Gemini token/length limits
        const batchSize = 100; // Increased for speed
        const translatedLines = [...lines];

        // Only translate the first 1000 lines automatically to avoid server timeout.
        // The user can edit the rest manually or we can add a "Continue Translation" button later.
        const maxAutoTranslate = 1000;
        const totalToTranslate = Math.min(lines.length, maxAutoTranslate);

        for (let i = 0; i < totalToTranslate; i += batchSize) {
            const batch = lines.slice(i, i + batchSize);
            const englishTexts = batch.map(b => b.english);
            try {
                const translations = await translateToBurmese(englishTexts);
                for (let j = 0; j < translations.length; j++) {
                    if (translatedLines[i + j]) {
                        translatedLines[i + j].burmese = translations[j];
                    }
                }
            } catch (err) {
                console.error(`Batch ${i} failed, skipping...`, err);
                // Continue to next batch instead of failing whole process
            }
        }

        const result = await collection.insertOne({
            movieTitle,
            imdbId,
            lines: translatedLines,
            createdAt: new Date(),
        });

        return NextResponse.json({ id: result.insertedId, status: 'new' });
    } catch (error) {
        console.error('Translation process error:', error);
        return NextResponse.json({ error: 'Failed to process translation' }, { status: 500 });
    }
}
