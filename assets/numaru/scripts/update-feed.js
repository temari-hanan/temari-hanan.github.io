const fs = require('fs');

const CHANNEL_ID = 'UCeTk2xcCHeBDntLPKn06L9g';
const STREAMS_PATH = 'assets/numaru/youtube_streams.json';
const DAY_OF_WEEK_JA = ['日', '月', '火', '水', '木', '金', '土'];

// youtube_streams.json に存在するタグのキーワード対応表
// （タイトルにいずれかが含まれればそのタグを採用）
const TAG_KEYWORDS = {
    'Biohazard':          ['BIOHAZARD', 'biohazard', 'バイオハザード'],
    'Bloodborne':         ['Bloodborne', 'bloodborne', 'ブラボ'],
    'CookingSimulator':   ['Cooking Simulator', 'cooking simulator', 'クッキングシミュレーター'],
    'Darekare':           ['ダレカレ'],
    'DarkSouls':          ['DARK SOULS', 'dark souls', 'ダークソウル'],
    'EldenRingNightreign':['ナイトレイン', 'NIGHTREIGN', 'nightreign'],
    'EldenRing':          ['エルデンリング', 'ELDEN RING', 'elden ring'],
    'GTA':                ['シティスト', 'グラセフ', 'GTA'],
    'GhostOfTsushima':    ['Ghost of Tsushima', 'ghost of tsushima', '対馬'],
    'GodOfWar':           ['GOD OF WAR', 'god of war', 'ゴッドオブウォー'],
    'HumanFallFlat':      ['ヒューマンホールフラット', 'Human Fall Flat'],
    'Kirby':              ['カービィ', 'Kirby', 'kirby'],
    'LostEgg':            ['LOST EGG', 'lost egg'],
    'Metaphor':           ['メタファー', 'Metaphor', 'metaphor'],
    'MonHan':             ['モンハン', 'モンスターハンター', 'MonHan'],
    'PapersPlease':       ['PAPERS PLEASE', 'papers please'],
    'Pokemon':            ['ポケモン', 'Pokemon', 'pokemon', 'Pokemon', 'アルセウス'],
    'Quiz':               ['常識', 'クイズ', 'Quiz', 'quiz'],
    'REPO':               ['R.E.P.O.', 'REPO', 'repo', 'レポ'],
    'RUST':               ['RUST', 'rust'],
    'Sekiro':             ['SEKIRO', 'sekiro', '隻狼'],
    'ShinYaMawari':       ['深夜廻'],
    'Splatoon':           ['スプラ', 'Splatoon', 'splatoon'],
    'SuperBunnyMan':      ['スーパーバニーマン', 'SuperBunnyMan'],
    'TheHunter':          ['theHunter', 'thehunter', 'TheHunter'],
    'TsuboOji':           ['壺おじ'],
    'YoMawari':           ['夜廻'],
    'Zelda':              ['ゼルダ', 'Zelda', 'zelda'],
    'freetalk':           ['雑談', 'freetalk', 'フリートーク', '作業'],
};

/**
 * タイトルをトークン列に分割する
 * - 英数字連続は小文字化してひとつのトークンに
 * - 日本語は1文字ずつ + 2文字のbigramも追加
 */
function tokenize(title) {
    const tokens = [];

    const enTokens = title.match(/[a-zA-Z0-9]+/g) ?? [];
    for (const t of enTokens) tokens.push(t.toLowerCase());

    const jaChars = [...title].filter(c => /[\u3040-\u9FFF]/.test(c));
    for (let i = 0; i < jaChars.length; i++) {
        tokens.push(jaChars[i]);
        if (i + 1 < jaChars.length) tokens.push(jaChars[i] + jaChars[i + 1]);
    }

    return tokens;
}

/**
 * TF-IDF用の辞書を構築する
 * 戻り値: {
 *   tagFreq: Map<tag, Map<token, count>>,
 *   docFreq: Map<token, number>
 * }
 */
