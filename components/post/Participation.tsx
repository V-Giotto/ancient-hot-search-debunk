"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { debates, scenarios, wordingRules } from "@/lib/participation";
import type { PublicTopic } from "@/lib/public-topic";

const WordingContext = createContext<{ active: boolean; selected?: string; select: (word: string) => void }>({ active: false, select: () => {} });
const words = wordingRules.flatMap((rule) => [...rule.words]);
const pattern = new RegExp(`(${words.join("|")})`, "g");

export function WordingText({ text }: { text: string }) {
  const wording = useContext(WordingContext);
  if (!wording.active) return <>{text}</>;
  return <>{text.split(pattern).map((part, index) => words.some((word) => word === part)
    ? <button key={index} type="button" className="wording-token" aria-label={`检查措辞：${part}`} aria-pressed={wording.selected === part} onClick={() => wording.select(part)}>{part}</button>
    : part)}</>;
}

export function Participation({ topic, post, children }: { topic: PublicTopic; post: ReactNode; children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [selected, select] = useState<string>();
  const [choice, setChoice] = useState<number>();
  const scenario = scenarios[topic.topicId];
  const rule = wordingRules.find((rule) => rule.words.some((word) => word === selected));
  return <WordingContext value={{ active, selected, select }}>
    {post}
    <section className="panel participation-panel" aria-labelledby="participation-heading">
      <div className="participation-heading"><h2 id="participation-heading">先接一句，再查证</h2><a href="#task-heading">直接判断</a></div>
      {scenario && <details className="scenario-panel">
        <summary>情境选择 · 你会怎么回复？</summary>
        <p className="scenario-prompt">{scenario.prompt}</p>
        <div role="group" aria-label="情境选择" className="scenario-options">{scenario.options.map((option, index) => <button type="button" className="secondary-button" key={option.text} aria-pressed={choice === index} onClick={() => setChoice(index)}>{option.text}</button>)}</div>
        <p className="participation-feedback" role="status">{choice === undefined ? "任选一句试试，也可以直接判断。" : scenario.options[choice].feedback}</p>
      </details>}
      <button type="button" className="wording-toggle secondary-button" aria-pressed={active} onClick={() => { setActive(!active); select(undefined); }}>{active ? "结束措辞点选" : "找可疑措辞"}</button>
      {active && <div className="wording-panel">
        <p className="text-sm text-muted">点选正文或评论里的虚线词语，看看推理哪里值得追问。</p>
        <blockquote aria-label="评论措辞练习"><WordingText text={debates[topic.topicId]?.text ?? topic.body} /></blockquote>
        <p className="participation-feedback" role="status">{rule && selected ? <><strong>“{selected}” · {rule.label}</strong><br />{rule.explanation}</> : "先点一个词；措辞练习不会替你提交真假判断。"}</p>
      </div>}
    </section>
    {children}
  </WordingContext>;
}
