"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  Circle,
  LockKeyhole,
  Maximize2,
  Monitor,
  MousePointer2,
  Pause,
  Play,
  Search,
  Sparkles,
  Square,
} from "lucide-react";
import type { Marketplace, SearchState } from "@/lib/schemas";
import { Modal } from "./ui/dialog";
import { PlatformLogo } from "./platform-logos";

export function BrowserView({
  url,
  interactive = false,
}: {
  url: string;
  interactive?: boolean;
}) {
  const parsed = new URL(url);
  parsed.searchParams.set("interactive", String(interactive));
  return (
    <iframe
      title={
        interactive
          ? "Interactive marketplace browser"
          : "Live marketplace browser"
      }
      src={parsed.toString()}
      className="steel-browser"
      allow="clipboard-read; clipboard-write"
      referrerPolicy="no-referrer"
    />
  );
}

export function AgentPanel({
  state,
  activeMarket,
  setActiveMarket,
  onConnect,
  onExpand,
  isCollapsed,
}: {
  state: SearchState | null;
  activeMarket: Marketplace | "all";
  setActiveMarket: (m: Marketplace | "all") => void;
  onConnect: () => void;
  onExpand?: () => void;
  isCollapsed?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const run =
    activeMarket === "all"
      ? state?.runs.find((r) => r.status === "searching") || state?.runs[0]
      : state?.runs.find((r) => r.marketplace === activeMarket);
  const browsing =
    activeMarket === "all"
      ? state?.runs.some((r) => r.status === "searching")
      : run?.status === "searching";
  const listings =
    activeMarket === "all"
      ? state?.listings || []
      : state?.listings.filter((l) => l.marketplace === activeMarket) || [];
  const events =
    state?.events
      .filter(
        (e) =>
          activeMarket === "all" ||
          !e.marketplace ||
          e.marketplace === activeMarket,
      )
      .slice(-5) || [];

  const marketAddress =
    activeMarket === "facebook"
      ? "facebook.com/marketplace"
      : activeMarket === "ebay"
        ? "ebay.com/sch"
        : activeMarket === "kijiji"
          ? "kijiji.ca/b-search"
          : "haggleface.com/agent";

  const view = (
    <div className="browser-frame">
      <div className="browser-toolbar">
        <div className="traffic">
          <i />
          <i />
          <i />
        </div>
        <div className="address">
          <LockKeyhole size={11} className="lock-icon" />
          <span className="address-url">{marketAddress}</span>
          <span className="browser-badge-text">
            {state?.demo ? "SIMULATED" : "BROWSER"}
          </span>
        </div>
      </div>
      {run?.debugUrl ? (
        <BrowserView url={run.debugUrl} />
      ) : (
        <div className={`simulated-browser ${state ? "has-search" : ""}`}>
          <div className="mock-market-header">
            <div className="mock-market-brand">
              {activeMarket === "facebook" ? (
                <PlatformLogo market="facebook" size={18} />
              ) : activeMarket === "ebay" ? (
                <PlatformLogo market="ebay" size={18} />
              ) : activeMarket === "kijiji" ? (
                <PlatformLogo market="kijiji" size={18} />
              ) : (
                <div className="multi-platform-icons">
                  <PlatformLogo market="facebook" size={16} />
                  <PlatformLogo market="ebay" size={16} />
                  <PlatformLogo market="kijiji" size={16} />
                </div>
              )}
            </div>
            <div className="mock-market-search">
              <Search size={12} className="mock-search-icon" />
              <span>
                {state?.identification?.productName || "Search marketplace"}
              </span>
            </div>
          </div>
          {state && listings.length > 0 ? (
            <>
              <div className="mock-results-heading">
                {state.identification?.productName}
                <span>{listings.length} results</span>
              </div>
              <div className="mock-grid">
                {listings.slice(0, 4).map((l) => (
                  <div key={l.id}>
                    <img
                      src={l.imageUrls[0]}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.src = "/product.svg";
                      }}
                    />
                    <strong>${l.price}</strong>
                    <p>{l.title}</p>
                    <small>{l.location}</small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="browser-empty">
              <div className="browser-empty-icon">
                <Monitor size={28} />
                <span className="sparkle-badge">
                  <Sparkles size={13} />
                </span>
              </div>
              <h4>
                {browsing
                  ? "Your agent is browsing"
                  : "A front-row seat to your search"}
              </h4>
              <p>
                {browsing
                  ? "Opening the marketplace and looking for matches…"
                  : "Watch Haggleface search, compare, and find the good stuff. Every step, right here."}
              </p>
              <div className="browser-placeholder-cards">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
          {state?.demo && (
            <div className="simulation-label">
              <Circle size={7} fill="currentColor" /> Demo browser · simulated
              activity
            </div>
          )}
          {browsing && (
            <div className="agent-cursor">
              <MousePointer2 size={19} fill="currentColor" />
              <span>Haggleface is browsing</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <aside
      className="agent-panel"
      onClick={isCollapsed ? onExpand : undefined}
      title={isCollapsed ? "Click to expand agent preview" : undefined}
    >
      <div className="agent-panel-inner">
        <div className="agent-header">
        <div className="agent-header-left">
          <span className={`status-pill ${browsing ? "active" : ""}`}>
            {browsing ? (
              <Play size={8} fill="currentColor" className="status-square-icon" />
            ) : run?.status === "login_required" ? (
              <Pause size={8} fill="currentColor" className="status-square-icon" />
            ) : (
              <Square size={7} fill="currentColor" className="status-square-icon" />
            )}
            {browsing ? "Working" : run?.status === "login_required" ? "Paused" : "Ready"}
          </span>
          <h2 className="agent-header-title">Your haggler agent preview</h2>
        </div>
        <button
          className="agent-expand-icon-btn"
          aria-label="Expand browser preview"
          onClick={() => setExpanded(true)}
        >
          <Maximize2 size={16} />
        </button>
      </div>

      <div className="agent-market-tabs">
        <button
          type="button"
          className={`agent-tab-btn ${activeMarket === "all" ? "active" : ""}`}
          onClick={() => setActiveMarket("all")}
        >
          ALL
        </button>
        <button
          type="button"
          className={`agent-tab-btn ${activeMarket === "facebook" ? "active" : ""}`}
          onClick={() => setActiveMarket("facebook")}
          aria-label="Facebook Marketplace"
        >
          <PlatformLogo market="facebook" size={17} />
          <span className="market-tab-label">Facebook</span>
        </button>
        <button
          type="button"
          className={`agent-tab-btn ${activeMarket === "ebay" ? "active" : ""}`}
          onClick={() => setActiveMarket("ebay")}
          aria-label="eBay"
        >
          <PlatformLogo market="ebay" size={17} />
          <span className="market-tab-label">eBay</span>
        </button>
        <button
          type="button"
          className={`agent-tab-btn ${activeMarket === "kijiji" ? "active" : ""}`}
          onClick={() => setActiveMarket("kijiji")}
          aria-label="Kijiji"
        >
          <PlatformLogo market="kijiji" size={17} />
          <span className="market-tab-label">Kijiji</span>
        </button>
      </div>

      {view}

      {run?.status === "login_required" && (
        <button className="connection-warning" onClick={onConnect}>
          Sign in to continue <ArrowUpRight size={15} />
        </button>
      )}

      <div className="activity-log-section">
        <div className="activity-log-heading">ACTIVITY LOG</div>
        {events.length ? (
          <div className="activity-list" aria-live="polite">
            {events.map((e, i) => (
              <div
                key={e.id}
                className={`activity-item ${e.kind === "error" ? "error" : ""}`}
              >
                <span
                  className={`activity-bullet ${
                    i === events.length - 1 && browsing ? "current" : ""
                  }`}
                >
                  <Circle size={8} fill="currentColor" />
                </span>
                <p className="activity-text">{e.message}</p>
                <time className="activity-time">
                  {new Date(e.time).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <div className="activity-list activity-idle">
            <div className="activity-item placeholder">
              <span className="activity-bullet">
                <Circle size={8} />
              </span>
              <span className="dashed-placeholder short" />
            </div>
            <div className="activity-item placeholder">
              <span className="activity-bullet">
                <Circle size={8} />
              </span>
              <span className="dashed-placeholder medium" />
            </div>
            <div className="activity-item placeholder">
              <span className="activity-bullet">
                <Circle size={8} />
              </span>
              <span className="dashed-placeholder long" />
            </div>
          </div>
        )}
      </div>
      </div>

      <Modal
        open={expanded}
        onOpenChange={setExpanded}
        title="Agent browser preview"
        description={
          state?.demo
            ? "Simulated marketplace browsing session"
            : "Live Steel cloud browser session"
        }
      >
        {view}
      </Modal>
    </aside>
  );
}
