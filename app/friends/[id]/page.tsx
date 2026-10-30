import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { FriendChat } from "@/components/friends/FriendChat";
import { getFriendById, toFriendProfile } from "@/lib/friends";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const friend = getFriendById((await params).id);
  return { title: friend ? `与${friend.name}对话` : "好友未找到" };
}
export default async function FriendPage({ params }: Props) {
  const friend = getFriendById((await params).id);
  if (!friend) notFound();
  return <AppShell title={`与${friend.name}对话`} backHref="/friends" backLabel="返回好友列表">
    <FriendChat key={friend.id} friend={toFriendProfile(friend)} />
  </AppShell>;
}
