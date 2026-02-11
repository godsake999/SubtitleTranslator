import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const client = await clientPromise;
        const db = client.db('subtitle_db');
        const doc = await db.collection('subtitles').findOne(
            { _id: new ObjectId(id) },
            {
                projection: {
                    translationStatus: 1,
                    totalBatches: 1,
                    completedBatches: 1,
                    currentBatch: 1,
                    batchDetails: 1,
                    movieTitle: 1,
                }
            }
        );

        if (!doc) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json({
            translationStatus: doc.translationStatus || 'complete', // legacy entries
            totalBatches: doc.totalBatches || 0,
            completedBatches: doc.completedBatches || 0,
            currentBatch: doc.currentBatch || 0,
            batchDetails: doc.batchDetails || [],
            movieTitle: doc.movieTitle,
        });
    } catch (error) {
        console.error('Status check error:', error);
        return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
    }
}

// POST to cancel translation
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { action } = await request.json();

    try {
        const client = await clientPromise;
        const db = client.db('subtitle_db');

        if (action === 'cancel') {
            await db.collection('subtitles').updateOne(
                { _id: new ObjectId(id) },
                { $set: { translationStatus: 'cancelled' } }
            );
            return NextResponse.json({ success: true, status: 'cancelled' });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Status action error:', error);
        return NextResponse.json({ error: 'Action failed' }, { status: 500 });
    }
}
