const fs = require('fs');

const CHANNEL_ID = 'UCeTk2xcCHeBDntLPKn06L9g';

async function main() {
    const response = await fetch(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
    );

    const xml = await response.text();

    const title = xml.match(/<title>(.*?)<\/title>/s)?.[1] ?? '';
    const published = xml.match(/<published>(.*?)<\/published>/s)?.[1] ?? '';

    const thumbnail = xml.match(
        /<media:thumbnail[^>]*url="([^"]+)"/
    )?.[1] ?? '';

    const result = {
        updatedAt: new Date().toISOString(),
        title,
        published,
        thumbnail
    };

    fs.writeFileSync(
        'data/latest.json',
        JSON.stringify(result, null, 4)
    );
}

main();
