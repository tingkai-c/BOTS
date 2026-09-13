"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
  useClerk,
} from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import {
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Command,
  Compass,
  History,
  ImagePlus,
  Info,
  Layers,
  ListFilter,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Play,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Truck,
  X,
} from "lucide-react";
import type {
  Marketplace,
  RankedListing,
  SearchState,
  StreamEvent,
} from "@/lib/schemas";
import { deduplicate, rankListings } from "@/lib/scoring";
import {
  readStream,
  readJsonResponse,
  RequestError,
} from "@/lib/client-stream";
import { photo } from "@/lib/demo/fixtures";
import { AgentPanel, BrowserView } from "./agent-panel";
import { ListingCard, MarketplaceBadge, DealScore, money } from "./listings";
import { NegotiationSetup, WorkspaceNegotiations, NegotiationObserver, startNegotiationFor } from './workspace-negotiations';
import { DealReviewModal } from './deal-review';
import { defaultNegotiationSettings } from '@/lib/negotiation/defaults';
import { PlatformLogo } from "./platform-logos";
import { Button } from "./ui/button";
import { Modal } from "./ui/dialog";
import { useShoppingAuth } from "./providers";

function AuthControl() {
  const { isSignedIn, isLoaded } = useUser();
  const clerk = useClerk();
  useEffect(() => {
    const open = () => {
      void clerk.openSignIn();
    };
    window.addEventListener("scout:sign-in", open);
    return () => window.removeEventListener("scout:sign-in", open);
  }, [clerk]);
  if (!isLoaded)
    return <span className="auth-loading" aria-label="Loading account" />;
  return isSignedIn ? (
    <UserButton />
  ) : (
    <div className="auth-controls">
      <SignInButton mode="modal">
        <Button variant="outline" size="sm" className="sign-in-btn">
          Log in
        </Button>
      </SignInButton>
      <SignUpButton mode="modal">
        <Button size="sm" className="sign-up-btn">
          Sign up
        </Button>
      </SignUpButton>
    </div>
  );
}

function LiveState({
  id,
  onState,
}: {
  id: string;
  onState: (s: SearchState) => void;
}) {
  const value = useQuery(makeFunctionReference<"query">("store:watch"), {
    id,
  }) as SearchState | null | undefined;
  useEffect(() => {
    if (value) onState(value);
  }, [value, onState]);
  return null;
}

const examples = [
  {
    query: "Sony WH-1000XM5 under $250",
    label: "Sony WH-1000XM5",
    detail: "Great sound. Better price.",
    price: "UNDER $250",
    image: "photo-1546435770-a3e426bf472b",
    className: "headphones",
  },
  {
    query: "Herman Miller Aeron near me",
    label: "Herman Miller Aeron",
    detail: "Upgrade your workday.",
    price: "FIND IT NEARBY",
    image: "photo-1592789705501-f9ae4278a2c9",
    className: "chair",
  },
  {
    query: "Fujifilm X100V camera",
    label: "Fujifilm X100V",
    detail: "A little less, for a lot more.",
    price: "FIND A BETTER DEAL",
    image: "photo-1516035069371-29a1b244cc32",
    className: "camera",
  },
];

const ALL_MARKETS: Marketplace[] = ["kijiji", "ebay", "facebook"];

const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  facebook: "Facebook",
  ebay: "eBay",
  kijiji: "Kijiji",
};

const MARKETPLACE_FULL_NAMES: Record<Marketplace, string> = {
  facebook: "Facebook Marketplace",
  ebay: "eBay",
  kijiji: "Kijiji",
};

