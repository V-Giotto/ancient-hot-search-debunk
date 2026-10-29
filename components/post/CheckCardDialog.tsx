"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicTopic } from "@/lib/public-topic";
import type { VerdictResult } from "@/lib/verdict";

export function CheckCardDialog({ topic, result, onClose }: { topic: PublicTopic; result: VerdictResult; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [scale, setScale] = useState(0.6);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    closeButtonRef.current?.focus();
    const preview = previewRef.current!;
    const observer = new ResizeObserver(() => setScale(preview.clientWidth / 1200));
    observer.observe(preview);
    return () => {
      observer.disconnect();
      dialog.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  async function download() {
    if (!cardRef.current || exporting) return;
    setExporting(true);
    setError("");
    try {
      await document.fonts.ready;
      const { toPng } = await import("html-to-image");
      const url = await toPng(cardRef.current, {
        width: 1200, height: 675, canvasWidth: 1200, canvasHeight: 675,
        pixelRatio: 1, backgroundColor: "#f7f5f0", fontEmbedCSS: "",
      });
      const link = document.createElement("a");
      link.download = `${topic.id}-查证卡.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError("图片导出失败，请重试。");
    } finally {
      setExporting(false);
    }
  }

  function trapFocus(event: React.KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
      .filter((node) => node.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="card-dialog-title" onKeyDown={trapFocus} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="check-card-dialog">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div><h2 id="card-dialog-title" className="text-lg font-bold">查证卡预览</h2><p className="mt-1 text-xs text-muted">1200 × 675 · PNG</p></div>
        <button ref={closeButtonRef} type="button" onClick={onClose} className="secondary-button">关闭预览</button>
      </div>
      <div ref={previewRef} className="relative aspect-video w-full overflow-hidden rounded-xl border border-ink/10">
        <div style={{ width: 1200, height: 675, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <div ref={cardRef} data-testid="check-card" style={{ width: 1200, height: 675, boxSizing: "border-box", padding: "38px 48px", background: "#f7f5f0", color: "#26252c", display: "flex", flexDirection: "column", fontFamily: "var(--system-sans)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #d6ad72", paddingBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ background: "#e84e48", color: "#fff", borderRadius: 10, padding: "5px 13px", fontSize: 28, fontWeight: 800 }}>辟</span><strong style={{ fontSize: 26 }}>古代热搜辟谣局</strong></div>
              <span style={{ color: "#767680", fontSize: 18 }}>查证卡 / {topic.id}</span>
            </div>
            <h3 style={{ fontSize: 37, lineHeight: 1.45, margin: "22px 0 15px", fontWeight: 800 }}>{topic.title}</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
              <span style={{ border: `2px solid ${result.isTrue ? "#426b58" : "#c3433d"}`, color: result.isTrue ? "#426b58" : "#c3433d", padding: "6px 18px", borderRadius: 5, fontSize: 27, fontWeight: 800 }}>{result.isTrue ? "查证属实" : "谣言退散"}</span>
              <strong style={{ fontSize: 24 }}>查证结果：{result.isTrue ? "真" : "假"}</strong>
            </div>
            <div style={{ background: "#fff", borderLeft: "5px solid #d6ad72", padding: "16px 22px", fontSize: 27, fontWeight: 650, lineHeight: 1.65 }}>{result.reveal.correctedClaim}</div>
            <p style={{ margin: "15px 0", fontSize: 21, lineHeight: 1.7 }}>{result.reveal.shortExplanation}</p>
            <div style={{ marginTop: "auto", borderTop: "1px solid #dfd9ce", paddingTop: 14, fontSize: 16, lineHeight: 1.8, color: "#6d6559" }}>
              <p style={{ margin: 0 }}>来源：{result.sources.map((source) => source.organization).join(" / ")}</p>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>架空社交演绎 · 角色发言与热度为模拟</span><strong>开发预览：本条史实尚待人工审核</strong></div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-muted">导出内容保留待人工审核提示。</p>
        <button type="button" disabled={exporting} onClick={download} className="primary-button">{exporting ? "正在生成 PNG…" : "下载 PNG"}</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-accent">{error}</p>}
    </dialog>
  );
}
