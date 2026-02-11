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

        // Initial Database Entry (without translation yet)
        const initialResult = await collection.insertOne({
            movieTitle,
            imdbId,
            lines,
            createdAt: new Date(),
        });
        const subtitleId = initialResult.insertedId;

        // Batch translation in background
        const batchSize = 100;
        const translatedLines = [...lines];
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

                // Update DB after each successful batch to show progress
                await collection.updateOne(
                    { _id: subtitleId },
                    { $set: { lines: translatedLines } }
                );
                console.log(`Updated DB with batch ${i}`);
            } catch (err) {
                console.error(`Batch ${i} failed, skipping...`, err);
            }
        }

        return NextResponse.json({ id: subtitleId, status: 'new' });
    } catch (error) {
        console.error('Translation process error:', error);
        return NextResponse.json({ error: 'Failed to process translation' }, { status: 500 });
    }
}
