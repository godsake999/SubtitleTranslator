import { NextResponse } from 'next/server';
import { jsonToSrt } from '@/lib/subtitle-utils';

export async function POST(request: Request) {
    const { lines, movieTitle } = await request.json();

    if (!lines || !movieTitle) {
        return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    try {
        const srtContent = jsonToSrt(lines);

        return new NextResponse(srtContent, {
            headers: {
                'Content-Type': 'text/plain',
                'Content-Disposition': `attachment; filename="${movieTitle}.srt"`,
            },
        });
    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json({ error: 'Failed to export SRT' }, { status: 500 });
    }
}
