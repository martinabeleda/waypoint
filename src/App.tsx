import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Play, Pause } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { environment } from "@/config/environment";

interface Location {
  lat: number;
  lng: number;
  timestamp: Date | null;
}

interface Route {
  name: string;
  coordinates: [number, number][];
}

// Update MAPSHARE_BASE_URL to use environment variable
const MAPSHARE_BASE_URL = environment.garmin.mapshareBaseUrl;
const TRACKING_INTERVAL = 2 * 60 * 1000; // 2 minutes in milliseconds

declare global {
  interface Window {
    mapboxgl: any;
  }
}

const Waypoint: React.FC = () => {
  const [currentLocation, setCurrentLocation] = useState<Location>({
    lat: 0,
    lng: 0,
    timestamp: null,
  });
  const [plannedRoute, setPlannedRoute] = useState<Route | null>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [map, setMap] = useState<any | null>(null);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/mapbox-gl/2.15.0/mapbox-gl.js";
    script.async = true;
    script.onload = initializeMap;
    document.body.appendChild(script);

    const link = document.createElement("link");
    link.href =
      "https://cdnjs.cloudflare.com/ajax/libs/mapbox-gl/2.15.0/mapbox-gl.css";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    return () => {
      script.remove();
      link.remove();
    };
  }, []);

  // Garmin MapShare API integration
  const fetchGarminLocation = useCallback(async (): Promise<void> => {
    const mapshareId = environment.garmin.mapshareId;

    if (!mapshareId) {
      setError("MapShare ID not configured in environment");
      return;
    }

    try {
      const response = await fetch(`${MAPSHARE_BASE_URL}/${mapshareId}/kml`);
      if (!response.ok) throw new Error("Failed to fetch location data");

      const kmlText = await response.text();

      // Parse KML
      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(kmlText, "text/xml");
      const placemark = kmlDoc.querySelector("Placemark");
      if (!placemark) throw new Error("No location data found");

      const coordinatesElement = placemark.querySelector("coordinates");
      const timestampElement = placemark.querySelector("TimeStamp when");

      if (!coordinatesElement || !timestampElement) {
        throw new Error("Invalid KML data structure");
      }

      const coordinates = coordinatesElement.textContent?.trim() ?? "";
      const [lng, lat] = coordinates.split(",").map(Number);
      const timestamp = new Date(timestampElement.textContent ?? "");

      if (isNaN(lat) || isNaN(lng)) {
        throw new Error("Invalid coordinates in KML");
      }

      setCurrentLocation({ lat, lng, timestamp });
      setError(null);

      if (map) {
        map.setCenter([lng, lat]);
        const markers = document.getElementsByClassName("mapboxgl-marker");
        if (markers[0]) {
          (markers[0] as any)._lngLat = { lng, lat };
          (markers[0] as any).update();
        }

        // Update tracking history
        const source = map.getSource("tracking-history");
        if (source) {
          const existingData = source.getData();
          const newCoordinates = [
            ...existingData.geometry.coordinates,
            [lng, lat],
          ];

          source.setData({
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: newCoordinates,
            },
          });
        }
      }
    } catch (error) {
      console.error("Error fetching Garmin location:", error);
      setError(
        `Failed to fetch location: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }, [map]);

  const initializeMap = (): void => {
    if (!window.mapboxgl) {
      console.error("Mapbox GL JS not loaded");
      return;
    }

    // Use environment variable for Mapbox token
    const mapboxToken = environment.mapbox.token;
    if (!mapboxToken) {
      setError("Mapbox token not configured in environment");
      return;
    }

    window.mapboxgl.accessToken = mapboxToken;

    const mapInstance = new window.mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [-74.5, 40],
      zoom: 9,
    });

    mapInstance.on("load", () => {
      setMapLoaded(true);
      setMap(mapInstance);

      // Add sources for route and tracking history
      mapInstance.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        },
      });

      mapInstance.addSource("tracking-history", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        },
      });

      // Add layers
      mapInstance.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#0080ff",
          "line-width": 4,
          "line-dasharray": [2, 1],
        },
      });

      mapInstance.addLayer({
        id: "tracking-history",
        type: "line",
        source: "tracking-history",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#ff3333",
          "line-width": 3,
        },
      });

      // Add current location marker
      new window.mapboxgl.Marker({
        color: "#ff3333",
      })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(mapInstance);
    });
  };

  // ... rest of the component remains the same ...

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Waypoint</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => document.getElementById("route-upload")?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Route
            </Button>
            <Button
              variant={isTracking ? "destructive" : "default"}
              onClick={() => setIsTracking(!isTracking)}
            >
              {isTracking ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Stop Tracking
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Tracking
                </>
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <input
          type="file"
          id="route-upload"
          className="hidden"
          accept=".json,.gpx"
          onChange={handleFileUpload}
        />

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {currentLocation.timestamp && (
          <div className="mb-4 text-sm text-gray-500">
            Last updated: {currentLocation.timestamp.toLocaleString()}
          </div>
        )}

        <div id="map" className="w-full h-96 rounded-lg overflow-hidden" />
      </CardContent>
    </Card>
  );
};

export default Waypoint;
