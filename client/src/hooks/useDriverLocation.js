import { useEffect, useRef, useState, useCallback } from 'react';
import { updateDriverLocation, apiError } from '../api/index.js';

/**
 * Real driver GPS (PHASE 17).
 *
 * Replaces the server-side `startDriverSimulation`, which interpolated a fake
 * position between two hardcoded points and emitted it — along with fabricated
 * status transitions — to anyone watching a booking room.
 *
 * Positions come from the device via watchPosition and are POSTed to an
 * endpoint that binds them to the authenticated driver. Updates are throttled
 * so a high-frequency GPS does not flood the API.
 */
const MIN_INTERVAL_MS = 8000;
const MIN_MOVE_METRES = 25;

function metresBetween(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function useDriverLocation({ enabled }) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [sharing, setSharing] = useState(false);

  const watchId = useRef(null);
  const lastSent = useRef({ at: 0, coords: null });

  const push = useCallback(async (coords) => {
    const now = Date.now();
    const { at, coords: prev } = lastSent.current;

    // Throttle: send only if enough time has passed or the driver actually moved.
    if (now - at < MIN_INTERVAL_MS) return;
    if (prev && metresBetween(prev, coords) < MIN_MOVE_METRES && now - at < 60000) return;

    lastSent.current = { at: now, coords };
    try {
      await updateDriverLocation({
        lat: coords.lat,
        lng: coords.lng,
        ...(coords.accuracy != null ? { accuracy: coords.accuracy } : {}),
        ...(coords.heading != null ? { heading: coords.heading } : {}),
        ...(coords.speed != null ? { speed: coords.speed } : {}),
      });
      setError(null);
    } catch (err) {
      setError(apiError(err, 'Could not update your location.'));
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      setSharing(false);
      return undefined;
    }

    if (!navigator.geolocation) {
      setError('This device does not support location sharing.');
      return undefined;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
          // heading/speed are null when stationary or unsupported.
          heading: pos.coords.heading != null && !Number.isNaN(pos.coords.heading)
            ? ((pos.coords.heading % 360) + 360) % 360 : undefined,
          speed: pos.coords.speed != null && pos.coords.speed >= 0
            ? Math.min(120, pos.coords.speed) : undefined,
        };
        setPosition(coords);
        setSharing(true);
        push(coords);
      },
      (err) => {
        setSharing(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission is required to receive ride requests.'
            : 'Could not read your location. Check that GPS is enabled.'
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );

    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [enabled, push]);

  /** One-shot read, used before going online so the server has a position. */
  const captureOnce = useCallback(() => new Promise((resolve) => {
    if (!navigator.geolocation) {
      setError('This device does not support location sharing.');
      return resolve(null);
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setPosition(coords);
        lastSent.current = { at: 0, coords: null };   // force the send through
        await push(coords);
        resolve(coords);
      },
      () => {
        setError('Location permission is required to go online.');
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 20000 }
    );
  }), [push]);

  return { position, error, sharing, captureOnce };
}
