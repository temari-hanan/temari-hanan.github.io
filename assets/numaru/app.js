// ────────────────────────────────────────────────
//  定数
// ────────────────────────────────────────────────
const STREAM_DATA_URL = 'assets/numaru/youtube_streams.json';
const LATEST_DATA_URL = 'assets/numaru/latest.json';

const WEATHER_ICON = {
    live:   '\u26C8',
    cloudy: '\u2601\uFE0F',
    shower: '\u{1F326}\uFE0F',
    rain:   '\u{1F327}\uFE0F',
};

// 曜日インデックス（Date#getDay と対応）
const DAY_INDEX = { '日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6 };

// ────────────────────────────────────────────────
//  エントリポイント
// ────────────────────────────────────────────────
$(async () => {
    try {
        const [streams, latest] = await Promise.all([
            fetchJSON(STREAM_DATA_URL),
            fetchJSON(LATEST_DATA_URL),
        ]);
        renderForecast(streams);
        renderHistory(latest.videos);
    } catch (err) {
        console.error('データの取得に失敗しました:', err);
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
//  予報ロジック
// ────────────────────────────────────────────────

/**
 * 過去の配信データから曜日ごとの配信確率を計算する
 * @param {Array} streams
 * @returns {number[]} 曜日ごとの確率 [日,月,火,水,木,金,土]
 */
function buildDayProbabilities(streams) {
    // 週ごとにまとめて「その曜日に配信があった週」を数える
    const streamsByWeek = {}; // key: "YYYY-Www-dayIndex"

    streams.forEach(({ scheduledStartTime, dayOfTheWeek }) => {
        const date = new Date(scheduledStartTime);
        const weekKey = getISOWeek(date);
        const dayIdx = DAY_INDEX[dayOfTheWeek] ?? date.getDay();
        const key = `${weekKey}-${dayIdx}`;
        streamsByWeek[key] = true;
    });

    // 曜日別の「配信があった週数」を集計
    const dayCounts = Array(7).fill(0);
    Object.keys(streamsByWeek).forEach(key => {
        const dayIdx = parseInt(key.split('-').pop(), 10);
        dayCounts[dayIdx]++;
    });

    // 対象期間の総週数
    const dates = streams.map(s => new Date(s.scheduledStartTime));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const totalWeeks = Math.max(1, Math.round((maxDate - minDate) / (7 * 24 * 60 * 60 * 1000)));

    return dayCounts.map(count => Math.min(100, Math.round((count / totalWeeks) * 100)));
}

/** ISO週番号の文字列を返す */
function getISOWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * 指定日の配信確率と表示情報を返す
 * @param {Date} date
 * @param {number[]} dayProbs
 */
function buildForecast(date, dayProbs) {
    const probability = dayProbs[date.getDay()];
    return {
        date,
        probability,
        weatherIcon: getWeatherIcon(probability),
        message: buildForecastMessage(probability, date),
    };
}

function getWeatherIcon(probability) {
    if (probability >= 80) return WEATHER_ICON.live;
    if (probability >= 50) return WEATHER_ICON.cloudy;
    if (probability >= 20) return WEATHER_ICON.shower;
    return WEATHER_ICON.rain;
}

function buildForecastMessage(probability, date) {
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayName = dayNames[date.getDay()];

    if (probability >= 80) return `${dayName}曜日は過去の傾向から配信が期待できます！`;
    if (probability >= 50) return `${dayName}曜日は配信があるかも。チェックしてみて！`;
    if (probability >= 20) return `${dayName}曜日は配信はあまり多くない傾向です。`;
    return `${dayName}曜日は配信が少ない曜日です。`;
}

// ────────────────────────────────────────────────
//  描画
// ────────────────────────────────────────────────
function renderForecast(streams) {
    const dayProbs = buildDayProbabilities(streams);
    const today    = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayF    = buildForecast(today, dayProbs);
    const tomorrowF = buildForecast(tomorrow, dayProbs);

    const dividerHtml = `
        <div class="forecast-divider">
            <div class="divider-line"></div>
            <span class="divider-label">明日</span>
            <div class="divider-line"></div>
        </div>`;

    $('.today-forecast').html(`
        <div class="forecast-main">
            <div class="forecast-left">
                <div class="weather-icon today-icon">${todayF.weatherIcon}</div>
                <div class="forecast-text">今日の配信確率</div>
                <div class="forecast-percent">${todayF.probability}%</div>
                <div class="forecast-message">${todayF.message}</div>
            </div>
            ${dividerHtml}
            <div class="tomorrow-forecast-inner">
                <div class="weather-icon tomorrow-icon">${tomorrowF.weatherIcon}</div>
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
        year:   'numeric',
        month:  '2-digit',
        day:    '2-digit',
        hour:   '2-digit',
        minute: '2-digit',
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
