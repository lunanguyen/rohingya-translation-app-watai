// Your Mac's LAN IP running the FastAPI backend (uvicorn app.main:app --host 0.0.0.0 --port 8080).
// "localhost" will NOT work from a phone -- it refers to the phone itself.
// Find your IP with `ipconfig getifaddr en0` (macOS) and make sure the phone
// is on the same Wi-Fi network as this machine.
export const BACKEND_URL = "http://192.168.2.18:8080";