export function ShoppingApp({
  demo,
  initialId,
}: {
  demo: boolean;
  initialId?: string;
}) {
  const account = useShoppingAuth();
  const [query, setQuery] = useState("");
  const [image, setImage] = useState<string>();
  const [imageName, setImageName] = useState("");
  const [state, setState] = useState<SearchState | null>(null);
  const [requestBusy, setBusy] = useState(false);
  const busy=requestBusy||Boolean(state&&!state.demo&&['queued','searching','ranking'].includes(state.status));
  const [error, setError] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [condition, setCondition] = useState("any");
  const [market, setMarket] = useState("all");
  const [location, setLocation] = useState("Toronto");
  const [radius, setRadius] = useState(25);
  const [filters, setFilters] = useState(false);
  const [sort, setSort] = useState("best");
  const [activeMarket, setActiveMarket] = useState<Marketplace | "all">("all");
  const [mobileTab, setMobileTab] = useState("results");
  const [selectedSnapshot, setSelected] = useState<RankedListing | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState('listings');
  const [negotiatedIds,setNegotiatedIds]=useState<string[]>([]);
  const [currency, setCurrency] = useState('CAD');
  const [discoveryBusy, setDiscoveryBusy] = useState(false);
  const [negotiate, setNegotiate] = useState<RankedListing | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<"discover" | "saved" | "history">("discover");
  const [recentSearches, setRecentSearches] = useState<string[]>([
    "Sony WH-1000XM5 under $250",
    "Herman Miller Aeron near me",
    "Fujifilm X100V camera",
  ]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [connectionMarket, setConnectionMarket] = useState<Marketplace>("facebook");
  const [connectionUrl, setConnectionUrl] = useState("");
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [connected, setConnected] = useState(false);
  const [connectedMarkets, setConnectedMarkets] = useState<Record<Marketplace, boolean>>({
    facebook: false,
    ebay: false,
    kijiji: false,
  });
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [agentPanelWidth, setAgentPanelWidth] = useState<number | null>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Decision gate state
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionListings, setDecisionListings] = useState<RankedListing[]>([]);
  const [decisionPaused, setDecisionPaused] = useState(false);
  const pauseRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  const roundStartCount = useRef(0);
  const lastResultAt = useRef(0);

  const isMarketConnected = (m: Marketplace) =>
    m === "facebook" ? connectedMarkets.facebook || connected : connectedMarkets[m];

  const toAddMarkets = ALL_MARKETS.filter((m) => !isMarketConnected(m));
  const addedMarkets = ALL_MARKETS.filter((m) => isMarketConnected(m));
  const [inspecting, setInspecting] = useState(false);
  const [inspectUrl, setInspectUrl] = useState("");
  const [inspectText, setInspectText] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    // Only trigger on the divider bar itself, not the toggle button
    if ((e.target as HTMLElement).closest('.panel-toggle-btn')) return;
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    const workspace = workspaceRef.current;
    const currentWidth = agentPanelWidth ??
      (workspace ? workspace.offsetWidth * 0.42 : 420);
    dragStartWidth.current = currentWidth;
    document.body.classList.add('is-resizing');

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = dragStartX.current - ev.clientX; // dragging left expands agent panel
      const workspace = workspaceRef.current;
      const maxWidth = workspace ? workspace.offsetWidth * 0.70 : 800;
      const minWidth = 260;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, dragStartWidth.current + dx));
      setAgentPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.classList.remove('is-resizing');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [agentPanelWidth]);

  useEffect(() => {
    queueMicrotask(() => {
      if (initialId && demo) {
        try {
          const stored = sessionStorage.getItem(`scout:${initialId}`);
          if (stored) {
            const parsed = JSON.parse(stored) as SearchState;
            if (["queued", "searching", "ranking"].includes(parsed.status)) {
              parsed.status = "failed";
              parsed.events.push({
                id: `interrupted-${Date.now()}`,
                kind: "error",
                time: Date.now(),
                message: "This demo was interrupted. Search again to restart.",
              });
            }
            setState(parsed);
            setQuery(parsed.query);
            if (parsed.filters) {
              setMaxPrice(
                parsed.filters.maxPrice ? String(parsed.filters.maxPrice) : "",
              );
              setCondition(parsed.filters.condition);
              setMarket(parsed.filters.marketplace);
              setLocation(parsed.filters.location);
              setRadius(parsed.filters.radius);
              setCurrency(parsed.filters.currency??'USD');
            }
          } else
            setError(
              "This demo search is no longer available. Start a fresh search.",
            );
        } catch {
          setError("Could not restore this search. Start a new one.");
        }
      }
    });
  }, [initialId, demo]);

  useEffect(() => {
    if (state?.demo)
      try {
        sessionStorage.setItem(`scout:${state.id}`, JSON.stringify(state));
      } catch {}
  }, [state]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      abort.current?.abort();
    };
  }, []);

  // Decision gate: fire when 5 new results arrive in this round OR 10 s elapse with no new result
  useEffect(() => {
    if (decisionOpen) return; // already showing
    const ranked = rankListings(state?.listings || []);
    const current = ranked.length;
    if (current === 0) return;
    // track the timestamp of the most recent listing
    lastResultAt.current = Date.now();
    // 5-result trigger
    const newThisRound = current - roundStartCount.current;
    if (newThisRound >= 5) {
      if (!pauseRef.current) {
        let res: () => void = () => {};
        const p = new Promise<void>((r) => { res = r; });
        pauseRef.current = { promise: p, resolve: res };
      }
      setDecisionPaused(true);
      setDecisionListings(ranked.slice(0, 5));
      setDecisionOpen(true);
      return;
    }
    // 10-second idle trigger — only while an active search is running
    const isActive = Boolean(state && ['queued','searching','ranking'].includes(state.status));
    if (!isActive) return;
    const id = setInterval(() => {
      if (Date.now() - lastResultAt.current >= 10_000 && !decisionOpen) {
        const snap = rankListings(state?.listings || []);
        if (snap.length > 0) {
          if (!pauseRef.current) {
            let res: () => void = () => {};
            const p = new Promise<void>((r) => { res = r; });
            pauseRef.current = { promise: p, resolve: res };
          }
          setDecisionPaused(true);
          setDecisionListings(snap.slice(0, 5));
          setDecisionOpen(true);
        }
      }
    }, 1_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.listings?.length, state?.status]);

  const restoredId = useRef<string | null>(null);
  const updateLive = useCallback((s: SearchState) => {
    setState(s);
    if (restoredId.current !== s.id) {
      restoredId.current = s.id;
      setQuery(s.query);
      if (s.filters) {
        setMaxPrice(s.filters.maxPrice ? String(s.filters.maxPrice) : "");
        setCondition(s.filters.condition);
        setMarket(s.filters.marketplace);
        setLocation(s.filters.location);
        setRadius(s.filters.radius);
        setCurrency(s.filters.currency??'USD');
      }
    }
  }, []);

  const applyEvent = async (event: StreamEvent) => {
    if (pauseRef.current) {
      await pauseRef.current.promise;
    }
    if (event.type === "state") {
      setState(event.state);
      restoredId.current = event.state.id;
      if (event.state.filters) {
        setMaxPrice(event.state.filters.maxPrice ? String(event.state.filters.maxPrice) : "");
        setCondition(event.state.filters.condition);
        setMarket(event.state.filters.marketplace);
        setLocation(event.state.filters.location);
        setRadius(event.state.filters.radius);
        setCurrency(event.state.filters.currency ?? "USD");
      }
      window.history.replaceState(null, "", `/search/${event.state.id}`);
      return;
    }
    if (event.type === "error") {
      setError(event.message);
      return;
    }
    setState((s) => {
      if (!s) return s;
      switch (event.type) {
        case "listing":
          return { ...s, listings: deduplicate(s.listings, event.listing) };
        case "event":
          return {
            ...s,
            events: s.events.some((e) => e.id === event.event.id)
              ? s.events
              : [...s.events, event.event],
          };
        case "run":
          return {
            ...s,
            runs: s.runs.map((r) =>
              r.marketplace === event.run.marketplace ? event.run : r,
            ),
          };
        case "status":
          return { ...s, status: event.status };
        case "identification":
          return { ...s, identification: event.identification };
        case "summary":
          return { ...s, summary: event.text };
        default:
          return s;
      }
    });
  };

  const handleKeepGoing = useCallback(() => {
    if (pauseRef.current) {
      pauseRef.current.resolve();
      pauseRef.current = null;
    }
    setDecisionPaused(false);
    roundStartCount.current = state?.listings?.length || 0;
    lastResultAt.current = Date.now();
    setDecisionOpen(false);
  }, [state?.listings?.length]);

  async function search(text = query) {
    if (busy || (!text.trim() && !image)) return;
    if (pauseRef.current) {
      pauseRef.current.resolve();
      pauseRef.current = null;
    }
    setDecisionPaused(false);
    setQuery(text);
    if (text.trim()) {
      setRecentSearches((prev) => [text.trim(), ...prev.filter((q) => q !== text.trim())].slice(0, 8));
    }
    if (account.required && !account.signedIn) {
      setError(
        account.loaded
          ? "Sign in to use your shopping agent."
          : "Your account is loading. Please try again in a moment.",
      );
      if (account.loaded) account.openSignIn();
      return;
    }
    setBusy(true);
    setError("");
    setSavedOnly(false);
    setActiveTab("discover");
    setSelected(null);
    setState(null);
    setDecisionOpen(false);
    roundStartCount.current = 0;
    lastResultAt.current = Date.now();
    setActiveMarket(
      market === "ebay" ? "ebay" : market === "kijiji" ? "kijiji" : market === "facebook" ? "facebook" : "all",
    );
    abort.current = new AbortController();
    try {
      await readStream<StreamEvent>(
        await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            image,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            condition,
            marketplace: market,
            location,
            radius,
            currency,
          }),
          signal: abort.current.signal,
        }),
        applyEvent,
      );
    } catch (e) {
      if (e instanceof RequestError) {
        if (e.status === 401) {
          setError(
            account.loaded
              ? "Sign in to use your shopping agent."
              : "Account check failed. Try again in a moment.",
          );
          if (account.loaded) account.openSignIn();
        } else setError(e.message);
      } else if (e instanceof Error && e.name !== "AbortError") {
        setError(e.message || "Could not complete search.");
      }
    } finally {
      const activePause = pauseRef.current as { resolve: () => void } | null;
      if (activePause) {
        activePause.resolve();
        pauseRef.current = null;
      }
      setDecisionPaused(false);
      setBusy(false);
    }
  }

  async function upload(f?: File) {
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setError("Choose a JPG, PNG, or WebP photo.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("Photos must be under 5 MB.");
      return;
    }
    setError("");
    setImageName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      if (!query) void identifyImage(reader.result as string);
    };
    reader.readAsDataURL(f);
  }

  async function identifyImage(dataUrl: string) {
    try {
      const { identification } = await readJsonResponse<{
        identification: { productName: string };
      }>(
        await fetch("/api/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        }),
      );
      if (identification?.productName && !query)
        setQuery(identification.productName);
    } catch {}
  }

  async function inspect(listing: RankedListing) {
    setInspecting(true);
    setInspectText("");
    setInspectUrl("");
    try {
      await readStream<{
        debugUrl?: string;
        description?: string;
        error?: string;
      }>(
        await fetch("/api/inspect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(listing),
        }),
        (e) => {
          if (e.error) throw new Error(e.error);
          if (e.debugUrl) setInspectUrl(e.debugUrl);
          if (e.description) setInspectText(e.description);
        },
      );
    } catch (e) {
      setInspectText(
        e instanceof Error
          ? e.message
          : "Could not complete agent inspection.",
      );
    } finally {
      setInspecting(false);
    }
  }

  async function connect(action: "open" | "save" | "cancel") {
    setConnectionBusy(true);
    setConnectionError("");
    try {
      const data = await readJsonResponse<{
        debugUrl?: string;
        connected?: boolean;
        demo?: boolean;
      }>(
        await fetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketplace: connectionMarket,
            action,
          }),
        }),
      );
      if (data.debugUrl) setConnectionUrl(data.debugUrl);
      if (data.connected || data.demo) {
        setConnected(true);
        setConnectedMarkets((prev) => ({
          ...prev,
          [connectionMarket]: true,
          facebook: true,
        }));
        setConnectionUrl("");
        setConnectionOpen(false);
      }
      if (action === "cancel") {
        setConnectionUrl("");
        setConnectionOpen(false);
      }
    } catch (e) {
      setConnectionError(
        e instanceof Error ? e.message : "Connection failed. Please retry.",
      );
    } finally {
      setConnectionBusy(false);
    }
  }

  function disconnectMarket(marketToDisconnect: Marketplace) {
    setConnectionBusy(true);
    try {
      setConnectedMarkets((prev) => ({
        ...prev,
        [marketToDisconnect]: false,
      }));
      if (marketToDisconnect === "facebook") {
        setConnected(false);
      }
    } finally {
      setConnectionBusy(false);
    }
  }

  const ranked = rankListings(state?.listings || []);
  const selected=ranked.find(l=>l.id===selectedSnapshot?.id)??selectedSnapshot;
  const topFacebookDeals = ranked.filter((l) => l.marketplace === "facebook").slice(0, 5);
  useEffect(() => {
    if (!state || reviewShownFor === state.id || topFacebookDeals.length === 0) return;
    // Facebook discovery can keep scrolling up new listings indefinitely (no cumulative cap in
    // lib/agents/discovery.ts), so state.status can stay 'searching' forever — don't gate the
    // review on full completion. Show it as soon as there's a full 5 to review, or once the
    // search settles one way or another with at least one Facebook listing.
    const searchSettled = state.status === "complete" || state.status === "failed";
    if (searchSettled || topFacebookDeals.length >= 5) {
      setReviewShownFor(state.id);
      setReviewDecisions({});
      setReviewErrors({});
      setReviewOpen(true);
    }
  }, [state, reviewShownFor, topFacebookDeals.length]);
  async function likeDeal(listing: RankedListing) {
    setReviewBusyId(listing.id);
    setReviewErrors((e) => { const next = { ...e }; delete next[listing.id]; return next; });
    try {
      await startNegotiationFor(listing, defaultNegotiationSettings(listing));
      setReviewDecisions((d) => ({ ...d, [listing.id]: "liked" }));
      setNegotiatedIds((ids) => [...new Set([...ids, listing.id])]);
    } catch (e) {
      setReviewErrors((err) => ({ ...err, [listing.id]: (e as Error).message }));
    } finally {
      setReviewBusyId(null);
    }
  }
  function rejectDeal(listing: RankedListing) {
    setReviewDecisions((d) => ({ ...d, [listing.id]: "rejected" }));
  }
  async function findMore(listingId?:string){if(!state)return;setDiscoveryBusy(true);try{const result=await readJsonResponse<{demo?:boolean}>(await fetch('/api/workspace/discovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspaceId:state.id,listingId})}));if(result.demo)setError('Demo mode has no additional marketplace results.');}catch(e){setError((e as Error).message);}finally{setDiscoveryBusy(false);}}
  let listings = ranked.filter(
    (l) =>
      (market === "all" || l.marketplace === market) &&
      (!maxPrice || l.price <= Number(maxPrice)) &&
      (condition === "any" || l.condition === condition) &&
      (!savedOnly || saved.includes(l.id)),
  );
  if (sort === "price")
    listings = [...listings].sort(
      (a, b) =>
        a.price + (a.shippingCost ?? 0) - (b.price + (b.shippingCost ?? 0)),
    );
  if (sort === "newest")
    listings = [...listings].sort((a, b) => b.scrapedAt - a.scrapedAt);
  const best = listings[0];
  const filteredOutCount = Math.max(0, ranked.length - listings.length);

  return (
    <div className="app-shell">
      {state&&<NegotiationObserver id={state.id} demo={state.demo} onIds={setNegotiatedIds}/>}
      {!demo &&
        (state?.id || initialId) &&
        process.env.NEXT_PUBLIC_CONVEX_URL &&
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && (
          <LiveState id={state?.id || initialId!} onState={updateLive} />
        )}

      <header className="topnav">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Search size={19} />
            <i />
          </span>
          haggleface<span className="brand-dot">.</span>
        </a>

        <div className="nav-right">
          {demo && (
            <span className="demo-badge">
              <i />
              Demo mode
            </span>
          )}

          <button
            type="button"
            className="info-icon-btn"
            aria-label="About Haggleface"
            onClick={() => setInfoOpen(true)}
          >
            <Info size={16} />
          </button>

          <div className="nav-vdivider" />

          {/* Platform Connections Widget */}
          <div className="platform-connections-widget">
            {toAddMarkets.length > 0 && (
              <div
                className="market-connect-capsule"
                role="group"
                aria-label="Marketplaces to add"
              >
                {toAddMarkets.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="market-capsule-item"
                    onClick={() => {
                      setConnectionMarket(m);
                      setConnectionOpen(true);
                    }}
                    aria-label={
                      m === "facebook"
                        ? "Connect Facebook"
                        : `Connect ${m === "ebay" ? "eBay" : "Kijiji"}`
                    }
                    title={`Connect ${
                      m === "facebook"
                        ? "Facebook Marketplace"
                        : m === "ebay"
                          ? "eBay"
                          : "Kijiji"
                    }`}
                  >
                    <PlatformLogo market={m} size={18} />
                  </button>
                ))}
                <button
                  type="button"
                  className="capsule-symbol-btn"
                  onClick={() => {
                    setConnectionMarket(toAddMarkets[0]);
                    setConnectionOpen(true);
                  }}
                  aria-label="Add marketplace"
                  title="Add marketplace"
                >
                  <Plus size={12} className="capsule-symbol" />
                </button>
              </div>
            )}

            {addedMarkets.length > 0 && (
              <div
                className="market-connect-capsule connected"
                role="group"
                aria-label="Connected marketplaces"
              >
                {addedMarkets.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="market-capsule-item"
                    onClick={() => {
                      setConnectionMarket(m);
                      setConnectionOpen(true);
                    }}
                    aria-label={
                      m === "facebook"
                        ? `${demo ? "Demo · " : ""}Connected`
                        : `Connected: ${m === "ebay" ? "eBay" : "Kijiji"}`
                    }
                    title={`Connected: ${
                      m === "facebook"
                        ? "Facebook Marketplace"
                        : m === "ebay"
                          ? "eBay"
                          : "Kijiji"
                    }`}
                  >
                    <PlatformLogo market={m} size={18} />
                  </button>
                ))}
                <span className="capsule-symbol-box" aria-hidden="true">
                  <Check size={12} className="capsule-symbol check" />
                </span>
              </div>
            )}
          </div>

          <div className="nav-vdivider" />

          {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
            <AuthControl />
          ) : (
            <button
              className="avatar"
              aria-label="Open profile"
              onClick={() => setProfileOpen(true)}
            >
              J
            </button>
          )}
        </div>
      </header>

      <main>
        <section className="search-section">
          <div className="search-heading">
            <h1>
              {state
                ? "Let’s find your next great deal."
                : "What are you looking for?"}
            </h1>
          </div>

          <form
            className="search-form"
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void upload(e.dataTransfer.files[0]);
            }}
          >
            <Search size={20} className="search-input-icon" />
            <input
              ref={input}
              aria-label="What are you looking for?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try ‘Sony WH-1000XM5 under $250’"
              maxLength={300}
            />
            <kbd className="search-shortcut">
              <Command size={10} /> K
            </kbd>

            <button
              type="button"
              className="image-upload-button"
              aria-label="Upload a product image"
              onClick={() => file.current?.click()}
            >
              <ImagePlus size={19} />
            </button>
            <input
              ref={file}
              className="visually-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Product image file"
              onChange={(e) => void upload(e.target.files?.[0])}
            />

            <Button
              type="submit"
              aria-label="Find it"
              disabled={busy || (!query.trim() && !image)}
              className="search-submit-btn"
            >
              {busy && <Loader2 size={15} className="spin" />}
              <span>{busy ? "Searching" : "Find"}</span>
              {!busy && <ArrowRight size={15} />}
            </Button>
          </form>

          {image && (
            <div className="image-preview">
              <img src={image} alt="Uploaded product" />
              <div>
                <strong>{imageName}</strong>
                <span>
                  Photo ready · add a description or search with this image
                </span>
              </div>
              <button
                aria-label="Remove image"
                onClick={() => {
                  setImage(undefined);
                  setImageName("");
                  if (file.current) file.current.value = "";
                }}
              >
                <X size={15} />
              </button>
            </div>
          )}

          <div className="search-filters">
            <label className="compact-filter">Currency<select aria-label="Currency filter" value={currency} onChange={e=>setCurrency(e.target.value)}><option value="USD">USD</option><option value="CAD">CAD</option></select></label>
            <label className="compact-filter">
              <SlidersHorizontal size={13} />
              <select
                aria-label="Marketplace filter"
                value={market}
                onChange={(e) => setMarket(e.target.value)}
              >
                <option value="all">All marketplaces</option>
                <option value="facebook">Facebook</option>
                <option value="ebay">eBay</option>
                <option value="kijiji">Kijiji</option>
              </select>
              <ChevronDown size={11} className="filter-dropdown-icon" />
            </label>

            <label className="compact-filter price-filter">
              <span className="price-tag-symbol">$</span>
              <input
                aria-label="Maximum price"
                type="number"
                min="1"
                placeholder="Any price"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </label>

            <label className="compact-filter">
              <ListFilter size={13} />
              <select
                aria-label="Condition filter"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              >
                <option value="any">Any condition</option>
                <option value="Like new">Like new</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
              </select>
              <ChevronDown size={11} className="filter-dropdown-icon" />
            </label>

            <button
              type="button"
              className="compact-filter location-btn"
              onClick={() => setFilters(!filters)}
            >
              <MapPin size={13} />
              <span>{location}</span>
              <ChevronDown size={11} className="filter-dropdown-icon" />
            </button>
          </div>

          {filters && (
            <div className="location-popover">
              <label>
                Location
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={80}
                />
              </label>
              <label>
                Radius
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                >
                  <option value={10}>10 miles</option>
                  <option value={25}>25 miles</option>
                  <option value={50}>50 miles</option>
                </select>
              </label>
              <p>
                Used to find eBay and Kijiji listings near you. Facebook
                Marketplace uses your connected account’s location instead —
                set your city in its browser for accurate local results.
              </p>
              <Button size="sm" onClick={() => setFilters(false)}>
                Done
              </Button>
            </div>
          )}

          {error && (
            <div className="error-state" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={15} />
              </button>
            </div>
          )}
        </section>
        {state&&<div className="workspace-tabs" role="tablist" aria-label="Workspace views" onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=workspaceTab==='listings'?'negotiations':'listings';setWorkspaceTab(next);(e.currentTarget.querySelectorAll('[role="tab"]')[next==='listings'?0:1] as HTMLButtonElement).focus();}}}><Button role="tab" aria-selected={workspaceTab==='listings'} onClick={()=>setWorkspaceTab('listings')}>Listings</Button><Button role="tab" aria-selected={workspaceTab==='negotiations'} onClick={()=>setWorkspaceTab('negotiations')}>Negotiations</Button>{topFacebookDeals.length>0&&<Button variant="outline" onClick={()=>setReviewOpen(true)}>Top deals</Button>}<Button variant="outline" disabled={discoveryBusy||requestBusy} onClick={()=>void findMore()}>{discoveryBusy?'Queuing…':'Find more'}</Button></div>}
        {state&&workspaceTab==='negotiations'?<WorkspaceNegotiations workspaceId={state.id} listings={state.listings} demo={state.demo}/>:<>
        <div className="mobile-tabs">
          <button
            className={mobileTab === "results" ? "active" : ""}
            onClick={() => setMobileTab("results")}
          >
            Discover {listings.length > 0 && `(${listings.length})`}
          </button>
          <button
            className={mobileTab === "agent" ? "active" : ""}
            onClick={() => setMobileTab("agent")}
          >
            <Sparkles size={14} /> Live agent {busy && <i />}
          </button>
        </div>

        <div ref={workspaceRef} className={`workspace show-${mobileTab} ${panelCollapsed ? "panel-collapsed" : ""}`}>
          <section className="results-panel">
            <div className="results-nav">
              <div className="tab-pill-group">
                <button
                  type="button"
                  className={`tab-pill-btn ${activeTab === "discover" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("discover");
                    setSavedOnly(false);
                  }}
                >
                  <Compass size={15} />
                  <span>Discover{state && listings.length > 0 ? ` ${listings.length}` : ""}</span>
                </button>
                <button
                  type="button"
                  className={`tab-pill-btn ${activeTab === "saved" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("saved");
                    setSavedOnly(true);
                  }}
                >
                  <Bookmark size={15} />
                  <span>Saved{saved.length > 0 ? ` ${saved.length}` : ""}</span>
                </button>
                <button
                  type="button"
                  className={`tab-pill-btn ${activeTab === "history" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("history");
                    setSavedOnly(false);
                  }}
                >
                  <History size={15} />
                  <span>History</span>
                </button>
              </div>

              {state ? (
                <div className="results-nav-right">
                  {ranked.length >= 5 && (
                    <button
                      type="button"
                      className="decide-btn"
                      onClick={() => {
                        if (busy && !pauseRef.current) {
                          let res: () => void = () => {};
                          const p = new Promise<void>((r) => { res = r; });
                          pauseRef.current = { promise: p, resolve: res };
                          setDecisionPaused(true);
                        }
                        setDecisionListings(ranked.slice(0, 5));
                        setDecisionOpen(true);
                      }}
                      aria-label="Side-by-side comparison"
                    >
                      <Scale size={14} />
                      Decide
                    </button>
                  )}
                  <label className="sort-control">
                    <ArrowDownUp size={13} />
                    <select
                      aria-label="Sort listings"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="best">Best deals first</option>
                      <option value="price">Lowest total price</option>
                      <option value="newest">Recently found</option>
                    </select>
                  </label>
                </div>
              ) : null}
            </div>

            {activeTab === "history" ? (
              <div className="history-view">
                <div className="history-header">
                  <h3>Recent searches</h3>
                  <p>Pick up where you left off</p>
                </div>
                <div className="history-list">
                  {recentSearches.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="history-item-btn"
                      onClick={() => {
                        setActiveTab("discover");
                        void search(s);
                      }}
                    >
                      <Search size={14} className="history-icon" />
                      <span>{s}</span>
                      <ArrowRight size={14} className="history-arrow" />
                    </button>
                  ))}
                </div>
              </div>
            ) : !state && !busy && activeTab === "discover" ? (
              <div className="landing-results">
                <div className="start-heading">
                  <h2>A little inspiration to get started</h2>
                </div>

                <div className="inspiration-grid">
                  {examples.map((e) => (
                    <button
                      className={`inspiration-card ${e.className}`}
                      key={e.query}
                      onClick={() => void search(e.query)}
                    >
                      <div className="inspiration-image">
                        <img
                          src={photo(e.image)}
                          alt={e.label}
                          onError={(ev) => {
                            ev.currentTarget.src = "/product.svg";
                          }}
                        />
                        <span className="inspiration-action-btn">
                          <ArrowUpRight size={16} />
                        </span>
                      </div>
                      <div className="inspiration-copy">
                        <small>{e.price}</small>{" "}
                        <h3>{e.label}</h3>{" "}
                        <p>{e.detail}</p>
                      </div>
                    </button>
                  ))}
                </div>

              </div>
            ) : (
              <div className="search-results">
                {state?.identification && (
                  <div className="identification">
                    <span>
                      <Sparkles size={14} />
                    </span>
                    <div>
                      <strong>{state.identification.productName}</strong>
                      <p>
                        {state.demo
                          ? "Demo identification"
                          : `${Math.round(state.identification.confidence * 100)}% match confidence`}{" "}
                        ·{" "}
                        {state.identification.attributes
                          .filter((a) => !a.includes("Demo"))
                          .slice(0, 2)
                          .join(" · ") || "Searching your marketplaces"}
                      </p>
                    </div>
                    {state.identification.confidence < 0.8 && (
                      <span className="uncertain">
                        {state.demo ? "Sample" : "Check match"}
                      </span>
                    )}
                  </div>
                )}
                {state?.summary && (
                  <div className="agent-summary">
                    <Sparkles size={14} />
                    <p>{state.summary}</p>
                  </div>
                )}
                {best && (
                  <div className="result-summary">
                    <span>
                      {busy && !decisionPaused ? (
                        <>
                          <i className="working-dot" /> Finding your shortlist
                        </>
                      ) : (
                        <>
                          <ListFilter size={13} />
                          {filteredOutCount === 1
                            ? "1 result filtered out"
                            : `${filteredOutCount} results filtered out`}
                        </>
                      )}
                    </span>
                    <span>
                      From{" "}
                      <strong>
                        {money(
                          Math.min(
                            ...listings.map(
                              (l) => l.price + (l.shippingCost ?? 0),
                            ),
                          ), currency,
                        )}
                      </strong>{" "}
                      <i>·</i> {ranked.length} listings compared
                    </span>
                  </div>
                )}
                {listings.length ? (
                  <div className="listing-grid">
                    {listings.map((l, i) => (
                      <ListingCard
                        key={l.id}
                        listing={l}
                        index={i}
                        saved={saved.includes(l.id)}
                        onSave={() =>
                          setSaved((s) =>
                            s.includes(l.id)
                              ? s.filter((id) => id !== l.id)
                              : [...s, l.id],
                          )
                        }
                        onSelect={() => {
                          setSelected(l);
                          setInspectText("");
                          if(!l.demo&&!l.inspectedAt)void findMore(l.id);
                        }}
                        onNegotiate={() => negotiatedIds.includes(l.id)?setWorkspaceTab('negotiations'):setNegotiate(l)}
                      />
                    ))}
                  </div>
                ) : busy ? (
                  <div className="loading-results">
                    <div>
                      <Sparkles size={23} className="pulse" />
                      <h3>Your agent is on the hunt.</h3>
                      <p>Matches will appear here as soon as they’re found.</p>
                    </div>
                    <div className="skeleton-grid">
                      {[0, 1].map((i) => (
                        <div key={i}>
                          <i />
                          <span />
                          <span />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <Search size={31} />
                    <h3>
                      {savedOnly
                        ? "Your good finds, kept together."
                        : "No matches just yet."}
                    </h3>
                    <p>
                      {savedOnly
                        ? "Tap the heart on any listing to save it here."
                        : "Try a broader search, a higher budget, or another marketplace."}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSavedOnly(false);
                        setActiveTab("discover");
                        setMaxPrice("");
                        setCondition("any");
                        setMarket("all");
                        input.current?.focus();
                      }}
                    >
                      {savedOnly ? "Explore listings" : "Broaden filters"}
                    </Button>
                  </div>
                )}
                {state?.status === "failed" && (
                  <div className="error-state">
                    {state.events.filter((e) => e.kind === "error").at(-1)
                      ?.message || "The search could not finish."}
                    <button onClick={() => void search()}>Try again</button>
                  </div>
                )}
                {state?.demo && (
                  <p className="demo-results-note">
                    Sample listings for demonstration. Prices, sellers, and
                    availability are fictional.
                  </p>
                )}
              </div>
            )}
          </section>

          <div
            className="workspace-divider"
            onMouseDown={handleDividerMouseDown}
            role="separator"
            aria-label="Drag to resize panels"
            title="Drag to resize"
          >
            <button
              type="button"
              className="panel-toggle-btn"
              onClick={() => setPanelCollapsed(!panelCollapsed)}
              aria-label={panelCollapsed ? "Expand agent preview" : "Collapse agent preview"}
              title={panelCollapsed ? "Expand agent preview" : "Collapse agent preview"}
            >
              {panelCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>

          <AgentPanel
            state={state}
            activeMarket={activeMarket}
            setActiveMarket={setActiveMarket}
            onConnect={() => setConnectionOpen(true)}
            isCollapsed={panelCollapsed}
            onExpand={() => setPanelCollapsed(false)}
            decisionPaused={decisionPaused}
            onKeepGoing={handleKeepGoing}
            style={!panelCollapsed && agentPanelWidth ? { flex: `0 0 ${agentPanelWidth}px`, width: `${agentPanelWidth}px` } : undefined}
          />
        </div>
        </>}
      </main>

      <footer className="page-footer">
        <p className="footer-disclaimer">
          {"You're responsible to review your account interactions in Facebook Marketplace, ebay, and Kijiji"}
        </p>
        <span className="footer-brand">haggleface.</span>
      </footer>

      {/* Info / About Modal */}
      <Modal
        open={infoOpen}
        onOpenChange={setInfoOpen}
        title="About Haggleface"
        description="Autonomous AI shopping agents across secondhand marketplaces."
      >
        <div className="about-info-modal">
          <div className="about-info-block">
            <h4>Real Browser Automation</h4>
            <p>
              Haggleface powers searches across Facebook Marketplace, eBay, and Kijiji using isolated cloud browsers managed by Steel.dev.
            </p>
          </div>
          <div className="about-info-block">
            <h4>No Passwords Stored</h4>
            <p>
              You log in directly inside a secure Steel browser tab. Haggleface never stores, inspects, or transmits your account credentials.
            </p>
          </div>
          <div className="about-info-block">
            <h4>Total Control Over Deals</h4>
            <p>
              Your agent can analyze listings and draft negotiating offers, but no message is ever sent to a seller without your explicit review and approval.
            </p>
          </div>
          <Button onClick={() => setInfoOpen(false)}>Close</Button>
        </div>
      </Modal>

      {/* Listing Detail Modal */}
      <Modal
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
        title="A closer look"
        description="The details behind your next good find."
      >
        {selected && (
          <div className="listing-detail">
            <img
              className="detail-image"
              src={selected.imageUrls[0] || "/product.svg"}
              alt={selected.title}
            />
            <MarketplaceBadge marketplace={selected.marketplace} />
            <h3>{selected.title}</h3>
            <div className="detail-price">
              {money(selected.price,selected.currency)}
              <span>{selected.condition}</span>
            </div>
            <DealScore listing={selected} />
            <p>
              {selected.description ||
                "No description extracted yet. Inspect the original listing to learn more."}
            </p>
            {selected.inspectionStatus&&<p className="field-hint">Details: {selected.inspectionStatus}{selected.inspectionError?` · ${selected.inspectionError}`:''}</p>}
            <div className="detail-facts">
              <span>
                <span className="fact-label">Seller</span>
                <strong>{selected.sellerName || "Not listed"}</strong>
              </span>
              <span>
                <span className="fact-label">Location</span>
                <strong>{selected.location || "Not listed"}</strong>
              </span>
            </div>
            <div className="detail-actions">
              <Button
                onClick={() => {
                  if(negotiatedIds.includes(selected.id))setWorkspaceTab('negotiations');else setNegotiate(selected);
                  setSelected(null);
                }}
              >
                <Sparkles size={15} />
                {negotiatedIds.includes(selected.id)?'View negotiation':'Set up negotiation'}
              </Button>
              <Button
                variant="outline"
                disabled={inspecting}
                onClick={() => selected.demo?void inspect(selected):void findMore(selected.id)}
              >
                {inspecting ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <Search size={14} />
                )}
                Inspect with agent
              </Button>
              <a
                href={selected.listingUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {selected.demo ? "Browse marketplace" : "View original"}
                <ArrowUpRight size={14} />
              </a>
            </div>
            {inspectUrl && <BrowserView url={inspectUrl} />}
            {inspectText && (
              <div className="inspection-result">
                <strong>
                  {selected.demo ? "Demo inspection" : "Agent inspection"}
                </strong>
                <p>{inspectText}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Negotiation Modal */}
      <Modal
        open={!!negotiate}
        onOpenChange={(v) => {
          if (!v) setNegotiate(null);
        }}
        title="Make a good deal even better."
         description="Authorize an ongoing conversation within your limits. Pause or stop at any time."
      >
        {negotiate && (
          <NegotiationSetup key={negotiate.id} listing={negotiate} onStarted={()=>{setNegotiate(null);setWorkspaceTab('negotiations');}} />
        )}
      </Modal>

      {/* Deal Review Modal */}
      <DealReviewModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        listings={topFacebookDeals}
        decisions={reviewDecisions}
        busyId={reviewBusyId}
        errors={reviewErrors}
        onLike={(listing) => void likeDeal(listing)}
        onReject={rejectDeal}
        onConnect={() => {
          setReviewOpen(false);
          setConnectionMarket("facebook");
          setConnectionOpen(true);
        }}
      />

      {/* Connection Modal */}
      <Modal
        open={connectionOpen}
        onOpenChange={(v) => {
          if (!v && connectionUrl) void connect("cancel");
          else setConnectionOpen(v);
        }}
        title="Connect your marketplaces"
        description="Sign in directly in a secure Steel browser. Haggleface never sees or stores your password."
      >
        <div className="connection-panel">
          <div className="tone-options">
            {(["facebook", "ebay", "kijiji"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={!!connectionUrl || connectionBusy}
                onClick={() => setConnectionMarket(m)}
                className={`tone-market-tab ${connectionMarket === m ? "selected" : ""} ${isMarketConnected(m) ? "is-connected" : ""}`}
              >
                <MarketplaceBadge marketplace={m} />
                {isMarketConnected(m) && (
                  <span className="tab-connected-pill">
                    <Check size={10} />
                    Connected
                  </span>
                )}
              </button>
            ))}
          </div>

          {isMarketConnected(connectionMarket) ? (
            <div className="connection-card connected-state">
              <div className="connection-status-pill">
                <Check size={13} />
                <span>Account connected</span>
              </div>
              <div className="connection-status-icon-wrap">
                <PlatformLogo market={connectionMarket} size={40} />
              </div>
              <h3>{MARKETPLACE_FULL_NAMES[connectionMarket]}</h3>
              <p>
                {demo
                  ? "Your demo account profile is active. Automated searches and offers are enabled for this marketplace."
                  : "Your secure Steel browser session is active. Haggleface can search and draft offers on your behalf."}
              </p>
              <div className="connection-actions-row">
                <Button
                  variant="outline"
                  className="connection-logout-btn"
                  disabled={connectionBusy}
                  onClick={() => disconnectMarket(connectionMarket)}
                >
                  <LogOut size={14} />
                  <span>Log out of {MARKETPLACE_LABELS[connectionMarket]}</span>
                </Button>
                <Button
                  variant="outline"
                  className="connection-reconnect-btn"
                  disabled={connectionBusy}
                  onClick={() => void connect(demo ? "save" : "open")}
                >
                  <RefreshCw size={13} />
                  <span>Reconnect</span>
                </Button>
              </div>
            </div>
          ) : demo ? (
            <div className="connection-demo">
              <ShieldCheck size={36} className="connection-shield-icon" />
              <h3>Your account stays yours.</h3>
              <p>
                This is demo mode. Connecting simulates a saved marketplace
                profile. Add Steel, Clerk, and Convex credentials to sign in to
                a real account.
              </p>
              <Button
                className="connection-login-btn"
                disabled={connectionBusy}
                onClick={() => void connect("save")}
              >
                <LogIn size={15} />
                <span>Log in to {MARKETPLACE_LABELS[connectionMarket]}</span>
                <span className="btn-subtext">· Try demo connection</span>
                <ArrowRight size={14} />
              </Button>
            </div>
          ) : connectionUrl ? (
            <div className="connection-live-interactive">
              <BrowserView url={connectionUrl} interactive />
              <p className="field-hint">
                Finish signing in above, then save your browser profile.
                Sessions expire after 5 minutes.
              </p>
              <div className="connection-actions-row">
                <Button
                  className="connection-login-btn"
                  disabled={connectionBusy}
                  onClick={() => void connect("save")}
                >
                  {connectionBusy ? (
                    <Loader2 size={15} className="spin" />
                  ) : (
                    <Check size={15} />
                  )}
                  <span>I’m signed in · Save connection</span>
                </Button>
                <Button
                  variant="outline"
                  className="connection-cancel-btn"
                  disabled={connectionBusy}
                  onClick={() => void connect("cancel")}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="connection-live-init">
              <ShieldCheck size={36} className="connection-shield-icon" />
              <h3>Sign in to {MARKETPLACE_FULL_NAMES[connectionMarket]}</h3>
              <p>
                Sign in directly in an isolated Steel cloud browser. Haggleface
                never sees or stores your password.
              </p>
              <Button
                className="connection-login-btn"
                disabled={connectionBusy}
                onClick={() => void connect("open")}
              >
                {connectionBusy ? (
                  <Loader2 size={15} className="spin" />
                ) : (
                  <LogIn size={15} />
                )}
                <span>Log in to {MARKETPLACE_LABELS[connectionMarket]}</span>
                <span className="btn-subtext">· Open secure browser</span>
                <ArrowRight size={14} />
              </Button>
            </div>
          )}

          {connectionError && (
            <div className="error-state" role="alert">
              {connectionError}
            </div>
          )}
        </div>
      </Modal>

      {/* Profile Modal */}
      <Modal
        open={profileOpen}
        onOpenChange={setProfileOpen}
        title="Your workspace"
        description="Manage your account session and marketplace connections."
      >
        <div className="profile-panel">
          <span className="avatar large">J</span>
          <h3>Welcome, curious shopper.</h3>
          <p>
            Demo searches are saved in this browser tab. Configure Clerk to sign
            in and Convex to keep live searches across devices.
          </p>
          <div className="profile-actions">
            <Button
              variant="outline"
              onClick={() => {
                setProfileOpen(false);
                setConnectionOpen(true);
              }}
            >
              Manage marketplace connections
            </Button>
            <Button
              variant="outline"
              className="profile-logout-btn"
              onClick={() => {
                setConnected(false);
                setConnectedMarkets({
                  facebook: false,
                  ebay: false,
                  kijiji: false,
                });
                setProfileOpen(false);
              }}
            >
              <LogOut size={14} />
              <span>Log out of session</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Decision / Comparison Modal */}
      <DecisionModal
        open={decisionOpen}
        listings={decisionListings}
        negotiatedIds={negotiatedIds}
        busy={busy}
        decisionPaused={decisionPaused}
        onContinue={handleKeepGoing}
        onClose={() => setDecisionOpen(false)}
        onNegotiate={(l) => {
          setDecisionOpen(false);
          if (negotiatedIds.includes(l.id)) setWorkspaceTab('negotiations');
          else setNegotiate(l);
        }}
        onSelect={(l) => {
          setDecisionOpen(false);
          setSelected(l);
        }}
      />
    </div>
  );
}

function DecisionModal({
  open,
  listings,
  negotiatedIds,
  busy,
  decisionPaused,
  onContinue,
  onClose,
  onNegotiate,
  onSelect,
}: {
  open: boolean;
  listings: RankedListing[];
  negotiatedIds: string[];
  busy: boolean;
  decisionPaused: boolean;
  onContinue: () => void;
  onClose: () => void;
  onNegotiate: (l: RankedListing) => void;
  onSelect: (l: RankedListing) => void;
}) {
  const topListings = listings.slice(0, 5);
  const [viewMode, setViewMode] = useState<'compare' | 'single'>('compare');
  const [currentIndex, setCurrentIndex] = useState(0);

  const count = topListings.length;
  const prevCard = useCallback(() => {
    if (count > 0) setCurrentIndex((i) => (i - 1 + count) % count);
  }, [count]);

  const nextCard = useCallback(() => {
    if (count > 0) setCurrentIndex((i) => (i + 1) % count);
  }, [count]);

  useEffect(() => {
    if (!open || viewMode !== 'single') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevCard();
      else if (e.key === 'ArrowRight') nextCard();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, viewMode, prevCard, nextCard]);

  const currentListing = topListings[currentIndex] || topListings[0];

  return (
    <Modal
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title="Compare your shortlist"
      description={`Top ${topListings.length} scored listing${topListings.length !== 1 ? 's' : ''} — compare side-by-side or inspect single cards.`}
      className="decision-modal"
      headerActions={
        decisionPaused ? (
          <button
            type="button"
            className="keep-going-btn popup-keep-going-btn"
            onClick={onContinue}
            aria-label="Keep going"
          >
            <Play size={11} fill="currentColor" />
            Keep going
          </button>
        ) : null
      }
    >
      <div className="decision-toolbar">
        <div className="decision-view-toggle">
          <button
            type="button"
            className={`toggle-option ${viewMode === 'compare' ? 'active' : ''}`}
            onClick={() => setViewMode('compare')}
            aria-label="Compare all side-by-side"
          >
            <Columns3 size={13} />
            <span>Compare all</span>
          </button>
          <button
            type="button"
            className={`toggle-option ${viewMode === 'single' ? 'active' : ''}`}
            onClick={() => setViewMode('single')}
            aria-label="Single card view"
          >
            <Layers size={13} />
            <span>Single card</span>
          </button>
        </div>
      </div>

      <div className="decision-modal-body">
        {viewMode === 'compare' ? (
          <div className="decision-table-wrap">
            <table className="decision-table">
              <thead>
                <tr className="decision-row-item">
                  <th className="decision-aspect-th decision-aspect-th-corner">
                    <span className="aspect-title">Item</span>
                  </th>
                  {topListings.map((l, i) => (
                    <th key={l.id} className="decision-col-th">
                      <div className="decision-col-card-head">
                        <span className="decision-rank-badge">#{i + 1}</span>
                        <button
                          className="decision-col-image-btn"
                          onClick={() => onSelect(l)}
                          aria-label={`View ${l.title}`}
                        >
                          <img
                            src={l.imageUrls[0] || '/product.svg'}
                            alt={l.title}
                            onError={(e) => { e.currentTarget.src = '/product.svg'; }}
                          />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="decision-row-aspect decision-row-title">
                  <th className="decision-aspect-th">
                    <span className="aspect-title">Title</span>
                  </th>
                  {topListings.map((l) => (
                    <td key={l.id} className="decision-col-td">
                      <button
                        className="decision-cell-title"
                        onClick={() => onSelect(l)}
                        title={l.title}
                      >
                        {l.title}
                      </button>
                    </td>
                  ))}
                </tr>
                <tr className="decision-row-aspect decision-row-price">
                  <th className="decision-aspect-th">
                    <span className="aspect-title">Price</span>
                  </th>
                  {topListings.map((l) => (
                    <td key={l.id} className="decision-col-td">
                      <div className="decision-cell-price">
                        <span className="decision-price-val">{money(l.price, l.currency)}</span>
                        {l.shippingCost === 0 ? (
                          <span className="decision-shipping-tag free">
                            <Truck size={11} /> Free ship
                          </span>
                        ) : l.shippingCost ? (
                          <span className="decision-shipping-tag">
                            <Truck size={11} /> +{money(l.shippingCost, l.currency)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr className="decision-row-aspect decision-row-region">
                  <th className="decision-aspect-th">
                    <span className="aspect-title">Region</span>
                  </th>
                  {topListings.map((l) => (
                    <td key={l.id} className="decision-col-td">
                      <div className="decision-cell-region" title={l.location || 'Not specified'}>
                        <MapPin size={12} className="aspect-icon" />
                        <span className="decision-region-text">{l.location || 'Not specified'}</span>
                      </div>
                    </td>
                  ))}
                </tr>
                <tr className="decision-row-aspect decision-row-score">
                  <th className="decision-aspect-th">
                    <span className="aspect-title">Deal Score</span>
                  </th>
                  {topListings.map((l) => (
                    <td key={l.id} className="decision-col-td">
                      <span className={`decision-score-pill ${l.dealScore >= 85 ? 'excellent' : l.dealScore >= 75 ? 'good' : 'fair'}`}>
                        {l.dealScore} · {l.dealScore >= 85 ? 'Excellent' : l.dealScore >= 75 ? 'Good deal' : 'Fair price'}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="decision-row-aspect decision-row-condition">
                  <th className="decision-aspect-th">
                    <span className="aspect-title">Condition</span>
                  </th>
                  {topListings.map((l) => (
                    <td key={l.id} className="decision-col-td">
                      <span className="decision-condition-tag">
                        {l.condition || 'Pre-owned'}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="decision-row-aspect decision-row-platform">
                  <th className="decision-aspect-th">
                    <span className="aspect-title">Platform</span>
                  </th>
                  {topListings.map((l) => (
                    <td key={l.id} className="decision-col-td">
                      <MarketplaceBadge marketplace={l.marketplace} />
                    </td>
                  ))}
                </tr>
                <tr className="decision-row-aspect decision-row-seller">
                  <th className="decision-aspect-th">
                    <span className="aspect-title">Seller</span>
                  </th>
                  {topListings.map((l) => (
                    <td key={l.id} className="decision-col-td">
                      {l.sellerRating != null ? (
                        <span className="decision-seller-val">
                          <Star size={11} fill="currentColor" />
                          {l.sellerRating}
                          {l.sellerReviewCount != null ? ` (${l.sellerReviewCount})` : ''}
                        </span>
                      ) : l.sellerName ? (
                        <span className="decision-seller-name" title={l.sellerName}>
                          {l.sellerName}
                        </span>
                      ) : (
                        <span className="decision-seller-none">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="decision-row-aspect decision-row-action">
                  <th className="decision-aspect-th">
                    <span className="aspect-title">Action</span>
                  </th>
                  {topListings.map((l) => (
                    <td key={l.id} className="decision-col-td">
                      <div className="decision-action-cell">
                        <Button
                          size="sm"
                          onClick={() => onNegotiate(l)}
                          disabled={l.availability === 'sold'}
                          className="decision-negotiate-btn"
                        >
                          <Sparkles size={12} />
                          {negotiatedIds.includes(l.id) ? 'In chat' : 'Negotiate'}
                        </Button>
                        <button className="decision-details-link" onClick={() => onSelect(l)}>
                          Details <ArrowUpRight size={11} />
                        </button>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : currentListing ? (
          <div className="decision-single-view">
            <div className="single-card-carousel">
              <button
                type="button"
                className="single-card-arrow prev"
                onClick={prevCard}
                aria-label="Previous card (circular)"
                title="Previous listing"
              >
                <ChevronLeft size={20} />
              </button>

              <article className="decision-single-card">
                <div className="single-card-header">
                  <span className="single-card-rank">#{currentIndex + 1} of {topListings.length}</span>
                  <span className={`decision-score-pill ${currentListing.dealScore >= 85 ? 'excellent' : currentListing.dealScore >= 75 ? 'good' : 'fair'}`}>
                    {currentListing.dealScore} · {currentListing.dealScore >= 85 ? 'Excellent' : currentListing.dealScore >= 75 ? 'Good deal' : 'Fair price'}
                  </span>
                </div>

                <button
                  className="single-card-image-btn"
                  onClick={() => onSelect(currentListing)}
                  aria-label={`View ${currentListing.title}`}
                >
                  <img
                    src={currentListing.imageUrls[0] || '/product.svg'}
                    alt={currentListing.title}
                    onError={(e) => { e.currentTarget.src = '/product.svg'; }}
                  />
                </button>

                <div className="single-card-info">
                  <button
                    className="single-card-title"
                    onClick={() => onSelect(currentListing)}
                    title={currentListing.title}
                  >
                    {currentListing.title}
                  </button>

                  <div className="single-card-price-row">
                    <span className="single-card-price">{money(currentListing.price, currentListing.currency)}</span>
                    {currentListing.shippingCost === 0 ? (
                      <span className="decision-shipping-tag free">
                        <Truck size={11} /> Free shipping
                      </span>
                    ) : currentListing.shippingCost ? (
                      <span className="decision-shipping-tag">
                        <Truck size={11} /> +{money(currentListing.shippingCost, currentListing.currency)} shipping
                      </span>
                    ) : null}
                  </div>

                  <div className="single-card-aspects-grid">
                    <div className="aspect-item">
                      <span className="aspect-label">Region</span>
                      <span className="aspect-val" title={currentListing.location || 'Not specified'}>
                        <MapPin size={11} className="aspect-icon" />
                        {currentListing.location || 'Not specified'}
                      </span>
                    </div>

                    <div className="aspect-item">
                      <span className="aspect-label">Condition</span>
                      <span className="aspect-val">
                        <span className="decision-condition-tag">
                          {currentListing.condition || 'Pre-owned'}
                        </span>
                      </span>
                    </div>

                    <div className="aspect-item">
                      <span className="aspect-label">Platform</span>
                      <span className="aspect-val">
                        <MarketplaceBadge marketplace={currentListing.marketplace} />
                      </span>
                    </div>

                    <div className="aspect-item">
                      <span className="aspect-label">Seller</span>
                      <span className="aspect-val">
                        {currentListing.sellerRating != null ? (
                          <span className="decision-seller-val">
                            <Star size={11} fill="currentColor" />
                            {currentListing.sellerRating}
                            {currentListing.sellerReviewCount != null ? ` (${currentListing.sellerReviewCount})` : ''}
                          </span>
                        ) : currentListing.sellerName ? (
                          <span className="decision-seller-name" title={currentListing.sellerName}>
                            {currentListing.sellerName}
                          </span>
                        ) : (
                          <span className="decision-seller-none">—</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="single-card-actions">
                  <Button
                    size="sm"
                    onClick={() => onNegotiate(currentListing)}
                    disabled={currentListing.availability === 'sold'}
                    className="decision-negotiate-btn single-negotiate-btn"
                  >
                    <Sparkles size={13} />
                    {negotiatedIds.includes(currentListing.id) ? 'In chat' : 'Start negotiation'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelect(currentListing)}
                    className="single-details-btn"
                  >
                    Details <ArrowUpRight size={12} />
                  </Button>
                </div>
              </article>

              <button
                type="button"
                className="single-card-arrow next"
                onClick={nextCard}
                aria-label="Next card (circular)"
                title="Next listing"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Quick jump slider bar */}
            {topListings.length > 1 && (
              <div className="single-card-slider-bar">
                <div className="slider-label-row">
                  <span className="slider-hint-text">Slide to jump between top {topListings.length}:</span>
                  <span className="slider-index-tag">#{currentIndex + 1}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={topListings.length - 1}
                  step={1}
                  value={currentIndex}
                  onChange={(e) => setCurrentIndex(Number(e.target.value))}
                  className="single-card-range-slider"
                  aria-label="Slider to navigate between cards"
                />
                <div className="slider-numbers-row">
                  {topListings.map((l, i) => (
                    <button
                      key={l.id}
                      type="button"
                      className={`slider-number-btn ${i === currentIndex ? 'active' : ''}`}
                      onClick={() => setCurrentIndex(i)}
                      aria-label={`Jump to card ${i + 1}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
      <div className="decision-modal-footer">
        <Button onClick={onContinue} disabled={!busy} variant="outline">
          {busy
            ? <><Loader2 size={14} className="spin" />Continue searching</>
            : 'Search complete'}
        </Button>
        <span className="decision-footer-hint">
          {busy
            ? 'Agents are still searching — continue to collect more results.'
            : 'All agents have finished. Start a new search to find more.'}
        </span>
      </div>
    </Modal>
  );
}
