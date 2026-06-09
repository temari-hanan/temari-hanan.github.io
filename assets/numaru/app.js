// ────────────────────────────────────────────────
//  環境設定
// ────────────────────────────────────────────────
// 'local' の場合はダミーデータを、それ以外（'master'など）の場合はJSONをfetchします
// const ENV = 'local';
const ENV = 'prd';
const isLocal = (ENV === 'local');

const STREAM_DATA_URL = 'assets/numaru/youtube_streams.json';
const LATEST_DATA_URL = 'assets/numaru/latest.json';

// ────────────────────────────────────────────────
//  ローカル用ダミーデータ
// ────────────────────────────────────────────────
const LOCAL_STREAMS = [
    {
        title: '【SEKIRO】さあ、あなたもSEKIRO沼へ',
        tag: 'Sekiro',
        scheduledStartTime: '2021-12-02T04:32:59Z',
        actualEndTime: '2021-12-02T07:16:36Z',
        publishedAt: '2021-12-02T07:32:27Z',
        dayOfTheWeek: '木'
    },
];

const LOCAL_LATEST = {
    "updatedAt": "2026-06-09T12:30:55.600Z",
    "channelId": "UCeTk2xcCHeBDntLPKn06L9g",
    "count": 15,
    "videos": [
        {
            "videoId": "8114JMW9B-k",
            "title": "【  メタファー #3  】神ゲーと噂のRPGやってみる！3 ※ネタバレ注意",
            "published": "2026-06-04T09:20:10+00:00",
            "updated": "2026-06-04T11:56:14+00:00",
            "thumbnail": "https://i1.ytimg.com/vi/8114JMW9B-k/hqdefault.jpg",
            "url": "https://www.youtube.com/watch?v=8114JMW9B-k"
        },
        {
            "videoId": "PAIKOwPfmY4",
            "title": "【  メタファー #2  】神ゲーと噂のRPGやってみる！2 ※ネタバレ注意",
            "published": "2026-06-03T17:07:04+00:00",
            "updated": "2026-06-04T11:35:22+00:00",
            "thumbnail": "https://i1.ytimg.com/vi/PAIKOwPfmY4/hqdefault.jpg",
            "url": "https://www.youtube.com/watch?v=PAIKOwPfmY4"
        },
        {
            "videoId": "KHK1fX9gczQ",
            "title": "【  メタファー  】神ゲーと噂のRPGやってみる！※ネタバレ注意",
            "published": "2026-06-01T19:11:59+00:00",
            "updated": "2026-06-02T10:02:19+00:00",
            "thumbnail": "https://i4.ytimg.com/vi/KHK1fX9gczQ/hqdefault.jpg",
            "url": "https://www.youtube.com/watch?v=KHK1fX9gczQ"
        }
    ]
};

// ────────────────────────────────────────────────
//  定数・設定
// ────────────────────────────────────────────────

