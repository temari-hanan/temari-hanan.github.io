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

function calculateForecast(targetDate){

    return {
        probability: 72,
        message: '本日は夜に配信がある可能性が高そうです'
    };

}

function renderForecast(){

    const todayForecast =
        document.querySelector('.today-forecast');

    const tomorrowForecast =
        document.querySelector('.tomorrow-forecast');

    const today =
        calculateForecast(new Date());

    const tomorrow =
        calculateForecast(
            new Date(Date.now() + 86400000)
        );

    todayForecast.innerHTML = `
        <div class="weather-icon today-icon">
            ${getWeatherIcon(today.probability)}
        </div>

        <div class="forecast-text">
            今日の配信確率
        </div>

        <div class="forecast-percent">
            ${today.probability}%
        </div>

        <div class="forecast-message">
            ${today.message}
        </div>
    `;

    tomorrowForecast.innerHTML = `
        <div class="weather-icon tomorrow-icon">
            ${getWeatherIcon(tomorrow.probability)}
        </div>

        <div class="tomorrow-label">
            明日 ${tomorrow.probability}%
        </div>
    `;

}

function renderHistory(){

    const container =
        document.querySelector('.history-list');

    container.innerHTML = DUMMY_DATA.map(item => `
        <div class="history-item">

            <div class="history-title">
                ${item.title}
            </div>

            <div class="tag">
                ${item.tag}
            </div>

            <div class="history-date">
                ${item.dayOfTheWeek}曜日
            </div>

        </div>
    `).join('');

}

function loadForecast(){

    const todayKey =
        new Date().toISOString().slice(0, 10);

    const cacheKey =
        `forecast_${todayKey}`;

    const cache =
        localStorage.getItem(cacheKey);

    if(cache){

        console.log('cache hit');

        return JSON.parse(cache);

    }

    const result = {
        createdAt: Date.now()
    };

    localStorage.setItem(
        cacheKey,
        JSON.stringify(result)
    );

    return result;

}

document.addEventListener('DOMContentLoaded', () => {

    loadForecast();

    renderForecast();

    renderHistory();

});