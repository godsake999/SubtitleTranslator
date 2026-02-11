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

        // Check cache — if already fully translated, return it
        const existing = await collection.findOne({ movieTitle, imdbId });
        if (existing && existing.translationStatus === 'complete') {
            return NextResponse.json({ id: existing._id, status: 'existing' });
        }

        // If a previous attempt exists but was cancelled/failed, delete it
        if (existing) {
            await collection.deleteOne({ _id: existing._id });
        }

        // Fetch and Parse
        const srtContent = await downloadSubtitle(fileId);
        const lines = srtToJson(srtContent);

        // Calculate batch info
        const batchSize = 25;
        const maxAutoTranslate = 1000;
        const totalToTranslate = Math.min(lines.length, maxAutoTranslate);
        const totalBatches = Math.ceil(totalToTranslate / batchSize);

        // Build batch details
        const batchDetails = Array.from({ length: totalBatches }, (_, i) => ({
            batchIndex: i,
            startLine: i * batchSize,
            endLine: Math.min((i + 1) * batchSize, totalToTranslate),
            linesCount: Math.min(batchSize, totalToTranslate - i * batchSize),
            status: 'queued' as string, // queued | processing | complete | failed
        }));

        // Insert with progress tracking
        const initialResult = await collection.insertOne({
            movieTitle,
            imdbId,
            lines,
            translationStatus: 'processing', // processing | complete | cancelled | failed
            totalBatches,
            completedBatches: 0,
            currentBatch: 0,
            batchDetails,
            createdAt: new Date(),
        });
        const subtitleId = initialResult.insertedId;

        // Start translation in background (Non-blocking)
        const translatedLines = [...lines];

        (async () => {
            console.log(`[Background] Starting translation for ${movieTitle} (${totalBatches} batches)...`);

            for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
                // Check if cancelled
                const doc = await collection.findOne({ _id: subtitleId });
                if (!doc || doc.translationStatus === 'cancelled') {
                    console.log(`[Background] Translation cancelled for ${movieTitle}`);
                    return;
                }

                const startLine = batchIdx * batchSize;
                const batch = lines.slice(startLine, startLine + batchSize);
                const englishTexts = batch.map(b => b.english);

                // Mark this batch as processing
                batchDetails[batchIdx].status = 'processing';
                await collection.updateOne(
                    { _id: subtitleId },
                    { $set: { currentBatch: batchIdx, batchDetails } }
                );

                try {
                    const translations = await translateToBurmese(englishTexts);
                    for (let j = 0; j < translations.length; j++) {
                        if (translatedLines[startLine + j]) {
                            translatedLines[startLine + j].burmese = translations[j];
                        }
                    }

                    // Mark batch as complete
                    batchDetails[batchIdx].status = 'complete';
                    await collection.updateOne(
                        { _id: subtitleId },
                        {
                            $set: {
                                lines: translatedLines,
                                completedBatches: batchIdx + 1,
                                batchDetails,
                            }
                        }
                    );
                    console.log(`[Background] Batch ${batchIdx + 1}/${totalBatches} complete for ${movieTitle}`);
                } catch (err) {
                    batchDetails[batchIdx].status = 'failed';
                    await collection.updateOne(
                        { _id: subtitleId },
                        { $set: { batchDetails } }
                    );
                    console.error(`[Background] Batch ${batchIdx} failed for ${movieTitle}:`, err);
                }
            }

            // Mark translation as complete
            await collection.updateOne(
                { _id: subtitleId },
                { $set: { translationStatus: 'complete' } }
            );
            console.log(`[Background] Completed all translation for ${movieTitle}`);
        })().catch(async (err) => {
            console.error("Background task error:", err);
            await collection.updateOne(
                { _id: subtitleId },
                { $set: { translationStatus: 'failed' } }
            );
        });

        return NextResponse.json({
            id: subtitleId,
            status: 'new',
            totalBatches,
            totalLines: lines.length,
        });
    } catch (error) {
        console.error('Translation process error:', error);
        return NextResponse.json({ error: 'Failed to process translation' }, { status: 500 });
    }
}
