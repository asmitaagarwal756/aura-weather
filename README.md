# 🌤 AuraWeather 

A modern, real-time weather dashboard built with Flask and vanilla JavaScript.

## Features

- 🌍 Real-time weather data for any location worldwide
- 📍 Auto-detect current location via browser geolocation
- 🗺️ Interactive Leaflet map — click anywhere to get weather
- 📊 5-day temperature and precipitation trend charts
- 💧 Humidity, wind speed, wind direction analysis
- 🌬️ Air Quality Index (AQI) gauge meter
- 🌧️ Precipitation forecast with trend chart
- 🌡️ Feels like thermal comfort analysis
- 🌙 Dark / Light mode toggle
- 🔍 City search with autocomplete suggestions
- 🎨 Dynamic backgrounds based on weather conditions

## Tech Stack

- **Backend:** Python, Flask
- **Frontend:** HTML, CSS, JavaScript
- **Maps:** Leaflet.js
- **Charts:** Chart.js
- **API:** OpenWeatherMap

## Setup Locally

1. Clone the repository
git clone https://github.com/YOURUSERNAME/aura-weather.git cd aura-weather

2. Install dependencies
pip install -r requirements.txt

3. Add your OpenWeatherMap API key in `app.py`
```python
   API_KEY = "your_api_key_here"
```

4. Run the app python app.py

5. Open your browser and go to `http://localhost:5000`

## Deployment

Deployed on [Render](https://render.com). Live at: https://aura-weather.onrender.com

## API Used

- [OpenWeatherMap](https://openweathermap.org/api) — Current weather, 5-day forecast, AQI, and geocoding

## License

MIT License