// 曜日インデックス（Date#getDay と対応）
const DAY_INDEX = { '日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6 };

/**
 * 配信確率の閾値ごとの絵文字・メッセージ対応表
 * ※ threshold 以上のとき適用。降順で定義すること。
 * threshold の数値をここだけ変えれば挙動が変わります。
 */
const FORECAST_TABLE = [
    //  threshold  icon（天気絵文字）     message（{day} は曜日名に置換）
    { threshold: 80, icon: '\u26C8',  message: '{day}曜日は過去の傾向から配信が期待できます！' },
    { threshold: 50, icon: '\u2601\uFE0F', message: '{day}曜日は配信があるかも。チェックしてみて！' },
    { threshold: 20, icon: '\u{1F326}\uFE0F', message: '{day}曜日は配信はあまり多くない傾向です。' },
    { threshold:  0, icon: '\u{1F327}\uFE0F', message: '{day}曜日は配信が少ない曜日です。' },
];

/**
 * スコア加算の重み設定
 * 数値をここだけ変えれば全体のバランスを調整できます。
 *
 * ① 過去実績（①-a〜c は排他。最も条件が厳しい1つだけ加算）
 *   ①-a 同曜日かつ同日付 > ①-b 同曜日のみ > ①-c 同日付のみ
 * ② 連続配信（①と独立して加算）
 * ③ 減点
 */
const SCORE_WEIGHTS = {
    sameDayAndDate:    50,  // ①-a 同曜日かつ同日付（月/日）の配信が過去にある ← 最優先
    sameDayOfWeek:     35,  // ①-b 同曜日に配信が多い（週ごとの出現率で比例加算）
    sameDateOfMonth:   20,  // ①-c 同日付（月/日）の配信が過去にある
    consecutiveHype:   25,  // ②-a 連続配信中かつ対象ゲームをプレイ中
    consecutive:       15,  // ②-b 連続配信中（ゲーム不問）
    menstrualPenalty: -15,  // ③   生理と思われる日（24・25日）
};

/** ①-d で対象とするゲームキーワード（タイトル or タグに部分一致） */
const HYPE_GAMES = ['スプラ', 'モンハン', 'エルデン', 'ナイトレイン', 'フロム'];

/** ②-で生理と仮定している日付 */
const MENSTRUAL_DATES = [24, 25];

// ────────────────────────────────────────────────
//  JST ユーティリティ
// ────────────────────────────────────────────────

/**
 * UTC の ISO 文字列を JST の { year, month, day, dayOfWeek } オブジェクトに変換する
 * month は 1-indexed
 */
function toJST(isoString) {
    const date = new Date(isoString);
    // JST = UTC+9
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return {
        year:       jst.getUTCFullYear(),
        month:      jst.getUTCMonth() + 1,
        day:        jst.getUTCDate(),
        dayOfWeek:  jst.getUTCDay(),   // 0=日 〜 6=土
    };
}

/** 現在の JST 日付を { year, month, day, dayOfWeek } で返す */
function nowJST() {
    return toJST(new Date().toISOString());
}

/** 「月/日」文字列を返す（比較キー用） */
function mmdd({ month, day }) {
    return `${month}-${day}`;
}

// ────────────────────────────────────────────────
//  エントリポイント
// ────────────────────────────────────────────────
$(async () => {
    try {
        let streams, latest;

        if (ENV === 'local') {
            streams = LOCAL_STREAMS;
            latest  = LOCAL_LATEST;
            console.log('ローカルデータで実行中');
        } else {
            const [fetchedStreams, fetchedLatest] = await Promise.all([
                fetchJSON(STREAM_DATA_URL),
                fetchJSON(LATEST_DATA_URL),
            ]);
            streams = fetchedStreams;
            latest  = fetchedLatest;
        }

        renderForecast(streams, latest);
        renderHistory(latest.videos);
    } catch (err) {
        console.error('データの取得または描画に失敗しました:', err);
    }
});

// ────────────────────────────────────────────────
//  データ取得
// ────────────────────────────────────────────────
async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return res.json();
}

// ────────────────────────────────────────────────
//  予報ロジック（加点方式）
// ────────────────────────────────────────────────

/**
 * streams 配列を前処理して、各種ルックアップ用セットを返す
 * @param {Array} streams
 * @returns {{
 *   byDayOfWeek: Map<number, number>,   // dayOfWeek => 配信があった週数
 *   byMmdd: Set<string>,                // "M-D" 形式の日付セット
 *   byDayAndMmdd: Set<string>,          // "dayOfWeek-M-D" 形式のセット
 *   sortedJstDates: Array<{year,month,day,dayOfWeek,title,tag}>  // 新→旧
 *   totalWeeks: number,
 * }}
 */
