"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Circle,
  Globe,
  LockKeyhole,
  Maximize2,
  Monitor,
  MousePointer2,
  Search,
  Sparkles,
} from "lucide-react";
import type { Marketplace, SearchState } from "@/lib/schemas";
import { MarketplaceBadge } from "./listings";
import { Modal } from "./ui/dialog";
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
}: {
  state: SearchState | null;
  activeMarket: Marketplace;
  setActiveMarket: (m: Marketplace) => void;
  onConnect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const run = state?.runs.find((r) => r.marketplace === activeMarket);
  const browsing = run?.status === "searching";
  const listings =
    state?.listings.filter((l) => l.marketplace === activeMarket) || [];
  const events =
    state?.events
      .filter((e) => !e.marketplace || e.marketplace === activeMarket)
      .slice(-5) || [];
  const view = (
    <div className="browser-frame">
      <div className="browser-toolbar">
        <div className="traffic">
          <i />
          <i />
          <i />
        </div>
        <div className="address">
          <LockKeyhole size={10} />
          {activeMarket === "facebook"
            ? "facebook.com/marketplace"
            : activeMarket === "ebay"
              ? "ebay.com/sch"
              : "kijiji.ca/b-search"}
          <span>{state?.demo ? "SIMULATED" : "BROWSER"}</span>
        </div>
        <button aria-label="Expand browser" onClick={() => setExpanded(true)}>
          <Maximize2 size={13} />
        </button>
      </div>
      {run?.debugUrl ? (
        <BrowserView url={run.debugUrl} />
      ) : (
        <div className={`simulated-browser ${state ? "has-search" : ""}`}>
          <div className="mock-market-header">
            <strong>
              {activeMarket === "facebook" ? (
                <>
                  <b className="fb-mark">f</b> Marketplace
                </>
              ) : activeMarket === "ebay" ? (
                <>
                  <span className="ebay-logo">
                    e<span>b</span>
                    <i>a</i>
                    <em>y</em>
                  </span>
                </>
              ) : (
                <>
                  <b className="kijiji-mark">k</b> Kijiji
                </>
              )}
            </strong>
            <div>
              <Search size={12} />
              {state?.identification?.productName || "Search marketplace"}
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
                <Monitor size={27} />
                <span>
                  <Sparkles size={12} />
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
    <aside className="agent-panel">
      <div className="agent-heading">
        <div className="agent-heading-title">
          <span className="agent-symbol">
            <Sparkles size={17} />
          </span>
          <div>
            <h2>Your shopping agent</h2>
            <p>Doing the legwork for you</p>
          </div>
        </div>
        <span className={`live-pill ${browsing ? "active" : ""}`}>
          <i />
          {browsing ? "Working" : "Ready"}
        </span>
      </div>
      <div className="agent-tabs">
        {(["facebook", "ebay", "kijiji"] as const).map((m) => (
          <button
            key={m}
            className={activeMarket === m ? "active" : ""}
            onClick={() => setActiveMarket(m)}
          >
            <MarketplaceBadge marketplace={m} />
            {state && (
              <span className="tab-count">
                {state.listings.filter((l) => l.marketplace === m).length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="agent-current">
        <div className={browsing ? "orbit spin" : "orbit"}>
          {run?.status === "complete" ? (
            <Check size={17} />
          ) : (
            <Globe size={17} />
          )}
        </div>
        <div>
          <strong>{run?.message || "Ready when you are"}</strong>
          <p>
            {browsing
              ? "Discovering listings in a real browser"
              : state?.demo
                ? "Sample sessions. Real shopping workflow."
                : "Three marketplaces. One smarter shortlist."}
          </p>
        </div>
      </div>
      {view}
      {run?.status === "login_required" && (
        <button className="connection-warning" onClick={onConnect}>
          Sign in to continue <ArrowUpRight size={15} />
        </button>
      )}
      <div className="browser-footnote">
        <LockKeyhole size={11} />{" "}
        {run?.debugUrl
          ? "Secure cloud browser powered by Steel"
          : "Powered by Steel · Playwright browser agents"}
        <span>↗</span>
      </div>
      <div className="timeline">
        <div className="section-label">
          ACTIVITY{" "}
          <span>
            {events.length
              ? `${state?.events.length} actions`
              : "Agent is on standby"}
          </span>
        </div>
        {events.length ? (
          <div aria-live="polite">
            {events.map((e, i) => (
              <div
                key={e.id}
                className={`timeline-item ${e.kind === "error" ? "event-error" : ""}`}
              >
                <span
                  className={
                    i === events.length - 1 && browsing ? "current" : ""
                  }
                >
                  {e.kind === "error" ? "!" : <Check size={12} />}
                </span>
                <p>{e.message}</p>
                <time>
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
          <>
            <div className="timeline-item muted">
              <span>
                <Circle size={10} />
              </span>
              <p>Understand what you’re looking for</p>
            </div>
            <div className="timeline-item muted">
              <span>
                <Circle size={10} />
              </span>
              <p>Search your marketplaces</p>
            </div>
            <div className="timeline-item muted">
              <span>
                <Circle size={10} />
              </span>
              <p>Compare prices and find your best deal</p>
            </div>
          </>
        )}
      </div>
      <div className="agent-bottom">
        <div>
          <span className="shield-icon">
            <Check size={13} />
          </span>
          <p>
            You’re always in control.
            <br />
            <small>No seller messages without your approval.</small>
          </p>
        </div>
        <ChevronRight size={15} />
      </div>
      <Modal
        open={expanded}
        onOpenChange={setExpanded}
        title="Agent browser"
        description={
          state?.demo
            ? "Simulated marketplace session"
            : "Live Steel browser session"
        }
      >
        {view}
      </Modal>
    </aside>
  );
}
