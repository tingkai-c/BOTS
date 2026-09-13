"use client";
import { type CSSProperties, useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowUpRight,
  Circle,
  LockKeyhole,
  Maximize2,
  Monitor,
  MousePointer2,
  Pause,
  Play,
  Sparkles,
  Square,
} from "lucide-react";
import type { Marketplace, SearchState, Listing, Run, AgentEvent } from "@/lib/schemas";
import { Modal } from "./ui/dialog";
import { PlatformLogo } from "./platform-logos";

const MARKETS: Marketplace[] = ["facebook", "ebay", "kijiji"];

const MARKET_CONFIG: Record<
  Marketplace,
  { label: string; url: string; host: string }
> = {
  facebook: {
    label: "Facebook",
    url: "facebook.com/marketplace",
    host: "facebook.com",
  },
  ebay: {
    label: "eBay",
    url: "ebay.com/sch",
    host: "ebay.com",
  },
  kijiji: {
    label: "Kijiji",
    url: "kijiji.ca/b-search",
    host: "kijiji.ca",
  },
};

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

export function KeepGoingStopButton({
  decisionPaused,
  resumedSearching,
  isSearching,
  onKeepGoing,
  onStopSearch,
  className = "",
}: {
  decisionPaused?: boolean;
  resumedSearching?: boolean;
  isSearching?: boolean;
  onKeepGoing?: () => void;
  onStopSearch?: () => void;
  className?: string;
}) {
  const activeSearching = Boolean(
    isSearching || (resumedSearching && isSearching !== false),
  );

  if (activeSearching) {
    return (
      <button
        type="button"
        className={`keep-going-btn searching-stop-btn ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          onStopSearch?.();
        }}
        aria-label="Stop searching"
        title="Click to stop remaining agents"
      >
        <span className="searching-content">
          <i className="working-dot" />
          Searching…
        </span>
        <span className="stop-content">
          <Square size={8} fill="currentColor" />
          Stop
        </span>
      </button>
    );
  }

  if (decisionPaused) {
    return (
      <button
        type="button"
        className={`keep-going-btn ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          onKeepGoing?.();
        }}
        aria-label="Keep going"
      >
        <Play size={10} fill="currentColor" />
        Keep going
      </button>
    );
  }

  return null;
}

