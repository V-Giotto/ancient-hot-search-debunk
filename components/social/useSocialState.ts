"use client";
import { useEffect, useState } from "react";
import { emptyInteraction, readSocialState, SOCIAL_KEY, SOCIAL_UPDATED_EVENT, writeSocialState, type SocialState, type TopicInteraction } from "@/lib/social-storage";

export function useSocialState() {
  const [state, setState] = useState<SocialState>({});
  useEffect(() => {
    const refresh = () => setState(readSocialState());
    const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === SOCIAL_KEY) refresh(); };
    refresh();
    window.addEventListener(SOCIAL_UPDATED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener(SOCIAL_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);
  function toggle(id: string, field: keyof TopicInteraction) {
    const previous = { ...readSocialState(), ...state };
    const item = previous[id] ?? emptyInteraction;
    const next = { ...previous, [id]: { ...item, [field]: !item[field] } };
    setState(next);
    writeSocialState(next);
  }
  return { state, toggle };
}
