import { NextResponse } from 'next/server';
import { searchSubtitles } from '@/lib/opensubtitles';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json({ error: 'Missing search query' }, { status: 400 });
    }

    try {
        const results = await searchSubtitles(query);
        return NextResponse.json(results);
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json({ error: 'Failed to search subtitles' }, { status: 500 });
    }
}
