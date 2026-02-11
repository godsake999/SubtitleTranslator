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
        const subtitle = await db.collection('subtitles').findOne({ _id: new ObjectId(id) });

        if (!subtitle) {
            return NextResponse.json({ error: 'Subtitle not found' }, { status: 404 });
        }

        return NextResponse.json(subtitle);
    } catch (error) {
        console.error('Fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch subtitle' }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const { lines } = await request.json();

    try {
        const client = await clientPromise;
        const db = client.db('subtitle_db');
        await db.collection('subtitles').updateOne(
            { _id: new ObjectId(id) },
            { $set: { lines, updatedAt: new Date() } }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update error:', error);
        return NextResponse.json({ error: 'Failed to update subtitle' }, { status: 500 });
    }
}
