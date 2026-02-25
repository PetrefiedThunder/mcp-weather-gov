#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = "https://api.weather.gov";
const UA = "(mcp-weather-gov, chris.sellers01@gmail.com)";
const RATE_LIMIT_MS = 500;
let last = 0;

async function wxFetch(path: string): Promise<any> {
  const now = Date.now(); if (now - last < RATE_LIMIT_MS) await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - (now - last)));
  last = Date.now();
  const res = await fetch(`${BASE}${path}`, { headers: { "User-Agent": UA, Accept: "application/geo+json" } });
  if (!res.ok) throw new Error(`weather.gov ${res.status}`);
  return res.json();
}

const server = new McpServer({ name: "mcp-weather-gov", version: "1.0.0" });

server.tool("get_forecast", "Get 7-day forecast for a location (US only).", {
  lat: z.number().describe("Latitude"), lon: z.number().describe("Longitude"),
}, async ({ lat, lon }) => {
  const point = await wxFetch(`/points/${lat},${lon}`);
  const forecastUrl = point.properties?.forecast;
  if (!forecastUrl) throw new Error("No forecast available for this location");
  const forecast = await fetch(forecastUrl, { headers: { "User-Agent": UA } }).then((r) => r.json());
  const periods = forecast.properties?.periods?.map((p: any) => ({
    name: p.name, temperature: p.temperature, temperatureUnit: p.temperatureUnit,
    windSpeed: p.windSpeed, windDirection: p.windDirection, shortForecast: p.shortForecast,
    detailedForecast: p.detailedForecast,
  }));
  return { content: [{ type: "text" as const, text: JSON.stringify({ location: point.properties?.relativeLocation?.properties, periods }, null, 2) }] };
});

server.tool("get_hourly_forecast", "Get hourly forecast for a location.", {
  lat: z.number(), lon: z.number(),
}, async ({ lat, lon }) => {
  const point = await wxFetch(`/points/${lat},${lon}`);
  const url = point.properties?.forecastHourly;
  if (!url) throw new Error("No hourly forecast");
  const forecast = await fetch(url, { headers: { "User-Agent": UA } }).then((r) => r.json());
  const periods = forecast.properties?.periods?.slice(0, 24).map((p: any) => ({
    startTime: p.startTime, temperature: p.temperature, windSpeed: p.windSpeed,
    shortForecast: p.shortForecast, probabilityOfPrecipitation: p.probabilityOfPrecipitation?.value,
  }));
  return { content: [{ type: "text" as const, text: JSON.stringify(periods, null, 2) }] };
});

server.tool("get_alerts", "Get active weather alerts for a state or area.", {
  state: z.string().optional().describe("2-letter state code (e.g. CA, NY)"),
  zone: z.string().optional().describe("NWS zone ID"),
  area: z.string().optional().describe("Area code"),
}, async ({ state, zone, area }) => {
  const params = new URLSearchParams({ active: "true", status: "actual" });
  if (state) params.set("area", state);
  if (zone) params.set("zone", zone);
  if (area) params.set("area", area);
  const data = await wxFetch(`/alerts?${params}`);
  const alerts = data.features?.map((f: any) => ({
    headline: f.properties?.headline, severity: f.properties?.severity,
    event: f.properties?.event, description: f.properties?.description?.slice(0, 500),
    onset: f.properties?.onset, expires: f.properties?.expires,
    areaDesc: f.properties?.areaDesc,
  }));
  return { content: [{ type: "text" as const, text: JSON.stringify({ count: alerts?.length, alerts }, null, 2) }] };
});

server.tool("get_stations", "Find weather observation stations near a point.", {
  lat: z.number(), lon: z.number(),
}, async ({ lat, lon }) => {
  const point = await wxFetch(`/points/${lat},${lon}`);
  const stationsUrl = point.properties?.observationStations;
  if (!stationsUrl) throw new Error("No stations found");
  const data = await fetch(stationsUrl, { headers: { "User-Agent": UA } }).then((r) => r.json());
  const stations = data.features?.slice(0, 10).map((f: any) => ({
    id: f.properties?.stationIdentifier, name: f.properties?.name,
    coordinates: f.geometry?.coordinates,
  }));
  return { content: [{ type: "text" as const, text: JSON.stringify(stations, null, 2) }] };
});

server.tool("get_current_conditions", "Get current weather observations from nearest station.", {
  stationId: z.string().describe("Station ID (e.g. 'KLAX', 'KJFK')"),
}, async ({ stationId }) => {
  const data = await wxFetch(`/stations/${stationId}/observations/latest`);
  const p = data.properties;
  return { content: [{ type: "text" as const, text: JSON.stringify({
    station: stationId, timestamp: p?.timestamp,
    temperature: p?.temperature?.value ? `${Math.round(p.temperature.value * 9/5 + 32)}°F (${Math.round(p.temperature.value)}°C)` : null,
    humidity: p?.relativeHumidity?.value ? `${Math.round(p.relativeHumidity.value)}%` : null,
    windSpeed: p?.windSpeed?.value ? `${Math.round(p.windSpeed.value * 0.621371)} mph` : null,
    windDirection: p?.windDirection?.value,
    description: p?.textDescription, visibility: p?.visibility?.value,
    barometricPressure: p?.barometricPressure?.value,
  }, null, 2) }] };
});

async function main() { const t = new StdioServerTransport(); await server.connect(t); }
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