function MarketBrowserCard({
  market,
  state,
  run,
  listings,
  browsing,
  compact = false,
  isExpandedModal = false,
  onPlay,
  onPause,
}: {
  market: Marketplace;
  state: SearchState | null;
  run?: Run;
  listings: Listing[];
  browsing?: boolean;
  compact?: boolean;
  isExpandedModal?: boolean;
  onPlay?: (market: Marketplace) => void;
  onPause?: (market: Marketplace) => void;
}) {
  const config = MARKET_CONFIG[market];
  const marketAddress = config.url;
  const isSearching = run?.status === "searching" || browsing;

  return (
    <div className={`browser-frame ${compact ? "compact" : ""}`}>
      <div className="browser-toolbar">
        <div className="traffic">
          <i />
          <i />
          <i />
        </div>
        <div className="address">
          <LockKeyhole size={compact ? 9 : 11} className="lock-icon" />
          <span className="address-url" title={marketAddress}>
            {compact ? config.host : marketAddress}
          </span>
          <span className="browser-badge-text">
            {state?.demo ? "SIM" : "LIVE"}
          </span>
        </div>
        {onPlay && onPause && (
          <div className="agent-window-controls toolbar-controls">
            <button
              type="button"
              className={`agent-control-btn play ${isSearching ? "disabled" : "active-play"}`}
              onClick={(e) => {
                e.stopPropagation();
                onPlay(market);
              }}
              disabled={isSearching}
              title={`Start / Continue ${config.label} search`}
              aria-label={`Start or continue ${config.label} search`}
            >
              <Play size={compact ? 7 : 8} fill="currentColor" />
            </button>
            <button
              type="button"
              className={`agent-control-btn pause ${!isSearching ? "disabled" : "active-pause"}`}
              onClick={(e) => {
                e.stopPropagation();
                onPause(market);
              }}
              disabled={!isSearching}
              title={`Pause / Stop ${config.label} search`}
              aria-label={`Pause or stop ${config.label} search`}
            >
              <Pause size={compact ? 7 : 8} fill="currentColor" />
            </button>
          </div>
        )}
      </div>
      {run?.debugUrl ? (
        <BrowserView url={run.debugUrl} />
      ) : (
        <div className={`simulated-browser ${compact ? "compact" : ""} ${state ? "has-search" : ""}`}>
          <div className="mock-market-header">
            <div className="mock-market-brand">
              <PlatformLogo market={market} size={compact ? 14 : 18} />
              <span className="brand-name">{config.label}</span>
            </div>
            <div className="mock-market-status-wrap">
              {isSearching ? (
                <span className="market-run-badge searching">
                  <Play size={compact ? 6 : 8} fill="currentColor" />
                  {compact ? "Live" : "Searching"}
                </span>
              ) : run?.status === "complete" ? (
                <span className="market-run-badge complete">
                  {listings.length > 0 ? `${listings.length} items` : "0 items"}
                </span>
              ) : run?.status === "paused" ? (
                <span className="market-run-badge paused">Paused</span>
              ) : run?.status === "login_required" ? (
                <span className="market-run-badge paused">Auth</span>
              ) : (
                <span className="market-run-badge ready">Ready</span>
              )}
            </div>
          </div>

          {state && listings.length > 0 ? (
            compact ? (
              <div className="compact-mock-list">
                {listings.slice(0, 3).map((l) => (
                  <div key={l.id} className="compact-mock-card">
                    <img
                      src={l.imageUrls[0]}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.src = "/product.svg";
                      }}
                    />
                    <div className="compact-card-info">
                      <strong className="compact-card-price">${l.price}</strong>
                      <p className="compact-card-title" title={l.title}>{l.title}</p>
                      <small className="compact-card-meta">{l.condition || l.location}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="mock-results-heading">
                  <span>{state.identification?.productName || state.query}</span>
                  <span>{listings.length} results</span>
                </div>
                <div className="mock-grid">
                  {(isExpandedModal ? listings : listings.slice(0, 4)).map((l) => (
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
            )
          ) : (
            <div className="browser-empty">
              <div className="browser-empty-icon">
                <Monitor size={compact ? 20 : 28} />
                <span className="sparkle-badge">
                  <Sparkles size={compact ? 10 : 13} />
                </span>
              </div>
              <h4>
                {isSearching
                  ? `Scanning ${config.label}…`
                  : run?.status === "complete"
                    ? `No ${config.label} items`
                    : `${config.label} preview`}
              </h4>
              <p>
                {isSearching
                  ? "Comparing prices…"
                  : run?.status === "complete"
                    ? "Filters yielded no matches."
                    : "Ready for your search."}
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
              <Circle size={compact ? 5 : 7} fill="currentColor" /> {compact ? "Demo" : "Demo browser · simulated activity"}
            </div>
          )}
          {isSearching && (
            <div className={`agent-cursor ${compact ? "compact" : ""}`}>
              <MousePointer2 size={compact ? 13 : 19} fill="currentColor" />
              <span>{compact ? "Agent" : "Haggleface is browsing"}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ActivityLogViewProps {
  events: AgentEvent[];
  compact?: boolean;
  isBrowsing?: boolean;
  placeholderCount?: number;
}

export function ActivityLogView({
  events,
  compact = false,
  isBrowsing = false,
  placeholderCount = 3,
}: ActivityLogViewProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const isNearBottomRef = useRef(true);

  const checkScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 2);
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setCanScrollDown(distanceFromBottom > 2);
    isNearBottomRef.current = distanceFromBottom < 20;
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (isNearBottomRef.current || events.length <= 6) {
      el.scrollTop = el.scrollHeight;
    }
    checkScroll();
  }, [events.length, checkScroll]);

  const showTopShadow = events.length >= 6 && canScrollUp;
  const showBottomShadow = events.length >= 6 && canScrollDown;

  if (events.length === 0) {
    return (
      <div className={`activity-list ${compact ? "compact " : ""}activity-idle`}>
        {Array.from({ length: placeholderCount }).map((_, idx) => (
          <div key={idx} className="activity-item placeholder">
            <span className="activity-bullet">
              <Circle size={compact ? 6 : 8} />
            </span>
            <span
              className={`dashed-placeholder ${
                idx === 0 ? "short" : idx === 1 ? "medium" : "long"
              }`}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`activity-log-container ${showTopShadow ? "has-top-shadow" : ""} ${showBottomShadow ? "has-bottom-shadow" : ""}`}
    >
      <div
        className={`activity-log-top-shadow ${showTopShadow ? "visible" : ""}`}
        aria-hidden="true"
      />
      <div
        className={`activity-log-bottom-shadow ${showBottomShadow ? "visible" : ""}`}
        aria-hidden="true"
      />
      <div
        ref={listRef}
        onScroll={checkScroll}
        className={`activity-list scrollable ${compact ? "compact" : ""}`}
        aria-live="polite"
      >
        {events.map((e, idx) => {
          const isLatest = idx === events.length - 1 && isBrowsing;
          if (compact) {
            return (
              <div
                key={e.id}
                className={`activity-item compact ${e.kind === "error" ? "error" : ""}`}
              >
                <span className={`activity-bullet ${isLatest ? "current" : ""}`}>
                  <Circle size={6} fill="currentColor" />
                </span>
                <div className="activity-compact-body">
                  <p className="activity-text" title={e.message}>
                    {e.message}
                  </p>
                  <time className="activity-time">
                    {new Date(e.time).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </time>
                </div>
              </div>
            );
          }

          return (
            <div
              key={e.id}
              className={`activity-item ${e.kind === "error" ? "error" : ""}`}
            >
              <span className={`activity-bullet ${isLatest ? "current" : ""}`}>
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
          );
        })}
      </div>
    </div>
  );
}

export function AgentPanel({
  state,
  activeMarket,
  setActiveMarket,
  onConnect,
  onExpand,
  isCollapsed,
  style,
  decisionPaused,
  resumedSearching,
  onKeepGoing,
  onStopSearch,
  onPlayAgent,
  onPauseAgent,
}: {
  state: SearchState | null;
  activeMarket: Marketplace | "all";
  setActiveMarket: (m: Marketplace | "all") => void;
  onConnect: () => void;
  onExpand?: () => void;
  isCollapsed?: boolean;
  style?: CSSProperties;
  decisionPaused?: boolean;
  resumedSearching?: boolean;
  onKeepGoing?: () => void;
  onStopSearch?: () => void;
  onPlayAgent?: (market: Marketplace) => void;
  onPauseAgent?: (market: Marketplace) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const isAnySearching =
    state?.runs.some((r) => r.status === "searching") || false;
  const singleRun =
    activeMarket === "all"
      ? undefined
      : state?.runs.find((r) => r.marketplace === activeMarket);
  const isSingleBrowsing = singleRun?.status === "searching";
  const singleListings =
    activeMarket === "all"
      ? []
      : state?.listings.filter((l) => l.marketplace === activeMarket) || [];
  const singleEvents =
    activeMarket === "all"
      ? []
      : state?.events
          .filter((e) => !e.marketplace || e.marketplace === activeMarket) || [];

  const mainStatus =
    activeMarket === "all"
      ? isAnySearching
        ? "Working"
        : state?.runs.some((r) => r.status === "login_required")
          ? "Paused"
          : "Ready"
      : isSingleBrowsing
        ? "Working"
        : singleRun?.status === "login_required"
          ? "Paused"
          : "Ready";

  const showAuthWarning =
    activeMarket === "all"
      ? state?.runs.some((r) => r.status === "login_required")
      : singleRun?.status === "login_required";

  return (
    <aside
      className="agent-panel"
      style={style}
      onClick={isCollapsed ? onExpand : undefined}
      title={isCollapsed ? "Click to expand agent preview" : undefined}
    >
      <div className="agent-panel-inner">
        <div className="agent-header">
          <div className="agent-header-left">
            {decisionPaused || resumedSearching || isAnySearching ? (
              <KeepGoingStopButton
                decisionPaused={decisionPaused}
                resumedSearching={resumedSearching}
                isSearching={isAnySearching}
                onKeepGoing={onKeepGoing}
                onStopSearch={onStopSearch}
                className="agent-keep-going-btn"
              />
            ) : (
              <span
                className={`status-pill ${
                  mainStatus === "Working" ? "active" : ""
                }`}
              >
                {mainStatus === "Working" ? (
                  <Play
                    size={8}
                    fill="currentColor"
                    className="status-square-icon"
                  />
                ) : mainStatus === "Paused" ? (
                  <Pause
                    size={8}
                    fill="currentColor"
                    className="status-square-icon"
                  />
                ) : (
                  <Square
                    size={7}
                    fill="currentColor"
                    className="status-square-icon"
                  />
                )}
                {mainStatus}
              </span>
            )}
            <h2 className="agent-header-title">
              {activeMarket === "all"
                ? "Concurrent agents preview"
                : "Your haggler agent preview"}
            </h2>
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

        {/* Agent Previews */}
        {activeMarket === "all" ? (
          <div className="all-previews-grid">
            {MARKETS.map((m) => {
              const mRun = state?.runs.find((r) => r.marketplace === m);
              const mListings =
                state?.listings.filter((l) => l.marketplace === m) || [];
              const mBrowsing = mRun?.status === "searching";
              return (
                <MarketBrowserCard
                  key={m}
                  market={m}
                  state={state}
                  run={mRun}
                  listings={mListings}
                  browsing={mBrowsing}
                  compact={true}
                  onPlay={onPlayAgent}
                  onPause={onPauseAgent}
                />
              );
            })}
          </div>
        ) : (
          <MarketBrowserCard
            market={activeMarket}
            state={state}
            run={singleRun}
            listings={singleListings}
            browsing={isSingleBrowsing}
            compact={false}
            onPlay={onPlayAgent}
            onPause={onPauseAgent}
          />
        )}

        {showAuthWarning && (
          <button className="connection-warning" onClick={onConnect}>
            Sign in to continue <ArrowUpRight size={15} />
          </button>
        )}

        {/* Activity Logs */}
        {activeMarket === "all" ? (
          <div className="activity-log-section all-activity-section">
            <div className="activity-log-heading">
              ACTIVITY LOGS · 3 PARALLEL AGENTS
            </div>
            <div className="all-activity-grid">
              {MARKETS.map((m) => {
                const mEvents =
                  state?.events.filter((e) => !e.marketplace || e.marketplace === m) || [];
                const mRun = state?.runs.find((r) => r.marketplace === m);
                const isMBrowsing = mRun?.status === "searching";
                const config = MARKET_CONFIG[m];
                const mListings =
                  state?.listings.filter((l) => l.marketplace === m) || [];
                return (
                  <div key={m} className="activity-column">
                    <div className="activity-column-header">
                      <div className="activity-column-title">
                        <PlatformLogo market={m} size={13} />
                        <span>{config.label}</span>
                      </div>
                      <span
                        className={`activity-column-status ${
                          mRun?.status || "ready"
                        }`}
                      >
                        {mRun?.status === "searching"
                          ? "Live"
                          : mRun?.status === "complete"
                            ? `${mListings.length} found`
                            : mRun?.status === "paused"
                              ? "Paused"
                              : mRun?.status === "login_required"
                                ? "Auth"
                                : "Ready"}
                      </span>
                    </div>
                    <ActivityLogView
                      events={mEvents}
                      compact={true}
                      isBrowsing={isMBrowsing}
                      placeholderCount={2}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="activity-log-section">
            <div className="activity-log-heading">ACTIVITY LOG</div>
            <ActivityLogView
              events={singleEvents}
              isBrowsing={isSingleBrowsing}
              placeholderCount={3}
            />
          </div>
        )}
      </div>

      {/* Expanded Modal (95% of window) */}
      <Modal
        open={expanded}
        onOpenChange={setExpanded}
        title="Agent browser preview"
        className="agent-preview-modal"
        headerActions={
          <KeepGoingStopButton
            decisionPaused={decisionPaused}
            resumedSearching={resumedSearching}
            isSearching={isAnySearching}
            onKeepGoing={onKeepGoing}
            onStopSearch={onStopSearch}
            className="popup-keep-going-btn"
          />
        }
        description={
          activeMarket === "all"
            ? "Concurrent marketplace browsing sessions across Facebook, eBay, and Kijiji"
            : state?.demo
              ? "Simulated marketplace browsing session"
              : "Live Steel cloud browser session"
        }
      >
        <div className="agent-preview-modal-body">
          <div className="agent-market-tabs modal-market-tabs">
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

          {activeMarket === "all" ? (
            <div className="modal-all-container">
              <div className="all-previews-grid in-modal">
                {MARKETS.map((m) => {
                  const mRun = state?.runs.find((r) => r.marketplace === m);
                  const mListings =
                    state?.listings.filter((l) => l.marketplace === m) || [];
                  const mBrowsing = mRun?.status === "searching";
                  return (
                    <MarketBrowserCard
                      key={m}
                      market={m}
                      state={state}
                      run={mRun}
                      listings={mListings}
                      browsing={mBrowsing}
                      compact={false}
                      isExpandedModal={true}
                      onPlay={onPlayAgent}
                      onPause={onPauseAgent}
                    />
                  );
                })}
              </div>

              <div className="activity-log-section all-activity-section modal-activity">
                <div className="activity-log-heading">
                  ACTIVITY LOGS · ALL AGENTS
                </div>
                <div className="all-activity-grid in-modal">
                  {MARKETS.map((m) => {
                    const mEvents =
                      state?.events.filter((e) => !e.marketplace || e.marketplace === m) || [];
                    const mRun = state?.runs.find((r) => r.marketplace === m);
                    const isMBrowsing = mRun?.status === "searching";
                    const config = MARKET_CONFIG[m];
                    const mListings =
                      state?.listings.filter((l) => l.marketplace === m) || [];
                    return (
                      <div key={m} className="activity-column">
                        <div className="activity-column-header">
                          <div className="activity-column-title">
                            <PlatformLogo market={m} size={14} />
                            <span>{config.label}</span>
                          </div>
                          <span
                            className={`activity-column-status ${
                              mRun?.status || "ready"
                            }`}
                          >
                            {mRun?.status === "searching"
                              ? "Live"
                              : mRun?.status === "complete"
                                ? `${mListings.length} found`
                                : mRun?.status === "paused"
                                  ? "Paused"
                                  : mRun?.status === "login_required"
                                    ? "Auth"
                                    : "Ready"}
                          </span>
                        </div>
                        <ActivityLogView
                          events={mEvents}
                          compact={true}
                          isBrowsing={isMBrowsing}
                          placeholderCount={2}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <MarketBrowserCard
              market={activeMarket}
              state={state}
              run={singleRun}
              listings={singleListings}
              browsing={isSingleBrowsing}
              compact={false}
              isExpandedModal={true}
              onPlay={onPlayAgent}
              onPause={onPauseAgent}
            />
          )}
        </div>
      </Modal>
    </aside>
  );
}
