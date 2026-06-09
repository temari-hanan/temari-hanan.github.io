const fs = require('fs');

const CHANNEL_ID = 'UCeTk2xcCHeBDntLPKn06L9g';

async function main() {
    const response = await fetch(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
    );

    if(!response.ok){
        throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();

    const entries = [...xml.matchAll(
        /<entry>([\s\S]*?)<\/entry>/g
    )];

    const videos = entries.map(match => {
        const entry = match[1];

        const videoId = entry.match(
            /<yt:videoId>(.*?)<\/yt:videoId>/
        )?.[1] ?? '';

        const title = entry.match(
            /<title>([\s\S]*?)<\/title>/
        )?.[1] ?? '';

        const published = entry.match(
            /<published>(.*?)<\/published>/
        )?.[1] ?? '';

        const updated = entry.match(
            /<updated>(.*?)<\/updated>/
        )?.[1] ?? '';

        const thumbnail = entry.match(
            /<media:thumbnail[^>]*url="([^"]+)"/
        )?.[1] ?? '';

        const url = videoId
            ? `https://www.youtube.com/watch?v=${videoId}`
            : '';

        return {
            videoId,
            title,
            published,
            updated,
            thumbnail,
            url
        };
    });

    const result = {
        updatedAt: new Date().toISOString(),
        channelId: CHANNEL_ID,
        count: videos.length,
        videos
    };

    fs.mkdirSync('assets/numaru', {
        recursive: true
    });

    fs.writeFileSync(
        'assets/numaru/latest.json',
        JSON.stringify(result, null, 4),
        'utf8'
    );

    console.log(`videos: ${videos.length}`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});