function preprocessStreams(streams) {
    const weekSet        = new Map(); // "YYYY-Www-dayOfWeek" => true （週dedup用）
    const byMmdd         = new Set();
    const byDayAndMmdd   = new Set();
    const sortedJstDates = [];

    streams.forEach(stream => {
        const jst = toJST(stream.scheduledStartTime);
        sortedJstDates.push({ ...jst, title: stream.title || '', tag: stream.tag || '' });

        // 月/日セット
        byMmdd.add(mmdd(jst));

        // 曜日＋月/日セット
        byDayAndMmdd.add(`${jst.dayOfWeek}-${mmdd(jst)}`);

        // 週dedup
        const weekKey = `${getISOWeek(jst)}-${jst.dayOfWeek}`;
        weekSet.set(weekKey, true);
    });

    // 曜日ごとに「配信があった週」を集計
    const weekCountByDay = new Map([[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0]]);
    weekSet.forEach((_, key) => {
        const dow = parseInt(key.split('-').pop(), 10);
        weekCountByDay.set(dow, weekCountByDay.get(dow) + 1);
    });

    // 総週数（期間全体）
    const allDates   = streams.map(s => new Date(s.scheduledStartTime).getTime());
    const totalWeeks = allDates.length >= 2
        ? Math.max(1, Math.round((Math.max(...allDates) - Math.min(...allDates)) / (7 * 24 * 60 * 60 * 1000)))
        : 1;

    // 新→旧にソート
    sortedJstDates.sort((a, b) =>
        new Date(b.year, b.month - 1, b.day) - new Date(a.year, a.month - 1, a.day)
    );

    return { weekCountByDay, byMmdd, byDayAndMmdd, sortedJstDates, totalWeeks };
}

/**
 * ISO週番号文字列を返す（JST日付オブジェクト版）
 * @param {{ year, month, day }} jst
 */