function buildTagKeywords(streams) {
    const tagFreq = new Map();
    const docFreq = new Map();

    for (const entry of streams) {
        const tag = entry.tag;
        if (!tag) continue;

        if (!tagFreq.has(tag)) tagFreq.set(tag, new Map());

        const tokens = [...new Set(tokenize(entry.title))];
        const freq = tagFreq.get(tag);
        for (const token of tokens) {
            freq.set(token, (freq.get(token) ?? 0) + 1);
        }
    }

    for (const [, freq] of tagFreq) {
        for (const token of freq.keys()) {
            docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
        }
    }

    return { tagFreq, docFreq };
}

/**
 * タグを推定する
 * 1. TAG_KEYWORDS でキーワード直接マッチ
 * 2. ヒットしなければ TF-IDF スコアで最も近いタグを返す
 * 全タグでスコア0なら '' を返す
 */
function inferTag(title, { tagFreq, docFreq }) {
    // 1. キーワード直接マッチ
    for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
        for (const kw of keywords) {
            if (title.includes(kw)) return tag;
        }
    }

    // 2. TF-IDF フォールバック
    const titleTokens = tokenize(title);
    const numTags = tagFreq.size;
    let bestTag = '';
    let bestScore = 0;

    for (const [tag, freq] of tagFreq) {
        let score = 0;
        for (const token of titleTokens) {
            const tf = freq.get(token) ?? 0;
            if (tf === 0) continue;
            const df = docFreq.get(token) ?? 1;
            score += tf * (numTags / df);
        }
        if (score > bestScore) {
            bestScore = score;
            bestTag = tag;
        }
    }

    return bestTag;
}

async function updateStreams(latestVideos) {
    let streams = [];
    if (fs.existsSync(STREAMS_PATH)) {
        streams = JSON.parse(fs.readFileSync(STREAMS_PATH, 'utf8'));
    }

    const existingTitles = new Set(streams.map(s => s.title));
    const tagKeywords = buildTagKeywords(streams);

    const recentVideos = latestVideos.slice(0, 15);
    const newVideos = recentVideos.filter(v => !existingTitles.has(v.title));

    if (newVideos.length === 0) {
        console.log('streams: no new videos');
        return;
    }

    console.log(`streams: ${newVideos.length} new video(s) found`);

    for (const video of newVideos) {
        const tag = tagKeywords.tagFreq.size > 0
            ? inferTag(video.title, tagKeywords)
            : '';

        console.log(`  tag inferred: "${tag}" for "${video.title}"`);

        const publishedDate = new Date(video.published);
        const jstDate = new Date(publishedDate.getTime() + 9 * 60 * 60 * 1000);
        const dayOfTheWeek = DAY_OF_WEEK_JA[jstDate.getUTCDay()];

        streams.push({
            title: video.title,
            tag,
            scheduledStartTime: video.published,
            actualEndTime: video.published,
            publishedAt: video.published,
            dayOfTheWeek
        });
    }

    fs.writeFileSync(STREAMS_PATH, JSON.stringify(streams, null, 2), 'utf8');
    console.log(`streams: updated (total: ${streams.length})`);
}

async function main() {
    const response = await fetch(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const xml = await response.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];

    const videos = entries.map(match => {
        const entry = match[1];

        const videoId   = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] ?? '';
        const title     = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
        const published = entry.match(/<published>(.*?)<\/published>/)?.[1] ?? '';
        const updated   = entry.match(/<updated>(.*?)<\/updated>/)?.[1] ?? '';
        const thumbnail = entry.match(/<media:thumbnail[^>]*url="([^"]+)"/)?.[1] ?? '';
        const url       = videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';

        return { videoId, title, published, updated, thumbnail, url };
    });

    const result = {
        updatedAt: new Date().toISOString(),
        channelId: CHANNEL_ID,
        count: videos.length,
        videos
    };

    fs.mkdirSync('assets/numaru', { recursive: true });
    fs.writeFileSync('assets/numaru/latest.json', JSON.stringify(result, null, 4), 'utf8');

    console.log(`videos: ${videos.length}`);

    await updateStreams(videos);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
