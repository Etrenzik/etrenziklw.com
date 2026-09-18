"use client";

import { useCallback, useEffect, useState } from "react";

function storageKey(season: number): string {
  return `the-spread:my-picks:${season}`;
}

/**
 * Tracks the user's own picks for an external confidence pool (e.g. a CBS
 * Sports Pick'em pool) — separate from this app's model picks. Keyed by
 * gameId -> the team name the user picked, so a game's two rows (home/away)
 * naturally stay mutually exclusive: picking one team for a game overwrites
 * whatever was picked for the other side of the same gameId.
 *
 * Stored in localStorage only (per browser/device, never sent anywhere) —
 * this is a personal tracking aid, not part of the model's data pipeline.
 */
export function useMyPicks(season: number) {
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    try {
      const raw = window.localStorage.getItem(storageKey(season));
      setPicks(raw ? JSON.parse(raw) : {});
    } catch {
      setPicks({});
    }
    setLoaded(true);
  }, [season]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(storageKey(season), JSON.stringify(picks));
    } catch {
      // Private browsing / storage disabled / quota — picks just won't persist.
    }
  }, [picks, season, loaded]);

  const togglePick = useCallback((gameId: number, team: string) => {
    setPicks((prev) => {
      const next = { ...prev };
      if (next[gameId] === team) {
        delete next[gameId];
      } else {
        next[gameId] = team;
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setPicks({}), []);

  return { picks, togglePick, clearAll };
}
