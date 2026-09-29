"use client";

import Script from "next/script";
import { useEffect } from "react";

declare global {
  interface Window {
    ym?: (id: number, action: string, ...parameters: unknown[]) => void;
  }
}

const DEFAULT_COUNTER_ID = 113130690;

function resolveCounterId(value?: string) {
  const configured = Number(value);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_COUNTER_ID;
}

function goalForLink(link: HTMLAnchorElement) {
  const href = link.getAttribute("href") || "";
  if (href.startsWith("tel:")) return "phone_click";
  if (href.startsWith("mailto:")) return "email_click";
  if (href.includes("t.me/")) return "telegram_click";
  if (href.includes("max.ru/")) return "max_click";
  return undefined;
}

export function metrikaGoal(name: string, parameters?: Record<string, string>) {
  window.ym?.(resolveCounterId(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID), "reachGoal", name, parameters);
}

export function Metrika({ counterId }: { counterId?: string }) {
  const id = resolveCounterId(counterId);
  const initScript =
    "(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};" +
    "m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}" +
    "k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})" +
    "(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');ym(" +
    id +
    ",'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:false});";

  useEffect(() => {
    const trackContact = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a");
      if (!link) return;
      const goal = goalForLink(link);
      if (goal) window.ym?.(id, "reachGoal", goal);
    };
    document.addEventListener("click", trackContact);
    return () => document.removeEventListener("click", trackContact);
  }, [id]);

  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">{initScript}</Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={"https://mc.yandex.ru/watch/" + id} style={{ position: "absolute", left: "-9999px" }} alt="" />
      </noscript>
    </>
  );
}
