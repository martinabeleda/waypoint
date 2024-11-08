import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

interface Environment {
  mapbox: {
    token: string;
  };
  garmin: {
    mapshareBaseUrl: string;
  };
}

// Helper function similar to os.getenv with default value
const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value || defaultValue || "";
};

export const environment: Environment = {
  mapbox: {
    token: getEnv("MAPBOX_TOKEN"),
  },
  garmin: {
    mapshareBaseUrl: getEnv(
      "GARMIN_MAPSHARE_URL",
      "https://share.garmin.com/feed/share",
    ),
  },
};
