function calculateWeatherAdjustment(weather) {
  // temperature is in Celsius (Open-Meteo default: temperature_2m)
  // Thresholds: 29°C = ~85°F, 24°C = ~75°F, 13°C = ~55°F
  const temperature = Number(weather?.temperature ?? 21); // 21°C ≈ 70°F default
  const windSpeed = Number(weather?.windSpeed ?? 0);
  const windDirection = Number(weather?.windDirection ?? 0);

  let adjustment = 0;
  const notes = [];

  if (temperature >= 29) {
    adjustment += 4;
    notes.push('Hot weather boosts carry');
  } else if (temperature >= 24) {
    adjustment += 2;
    notes.push('Warm weather slightly boosts carry');
  } else if (temperature <= 13) {
    adjustment -= 3;
    notes.push('Cold weather suppresses carry');
  }

  if (windSpeed >= 10) {
    if (windDirection >= 225 && windDirection <= 315) {
      adjustment += 4;
      notes.push('Wind blowing out boosts HR potential');
    } else if (windDirection >= 45 && windDirection <= 135) {
      adjustment -= 4;
      notes.push('Wind blowing in suppresses HR potential');
    } else {
      adjustment += 1;
      notes.push('Crosswind has minor impact');
    }
  }

  return {
    adjustment,
    notes
  };
}

module.exports = { calculateWeatherAdjustment };