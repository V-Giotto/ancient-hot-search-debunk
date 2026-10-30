import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";

export default function FriendNotFound() {
  return <AppShell title="好友未找到" backHref="/friends" backLabel="返回好友列表">
    <h1 className="text-xl font-bold">这位好友还没加入</h1>
    <p className="my-4 text-sm text-muted">先回列表，找一位熟悉的朋友聊聊吧。</p>
    <Link href="/friends" className="rounded-xl bg-card px-4 py-3 text-sm text-accent">返回好友列表</Link>
  </AppShell>;
}
