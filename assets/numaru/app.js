const DUMMY_DATA = [
    {
        title: '【SEKIRO】さあ、あなたもSEKIRO沼へ',
        tag: 'Sekiro',
        scheduledStartTime: '2021-12-02T04:32:59Z',
        actualEndTime: '2021-12-02T07:16:36Z',
        publishedAt: '2021-12-02T07:32:27Z',
        dayOfTheWeek: '木'
    }
];

const WEATHER_ICON = {
    live: '\u26C8',
    cloudy: '\u2601\uFE0F',
    shower: '\u{1F326}\uFE0F',
    rain: '\u{1F327}\uFE0F'
};

// 初期表示時
$(function(){
    initializeForecast();
});

// 配信確率表示用のメイン関数
function initializeForecast(){
    const today = new Date();

    const tomorrow = new Date();

    tomorrow.setDate(
        tomorrow.getDate() + 1
    );

    const todayForecast =
        calculateForecastForDate(today);

    const tomorrowForecast =
        calculateForecastForDate(tomorrow);

    renderForecast(
        todayForecast,
        tomorrowForecast
    );
}

// 
function calculateForecastForDate(date){
    const probability =
        calculateProbability(date);

    return {
        date,
        probability,
        weather:
            getWeatherIcon(probability),
        message:
            '本日は夜に配信がある可能性が高そうです'
    };
}

// 引数の日付における配信確率を計算して返す
function calculateProbability(date){
    const dateKey = formatDateKey(date);
    const cacheKey = `forecast_${dateKey}`;
    const cachedProbability = localStorage.getItem(cacheKey);

    if(cachedProbability !== null){
        return Number(
            cachedProbability
        );
    }

    const probability = calculateProbabilityCore(date);

    localStorage.setItem(
        cacheKey,
        probability
    );

    return probability;
}

// 
function calculateProbabilityCore(date){
    const day = date.getDate();

    return (
        (day * 7) % 100
    );
}

// 配信確率表示用の絵文字を返す
function getWeatherIcon(probability){
    if(probability >= 100){
        return WEATHER_ICON.live;
    }

    if(probability >= 50){
        return WEATHER_ICON.cloudy;
    }

    if(probability >= 1){
        return WEATHER_ICON.shower;
    }

    return WEATHER_ICON.rain;
}

// new Date() から YYYY-MM-DD を返す
function formatDateKey(date){
    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, '0');

    const day =
        String(
            date.getDate()
        ).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

// 描画用
function renderForecast(todayForecast, tomorrowForecast){
    $('.today-forecast').html(`
        <div class="weather-icon today-icon">
            ${todayForecast.weather}
        </div>

        <div class="forecast-text">
            今日の配信確率
        </div>

        <div class="forecast-percent">
            ${todayForecast.probability}%
        </div>

        <div class="forecast-message">
            ${todayForecast.message}
        </div>
    `);

    $('.tomorrow-forecast').html(`
        <div class="weather-icon tomorrow-icon">
            ${tomorrowForecast.weather}
        </div>

        <div class="tomorrow-label">
            明日 ${tomorrowForecast.probability}%
        </div>
    `);
}