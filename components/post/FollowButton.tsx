"use client";

import { useEffect, useState } from "react";

export function FollowButton({ handle, name }: { handle: string; name: string }) {
  const [following, setFollowing] = useState(false);
  const key = `ahsd:following:v1:${handle}`;

  useEffect(() => {
    try { setFollowing(localStorage.getItem(key) === "true"); }
    catch { /* 存储受限时仍可在本页切换。 */ }
  }, [key]);

  function toggle() {
    const next = !following;
    setFollowing(next);
    try { localStorage.setItem(key, String(next)); }
    catch { /* 不影响判题与贴纸。 */ }
  }

  return <button type="button" className="follow-button" aria-label={`关注${name}`} aria-pressed={following} onClick={toggle}>{following ? "已关注" : "+ 关注"}</button>;
}
