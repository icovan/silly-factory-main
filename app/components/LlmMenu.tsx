"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { copy } from "../../lib/i18n";
import { VENDORS, VendorId } from "../../lib/llm/vendors";
import { useFactorySession, useLlmLamp } from "../hooks/useFactorySession";

function userEdited(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>, saved: string) {
  const field = event.currentTarget;
  if (document.activeElement !== field) {
    field.value = saved;
    return false;
  }
  return event.target.value !== saved;
}

export function LlmMenu() {
  const { language, llm, setLlm, menuOpen, setMenuOpen, markLive, clearLive } = useFactorySession();
  const lamp = useLlmLamp();
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [keyReady, setKeyReady] = useState(false);
  const t = copy[language];
  const vendor = VENDORS.find((v) => v.id === llm.vendor) || VENDORS[0];
  const status = lamp.live ? t.roomOn : lamp.hasKey ? t.roomUntried : t.roomOff;

  useEffect(() => {
    if (!menuOpen) setKeyReady(false);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, setMenuOpen]);

  async function test() {
    if (!llm.apiKey.trim()) {
      setMessage(t.needKey);
      return;
    }
    setTesting(true);
    setMessage("");
    try {
      const res = await fetch("/api/llm/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vendor: llm.vendor,
          model: llm.model,
          apiKey: llm.apiKey,
          baseUrl: llm.vendor === "custom" ? llm.baseUrl : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || t.testFail);
      markLive();
      setMessage(t.testOk);
    } catch (error) {
      clearLive();
      setMessage(error instanceof Error ? error.message : t.testFail);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className={menuOpen ? "llm-dock open" : "llm-dock"}>
      <button
        type="button"
        className={lamp.live ? "llm-trigger live" : "llm-trigger"}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-expanded={menuOpen}
        aria-label={`${t.machineRoom}，${status}`}
        title={status}
      >
        <span className="llm-arrow" aria-hidden>
          {menuOpen ? "▴" : "▾"}
        </span>
      </button>
      {menuOpen ? (
        <div className="llm-sheet" role="dialog" aria-label={t.machineRoom}>
          <div className="llm-sheet-inner">
            <div className="llm-sheet-head">
              <strong>{t.machineRoom}</strong>
              <span className={lamp.live ? "llm-status live" : "llm-status"}>{status}</span>
            </div>
            <p className="hint">{t.machineHint}</p>
            <form autoComplete="off" onSubmit={(event) => event.preventDefault()}>
            <label>
              {t.vendor}
              <span className="select-wrap dark">
                <select
                  value={llm.vendor}
                  autoComplete="off"
                  onChange={(e) => {
                    if (!userEdited(e, llm.vendor)) return;
                    const id = e.target.value as VendorId;
                    const next = VENDORS.find((v) => v.id === id) || VENDORS[0];
                    const model = next.models.includes(llm.model) ? llm.model : next.models[0] || "";
                    setLlm({ ...llm, vendor: id, model });
                    setMessage("");
                  }}
                >
                  {VENDORS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {language === "zh" ? v.name : v.nameEn}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            {vendor.allowCustomBase ? (
              <>
                <label>
                  {t.baseUrl}
                  <input
                    value={llm.baseUrl}
                    autoComplete="off"
                    onChange={(e) => {
                      if (!userEdited(e, llm.baseUrl)) return;
                      setLlm({ ...llm, baseUrl: e.target.value });
                      setMessage("");
                    }}
                    placeholder="https://api.example.com/v1"
                  />
                </label>
                <label>
                  {t.customModel}
                  <input
                    value={llm.model}
                    autoComplete="off"
                    onChange={(e) => {
                      if (!userEdited(e, llm.model)) return;
                      setLlm({ ...llm, model: e.target.value });
                      setMessage("");
                    }}
                    placeholder="gpt-4o-mini"
                  />
                </label>
              </>
            ) : (
              <label>
                {t.model}
                <span className="select-wrap dark">
                  <select
                    value={llm.model}
                    autoComplete="off"
                    onChange={(e) => {
                      if (!userEdited(e, llm.model)) return;
                      setLlm({ ...llm, model: e.target.value });
                      setMessage("");
                    }}
                  >
                    {vendor.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            )}
            <label>
              {t.apiKey}
              <input
                type="password"
                name="silly-factory-key"
                value={llm.apiKey}
                readOnly={!keyReady}
                autoComplete="new-password"
                onFocus={() => setKeyReady(true)}
                onChange={(e) => {
                  if (!userEdited(e, llm.apiKey)) return;
                  setLlm({ ...llm, apiKey: e.target.value });
                  setMessage("");
                }}
                placeholder={llm.apiKey ? t.keySaved : "sk-..."}
              />
            </label>
            </form>
            {message ? <p className={lamp.live && message === t.testOk ? "llm-msg ok" : "llm-msg"}>{message}</p> : null}
            <div className="llm-actions">
              <button type="button" className="llm-test" onClick={test} disabled={testing}>
                {testing ? t.testing : t.testLlm}
              </button>
              <button type="button" className="llm-done" onClick={() => setMenuOpen(false)}>
                {t.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
