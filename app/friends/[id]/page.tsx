import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { FriendChat } from "@/components/friends/FriendChat";
import { getTopicById } from "@/lib/topics";
import { getFriendById, toFriendProfile } from "@/lib/friends";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const friend = getFriendById((await params).id);
  return { title: friend ? `与${friend.name}对话` : "好友未找到" };
}
export default async function FriendPage({ params, searchParams }: Props) {
  const friend = getFriendById((await params).id);
  if (!friend) notFound();
  const query = await searchParams;
  const topic = typeof query?.sharedTopicId === "string" ? getTopicById(query.sharedTopicId) : undefined;
  const token = typeof query?.shareToken === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(query.shareToken) ? query.shareToken : undefined;
  const incomingShare = topic && token ? { token, topic: { id: topic.id, title: topic.title, module: topic.module } } : undefined;
  return <AppShell title={`与${friend.name}对话`} backHref="/friends" backLabel="返回好友列表">
    <FriendChat key={friend.id} friend={toFriendProfile(friend)} incomingShare={incomingShare} />
  </AppShell>;
}
