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
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Command,
  Compass,
  History,
  ImagePlus,
  Info,
  ListFilter,
  Loader2,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
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
import { NegotiationSetup, WorkspaceNegotiations, NegotiationObserver } from './workspace-negotiations';
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
          Sign in
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
  const [location, setLocation] = useState("San Francisco");
  const [radius, setRadius] = useState(25);
  const [filters, setFilters] = useState(false);
  const [sort, setSort] = useState("best");
  const [activeMarket, setActiveMarket] = useState<Marketplace | "all">("all");
  const [mobileTab, setMobileTab] = useState("results");
  const [selectedSnapshot, setSelected] = useState<RankedListing | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState('listings');
  const [negotiatedIds,setNegotiatedIds]=useState<string[]>([]);
  const [currency, setCurrency] = useState('USD');
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

  const applyEvent = (event: StreamEvent) => {
    if (event.type === "state") {
      setState(event.state);
      restoredId.current = event.state.id;
      if (event.state.filters?.maxPrice)
        setMaxPrice(String(event.state.filters.maxPrice));
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

  async function search(text = query) {
    if (busy || (!text.trim() && !image)) return;
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

  const ranked = rankListings(state?.listings || []);
  const selected=ranked.find(l=>l.id===selectedSnapshot?.id)??selectedSnapshot;
  async function findMore(listingId?:string){if(!state)return;setDiscoveryBusy(true);try{const result=await readJsonResponse<{demo?:boolean}>(await fetch('/api/workspace/discovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspaceId:state.id,listingId})}));if(result.demo)setError('Demo mode has no additional marketplace results.');}catch(e){setError((e as Error).message);}finally{setDiscoveryBusy(false);}}
  let listings = ranked.filter(
    (l) =>
      l.currency === currency &&
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
        {state&&<div className="workspace-tabs" role="tablist" aria-label="Workspace views" onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=workspaceTab==='listings'?'negotiations':'listings';setWorkspaceTab(next);(e.currentTarget.querySelectorAll('[role="tab"]')[next==='listings'?0:1] as HTMLButtonElement).focus();}}}><Button role="tab" aria-selected={workspaceTab==='listings'} onClick={()=>setWorkspaceTab('listings')}>Listings</Button><Button role="tab" aria-selected={workspaceTab==='negotiations'} onClick={()=>setWorkspaceTab('negotiations')}>Negotiations</Button><Button variant="outline" disabled={discoveryBusy||requestBusy} onClick={()=>void findMore()}>{discoveryBusy?'Queuing…':'Find more'}</Button></div>}
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

        <div className={`workspace show-${mobileTab} ${panelCollapsed ? "panel-collapsed" : ""}`}>
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
                      {busy ? (
                        <i className="working-dot" />
                      ) : (
                        <CheckCheck size={14} />
                      )}{" "}
                      {busy
                        ? "Finding your shortlist"
                        : "Your shortlist is ready"}
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

          <div className="workspace-divider">
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
                Seller<strong>{selected.sellerName || "Not listed"}</strong>
              </span>
              <span>
                Location<strong>{selected.location || "Not listed"}</strong>
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
            {inspectUrl && <BrowserView url={inspectUrl} />}{" "}
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
                className={connectionMarket === m ? "selected" : ""}
              >
                <MarketplaceBadge marketplace={m} />
              </button>
            ))}
          </div>
          {demo ? (
            <div className="connection-demo">
              <ShieldCheck size={34} />
              <h3>Your account stays yours.</h3>
              <p>
                This is demo mode. Connecting simulates a saved marketplace
                profile. Add Steel, Clerk, and Convex credentials to sign in to
                a real account.
              </p>
              <Button onClick={() => void connect("save")}>
                Try demo connection
                <ArrowRight size={14} />
              </Button>
            </div>
          ) : connectionUrl ? (
            <>
              <BrowserView url={connectionUrl} interactive />
              <p className="field-hint">
                Finish signing in above, then save your browser profile.
                Sessions expire after 5 minutes.
              </p>
              <Button
                disabled={connectionBusy}
                onClick={() => void connect("save")}
              >
                I’m signed in · Save connection
              </Button>
            </>
          ) : (
            <Button
              disabled={connectionBusy}
              onClick={() => void connect("open")}
            >
              {connectionBusy ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <ShieldCheck size={16} />
              )}
              Open secure sign-in browser
            </Button>
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
        title="Your demo workspace"
        description="Explore Haggleface without creating an account."
      >
        <div className="profile-panel">
          <span className="avatar">J</span>
          <h3>Welcome, curious shopper.</h3>
          <p>
            Demo searches are saved in this browser tab. Configure Clerk to sign
            in and Convex to keep live searches across devices.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setProfileOpen(false);
              setConnectionOpen(true);
            }}
          >
            Manage marketplace connections
          </Button>
        </div>
      </Modal>
    </div>
  );
}