function getISOWeek({ year, month, day }) {
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * 直近 n 日間の連続配信チェック
 * sortedJstDates（新→旧）を使い、「昨日」から遡って連続しているか調べる
 * @param {Array} sortedJstDates
 * @param {{ year, month, day }} targetJst  予報対象日
 * @returns {{ isConsecutive: boolean, currentGame: string }}
 *   isConsecutive: 対象日の前日まで 2 日以上連続配信があるか
 *   currentGame: 直近配信のタイトル+タグ結合文字列（ゲーム判定用）
 */
function checkConsecutive(sortedJstDates, targetJst) {
    if (sortedJstDates.length === 0) return { isConsecutive: false, currentGame: '' };

    const toMs = ({ year, month, day }) => new Date(year, month - 1, day).getTime();
    const targetMs  = toMs(targetJst);
    const oneDayMs  = 24 * 60 * 60 * 1000;

    // 対象日より前の配信だけを対象にする
    const past = sortedJstDates.filter(d => toMs(d) < targetMs);
    if (past.length === 0) return { isConsecutive: false, currentGame: '' };

    const currentGame = `${past[0].title} ${past[0].tag}`;

    // 直近配信日から遡って連続しているか確認（2 日以上連続）
    let streakDays = 1;
    for (let i = 1; i < past.length; i++) {
        const diff = toMs(past[i - 1]) - toMs(past[i]);
        if (diff === oneDayMs) {
            streakDays++;
        } else if (diff === 0) {
            // 同日複数配信はスキップ
            continue;
        } else {
            break;
        }
    }

    return { isConsecutive: streakDays >= 2, currentGame };
}

/**
 * 対象日の配信スコアを計算して 0〜100 に収める
 * @param {{ year, month, day, dayOfWeek }} targetJst
 * @param {object} precomputed  preprocessStreams の戻り値
 * @returns {number} 0〜100 の整数
 */
function calcScore(targetJst, precomputed) {
    const { weekCountByDay, byMmdd, byDayAndMmdd, sortedJstDates, totalWeeks } = precomputed;
    const W = SCORE_WEIGHTS;
    let score = 0;

    // ① 過去実績（①-a〜c は排他。最も条件が厳しいものだけ加算）
    if (byDayAndMmdd.has(`${targetJst.dayOfWeek}-${mmdd(targetJst)}`)) {
        // ①-a: 同曜日かつ同日付 — 最優先
        score += W.sameDayAndDate;
    } else if (byMmdd.has(mmdd(targetJst))) {
        // ①-c: 同日付のみ（曜日は一致しないが日付は一致）
        //       ※ 同曜日条件より同日付を優先（珍しい一致なので）
        score += W.sameDateOfMonth;
    } else {
        // ①-b: 同曜日のみ — 過去の配信率を比例加算
        const dowCount = weekCountByDay.get(targetJst.dayOfWeek) ?? 0;
        const dowRate  = Math.min(1, dowCount / totalWeeks);
        score += Math.round(dowRate * W.sameDayOfWeek);
    }

    // ② 連続配信チェック（①と独立して加算）
    const { isConsecutive, currentGame } = checkConsecutive(sortedJstDates, targetJst);
    if (isConsecutive) {
        const isHype = HYPE_GAMES.some(kw => currentGame.includes(kw));
        score += isHype ? W.consecutiveHype : W.consecutive;
    }

    // ③ 生理と思われる日（減点）
    if (MENSTRUAL_DATES.includes(targetJst.day)) {
        score += W.menstrualPenalty;
    }

    return Math.min(100, Math.max(0, score));
}

/**
 * スコアから FORECAST_TABLE を引いて絵文字・メッセージを返す
 * @param {number} score
 * @param {number} dayOfWeek
 * @returns {{ icon: string, message: string }}
 */
function lookupForecastDisplay(score, dayOfWeek) {
    const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
    const dayName   = DAY_NAMES[dayOfWeek];
    const row       = FORECAST_TABLE.find(r => score >= r.threshold) ?? FORECAST_TABLE[FORECAST_TABLE.length - 1];
    return {
        icon:    row.icon,
        message: row.message.replace('{day}', dayName),
    };
}

/**
 * 指定日の予報オブジェクトを構築する
 * @param {{ year, month, day, dayOfWeek }} targetJst
 * @param {object} precomputed
 * @returns {{ probability: number, icon: string, message: string }}
 */
function buildForecast(targetJst, precomputed) {
    const probability = calcScore(targetJst, precomputed);
    const { icon, message } = lookupForecastDisplay(probability, targetJst.dayOfWeek);
    return { probability, icon, message };
}

// ────────────────────────────────────────────────
//  描画
// ────────────────────────────────────────────────
function renderForecast(streams) {
    const precomputed = preprocessStreams(streams);

    const todayJst    = nowJST();
    const tomorrowJst = (() => {
        const d = new Date(todayJst.year, todayJst.month - 1, todayJst.day + 1);
        return {
            year:      d.getFullYear(),
            month:     d.getMonth() + 1,
            day:       d.getDate(),
            dayOfWeek: d.getDay(),
        };
    })();

    const todayF    = buildForecast(todayJst, precomputed);
    const tomorrowF = buildForecast(tomorrowJst, precomputed);

    const dividerHtml = `
        <div class="forecast-divider">
            <div class="divider-line"></div>
            <span class="divider-label">明日</span>
            <div class="divider-line"></div>
        </div>`;

    $('.today-forecast').html(`
        <div class="forecast-main">
            <div class="forecast-left">
                <div class="weather-icon today-icon">${todayF.icon}</div>
                <div class="forecast-text">今日の配信確率</div>
                <div class="forecast-percent">${todayF.probability}%</div>
                <div class="forecast-message">${todayF.message}</div>
            </div>
            ${dividerHtml}
            <div class="tomorrow-forecast-inner">
                <div class="weather-icon tomorrow-icon">${tomorrowF.icon}</div>
                <div class="tomorrow-label">明日 ${tomorrowF.probability}%</div>
            </div>
        </div>
    `);

    // tomorrow-forecast は today 内に統合したので非表示
    $('.tomorrow-forecast').hide();
}

/**
 * 最近の配信を上位3件表示する
 * @param {Array} videos  latest.json の videos 配列（新しい順）
 */
function renderHistory(videos) {
    const top3 = videos.slice(0, 3);

    const itemsHtml = top3.map(({ title, published, thumbnail, url }) => {
        const dateStr = formatPublishedDate(published);
        return `
            <a class="history-item" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
                <img class="history-thumb" src="${escapeHtml(thumbnail)}" alt="${escapeHtml(title)}" loading="lazy">
                <div class="history-info">
                    <div class="history-title">${escapeHtml(title)}</div>
                    <div class="history-date">${dateStr}</div>
                </div>
            </a>`;
    }).join('');

    $('.history-list').html(itemsHtml);
}

// ────────────────────────────────────────────────
//  ユーティリティ
// ────────────────────────────────────────────────
function formatPublishedDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
        year:     'numeric',
        month:    '2-digit',
        day:      '2-digit',
        hour:     '2-digit',
        minute:   '2-digit',
        timeZone: 'Asia/Tokyo',
    });
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
