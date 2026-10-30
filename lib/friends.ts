// 仅供服务端使用；不向客户端传递 persona 或完整来源索引。
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { FriendSchema, type Friend, type FriendProfile } from "./friend-schema";
import { SourceSchema, type Source } from "./schemas";

export function validateFriends(friends: unknown, sources: unknown): Friend[] {
  const parsed = z.array(FriendSchema).parse(friends);
  const index = z.array(SourceSchema).parse(sources);
  const ids = new Set<string>();
  for (const friend of parsed) {
    if (ids.has(friend.id)) throw new Error(`好友 ID 重复：${friend.id}`);
    ids.add(friend.id);
    for (const sourceId of friend.sourceIds) {
      const source = index.find((entry) => entry.id === sourceId);
      if (!source || source.status !== "reviewed") throw new Error(`${friend.id} 只能引用存在且 reviewed 的来源：${sourceId}`);
    }
  }
  return parsed;
}

function loadFriends(): { friends: Friend[]; sources: Source[] } {
  const directory = path.join(process.cwd(), "data", "friends");
  const sources = z.array(SourceSchema).parse(JSON.parse(readFileSync(path.join(process.cwd(), "data", "source-index.json"), "utf8")));
  const friends = readdirSync(directory).filter((file) => file.endsWith(".json")).sort().map((file) => {
    const friend = FriendSchema.parse(JSON.parse(readFileSync(path.join(directory, file), "utf8")));
    if (file !== `${friend.id}.json`) throw new Error(`好友文件名须与 ID 一致：${file}`);
    return friend;
  });
  return { friends: validateFriends(friends, sources), sources };
}

export function getAllFriends(): Friend[] { return loadFriends().friends; }
export function getFriendById(id: string): Friend | undefined { return getAllFriends().find((friend) => friend.id === id); }
export function getFriendSources(friend: Friend): Source[] {
  // 即使调用者传入了旧数据或绕过加载器，也再次限制 reviewed 白名单。
  return loadFriends().sources.filter((source) => friend.sourceIds.includes(source.id) && source.status === "reviewed");
}
export function toFriendProfile({ id, name, avatarUrl, bio, greeting }: Friend): FriendProfile {
  return { id, name, avatarUrl, bio, greeting };
}
