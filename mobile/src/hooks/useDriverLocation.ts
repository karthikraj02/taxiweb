import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { updateLocation } from '../api/endpoints';

/**
 * Shares the driver's position with the server while they are online.
 *
 * Positions come from the device and are PUT to /api/drivers/me/location, which
 * the server validates and (for an active ride) relays to the rider. Only runs
 * while `enabled`; the OS permission is requested on first use.
 */
export function useDriverLocation(enabled: boolean) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const sub = useRef<Location.LocationSubscription | null>(null);

  const send = useCallback(async (loc: Location.LocationObject) => {
    const { latitude: lat, longitude: lng, accuracy, heading, speed } = loc.coords;
    setPosition({ lat, lng });
    try {
      await updateLocation({
        lat,
        lng,
        // The API rejects out-of-range values, so only send sensible ones.
        ...(accuracy != null && accuracy >= 0 && accuracy <= 10000 ? { accuracy } : {}),
        ...(heading != null && heading >= 0 && heading <= 360 ? { heading } : {}),
        ...(speed != null && speed >= 0 && speed <= 120 ? { speed } : {}),
      });
      setError(null);
    } catch {
      // A missed ping is not fatal; the next one will retry.
    }
  }, []);

  /** Ask permission, take one fix and share it. Returns false if we cannot get a position. */
  const captureOnce = useCallback(async (): Promise<boolean> => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setError('Location permission is required to go online. Allow it in Settings and try again.');
        return false;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await send(loc);
      return true;
    } catch {
      setError('Could not read your location. Check that location services are on.');
      return false;
    }
  }, [send]);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      sub.current?.remove();
      sub.current = null;
      setSharing(false);
      return undefined;
    }
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        const s = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 30 },
          (loc) => { if (!cancelled) send(loc); }
        );
        if (cancelled) { s.remove(); return; }
        sub.current = s;
        setSharing(true);
      } catch {
        setError('Could not start location sharing.');
      }
    })();
    return () => {
      cancelled = true;
      sub.current?.remove();
      sub.current = null;
    };
  }, [enabled, send]);

  return { position, error, sharing, captureOnce };
}
