import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { FriendDirectory } from "@/components/friends/FriendDirectory";
import FriendsPage from "@/app/friends/page";
import { getAllFriends, toFriendProfile } from "@/lib/friends";

afterEach(cleanup);
const friends = getAllFriends();

it("好友列表展示十三位，与人设目录同序且不暴露完整人设", () => {
  render(<FriendsPage />);
  const list = screen.getByRole("list", { name: "好友列表" });
  expect(within(list).getAllByRole("link").map((node) => node.getAttribute("href"))).toEqual(friends.map(({ id }) => `/friends/${id}`));
  expect(screen.getByText("13 位")).toBeTruthy();
  expect(screen.queryByText(/待 Giotto/)).toBeNull();
});

it("我的好友可原生展开，十三人头像和直接聊天入口齐全", () => {
  const { container } = render(<FriendDirectory friends={friends.map(toFriendProfile)} />);
  const detail = container.querySelector("details")!;
  expect(detail.open).toBe(false);
  detail.open = true;
  const list = screen.getByRole("list", { name: "我的好友" });
  expect(within(list).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(friends.map(({ id }) => `/friends/${id}`));
  expect(within(list).getAllByRole("img").map((node) => node.getAttribute("alt"))).toEqual(friends.map(({ name }) => name));
});
