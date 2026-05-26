import os
from flask import Flask, render_template, jsonify
import requests
from datetime import datetime

app = Flask(__name__)

API_KEY = "b357983681cbfe4d3f41db0db0cf5fd4"
BASE_URL = "https://api.openweathermap.org/data/2.5"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/weather/<lat>/<lon>')
def get_current_weather(lat, lon):
    try:
        url = f"{BASE_URL}/weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if response.status_code != 200:
            return jsonify({"error": data.get("message", "Weather fetch failed")}), response.status_code

        # Fallback tracking for precipitation metric indicators
        precipitation = 0.0
        if "rain" in data:
            precipitation = data["rain"].get("1h", 0.0)
        elif "snow" in data:
            precipitation = data["snow"].get("1h", 0.0)

        processed_data = {
            "city": data.get("name", "Target Sector"),
            "temp": round(data["main"]["temp"]),
            "feels_like": round(data["main"]["feels_like"]),
            "humidity": data["main"]["humidity"],
            "condition": data["weather"][0]["main"],
            "description": data["weather"][0]["description"].title(),
            "icon": data["weather"][0]["icon"],
            "wind_speed": round(data["wind"].get("speed", 0) * 3.6), # Convert m/s to km/h
            "wind_deg": data["wind"].get("deg", 0),
            "precipitation": precipitation
            
        }
        aqi_url = f"{BASE_URL}/air_pollution?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
        aqi_response = requests.get(aqi_url, timeout=10)
        aqi_data = aqi_response.json()

        aqi = aqi_data["list"][0]["main"]["aqi"] if "list" in aqi_data else 1
        processed_data["aqi"] = aqi
        return jsonify(processed_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/forecast/<lat>/<lon>')
def get_five_day_forecast(lat, lon):
    try:
        url = f"{BASE_URL}/forecast?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
        response = requests.get(url, timeout=10)
        data = response.json()

        if response.status_code != 200:
            return jsonify({"error": data.get("message", "Forecast fetch failed")}), response.status_code

        forecast_list = []
        seen_dates = set()
        
    
        for item in data.get("list", []):
            date_txt = item["dt_txt"].split(" ")[0] # Extracts YYYY-MM-DD split component
            
            
            if date_txt not in seen_dates and ("12:00:00" in item["dt_txt"] or len(seen_dates) < 5):
                day_name = datetime.strptime(date_txt, "%Y-%m-%d").strftime("%a")
                
                rain = item.get("rain", {}).get("3h", 0.0)
                snow = item.get("snow", {}).get("3h", 0.0)

                forecast_list.append({
                    "day": day_name,
                    "temp": round(item["main"]["temp"]),
                    "condition": item["weather"][0]["main"],
                    "icon": item["weather"][0]["icon"],
                    "precipitation": round(rain + snow, 2)  # 👈 this is the missing field
                })
                seen_dates.add(date_txt)
                
            if len(forecast_list) == 5:
                break

        return jsonify(forecast_list)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/search/<city_name>')
def search_city_coordinates(city_name):
    try:
        
        geo_url = f"http://api.openweathermap.org/geo/1.0/direct?q={city_name}&limit=1&appid={API_KEY}"
        
        
        print(f"DEBUGGING ACTIVE: Sending request to -> {geo_url}")
        
        geo_response = requests.get(geo_url, timeout=10)
        geo_data = geo_response.json()
        
        if not geo_data:
            return jsonify({"error": "City not found"}), 404

        return jsonify({
            "lat": geo_data[0]["lat"],
            "lon": geo_data[0]["lon"],
            "name": geo_data[0]["name"]
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/autocomplete/<query>")
def autocomplete(query):
    try:
        url = f"https://api.openweathermap.org/geo/1.0/direct?q={query}&limit=5&appid={API_KEY}"
        response = requests.get(url, timeout=5)
        data = response.json()

        if response.status_code != 200:
            return jsonify([])

        cities = [
            f"{c['name']}, {c.get('state','')}, {c.get('country','')}".replace(" ,", "")
            for c in data
        ]

        return jsonify(cities)

    except Exception as e:
        print("Autocomplete error:", e)
        return jsonify([])
    
if __name__ == '__main__':
    app.run(debug=True)
