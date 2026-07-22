"use client";

/**
 * /onboarding/domain/buy
 *
 * Buy-a-fresh-sending-domain UI. Three states:
 *
 *   search   → user types a base name, hits Enter, we list available TLDs
 *              + prices via /api/domains/search
 *   contact  → user picks a domain, fills WHOIS contact (pre-filled from
 *              the user profile if known), reviews price
 *   pending  → POST /api/domains/buy returned 202 — we show "registration
 *              in progress, this can take 1–3 minutes" + auto-poll the
 *              dashboard
 *
 * The buy endpoint kicks off a Cloud Domains long-running operation, then
 * sets up Cloud DNS + Resend in parallel. The dashboard verifier already
 * polls every 4 seconds so we just hand off to it.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { OnboardingLayout } from "@/components/layout";
import { apiGet, apiPost } from "@/lib/api-client";

interface SearchResult {
  domainName: string;
  availability: string; // AVAILABLE | MAYBE_AVAILABLE | UNAVAILABLE | UNSUPPORTED | UNKNOWN
  yearlyCostUsdCents?: number;
  yearlyPriceUsdCents?: number;
  markupUsdCents?: number;
}

interface UserProfile {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  shippingAddress?: {
    line1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryCode?: string;
  };
}

interface BoughtDomain {
  id: string;
  domain: string;
  overallStatus: string;
  yearlyPriceUsdCents: number;
}

const PHONE_REGEX = /^[+]?[\d\s().-]{8,20}$/;

function formatPrice(cents?: number): string {
  if (typeof cents !== "number") return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export default function BuyDomainPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<SearchResult | null>(null);
  const [, setProfile] = useState<UserProfile | null>(null);

  // Contact form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("US");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bought, setBought] = useState<BoughtDomain | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await apiGet<UserProfile>("/api/user/profile");
        if (cancelled) return;
        setProfile(p ?? null);
        setFirstName(p?.firstName ?? "");
        setLastName(p?.lastName ?? "");
        setEmail(p?.email ?? "");
        setPhone(p?.phone ?? "");
        setAddress1(p?.shippingAddress?.line1 ?? "");
        setCity(p?.shippingAddress?.city ?? "");
        setState(p?.shippingAddress?.state ?? "");
        setPostal(p?.shippingAddress?.postalCode ?? "");
        setCountry(p?.shippingAddress?.countryCode ?? "US");
      } catch {
        // Profile may not exist yet — leave the form empty.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 3) {
      setError("Search at least 3 characters.");
      return;
    }
    setError(null);
    setSearching(true);
    try {
      const res = await apiGet<{ data: SearchResult[] }>(`/api/domains/search?q=${encodeURIComponent(q)}`);
      setResults(res.data ?? []);
    } catch {
      setError("Couldn't reach the registrar. Try again in a minute.");
    } finally {
      setSearching(false);
    }
  };

  const handleBuy = async () => {
    if (!selectedDomain || submitting) return;
    setError(null);

    if (!firstName || !lastName || !email || !address1 || !city || !state || !postal || !country) {
      setError("Fill in every contact field.");
      return;
    }
    if (!PHONE_REGEX.test(phone)) {
      setError("Enter a valid phone number (e.g. +1 647 410 2820).");
      return;
    }
    if (typeof selectedDomain.yearlyPriceUsdCents !== "number") {
      setError("No price returned for this domain. Pick another.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiPost<{ data: BoughtDomain }>("/api/domains/buy", {
        domain: selectedDomain.domainName,
        quotedPriceUsdCents: selectedDomain.yearlyPriceUsdCents,
        contact: {
          firstName,
          lastName,
          email,
          phone,
          addressLine1: address1,
          city,
          state,
          postalCode: postal,
          countryCode: country,
        },
      });
      setBought(data.data);
    } catch (err) {
      console.error("[buy-domain]", err);
      setError("The registrar rejected the purchase. Try a different domain.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingLayout currentStep={2}>
      <div className="max-w-[560px] mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-[30px] font-bold tracking-tight leading-tight mb-2 font-heading">
            Buy a fresh{" "}
            <span className="text-cf-orange">sending domain</span>.
          </h1>
          <p className="text-[15px] text-white/30 leading-relaxed">
            Protect your main domain. Yours forever. DNS handled for you.
          </p>
        </div>

        <div className="bg-cf-card rounded-[24px] p-8">
          {!bought ? (
            <>
              <label className="block text-[11px] font-medium text-white/35 mb-1.5">
                Search a name
              </label>
              <div className="flex gap-2 mb-5">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="e.g. acme-outreach"
                  className="flex-1 bg-[#222228] border-2 border-transparent rounded-[14px] py-3 px-4 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35"
                />
                <button
                  type="button"
                  onClick={runSearch}
                  disabled={searching || query.trim().length < 3}
                  className="bg-cf-orange text-white text-sm font-bold py-3 px-5 rounded-[14px] border-none cursor-pointer disabled:opacity-40 disabled:cursor-default"
                >
                  {searching ? "..." : "Search"}
                </button>
              </div>

              {results.length > 0 && (
                <div className="mb-6">
                  <p className="text-[12px] font-medium text-white/35 mb-2">
                    Available domains
                  </p>
                  <div className="flex flex-col gap-2">
                    {results.map((r) => {
                      const isAvailable = r.availability === "AVAILABLE";
                      const isSelected = selectedDomain?.domainName === r.domainName;
                      return (
                        <button
                          key={r.domainName}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => setSelectedDomain(r)}
                          className={`flex items-center justify-between bg-[#222228] rounded-[12px] px-4 py-3 border-2 transition-all ${
                            isSelected
                              ? "border-cf-orange"
                              : "border-transparent hover:border-cf-orange/30"
                          } ${!isAvailable ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <span className="text-[14px] text-white font-mono">{r.domainName}</span>
                          <span className="text-[13px] text-white/60">
                            {isAvailable ? `${formatPrice(r.yearlyPriceUsdCents)}/yr` : r.availability.toLowerCase()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedDomain && (
                <div className="border-t border-white/10 pt-5 mt-2">
                  <p className="text-[14px] font-bold mb-3 font-heading">
                    WHOIS contact for{" "}
                    <span className="text-cf-orange">{selectedDomain.domainName}</span>
                  </p>
                  <p className="text-[11px] text-white/40 mb-4 leading-relaxed">
                    Required by ICANN for every domain. WHOIS privacy is enabled
                    by default — these details are not shown publicly.
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="bg-[#222228] border-2 border-transparent rounded-[12px] py-2.5 px-3 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35"
                    />
                    <input
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="bg-[#222228] border-2 border-transparent rounded-[12px] py-2.5 px-3 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35"
                    />
                  </div>
                  <input
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#222228] border-2 border-transparent rounded-[12px] py-2.5 px-3 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35 mb-3"
                  />
                  <input
                    placeholder="Phone (+1 647 410 2820)"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    className="w-full bg-[#222228] border-2 border-transparent rounded-[12px] py-2.5 px-3 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35 mb-3"
                  />
                  <input
                    placeholder="Street address"
                    value={address1}
                    onChange={(e) => setAddress1(e.target.value)}
                    className="w-full bg-[#222228] border-2 border-transparent rounded-[12px] py-2.5 px-3 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35 mb-3"
                  />
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      placeholder="City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="bg-[#222228] border-2 border-transparent rounded-[12px] py-2.5 px-3 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35"
                    />
                    <input
                      placeholder="State / Province"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="bg-[#222228] border-2 border-transparent rounded-[12px] py-2.5 px-3 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <input
                      placeholder="ZIP / Postal"
                      value={postal}
                      onChange={(e) => setPostal(e.target.value)}
                      className="bg-[#222228] border-2 border-transparent rounded-[12px] py-2.5 px-3 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35"
                    />
                    <input
                      placeholder="Country code (US)"
                      maxLength={2}
                      value={country}
                      onChange={(e) => setCountry(e.target.value.toUpperCase())}
                      className="bg-[#222228] border-2 border-transparent rounded-[12px] py-2.5 px-3 text-sm text-white outline-none focus:border-cf-orange placeholder:text-white/35"
                    />
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[13px] text-white/60">First-year price</span>
                    <span className="text-[15px] text-white font-bold">
                      {formatPrice(selectedDomain.yearlyPriceUsdCents)}
                    </span>
                  </div>

                  {error && <p className="text-[12px] text-red-400 mb-3 text-left">{error}</p>}

                  <button
                    type="button"
                    onClick={handleBuy}
                    disabled={submitting}
                    className={`w-full bg-cf-orange text-white text-sm font-bold py-3.5 px-7 rounded-[14px] border-none transition-all duration-150 font-heading uppercase tracking-wide ${
                      !submitting
                        ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
                        : "opacity-35 cursor-default"
                    }`}
                  >
                    {submitting ? "Registering..." : `Buy ${selectedDomain.domainName}`}
                  </button>
                </div>
              )}

              {!selectedDomain && error && (
                <p className="text-[12px] text-red-400 mt-2 text-left">{error}</p>
              )}

              <Link
                href="/onboarding/domain"
                className="block text-center mt-5 text-[13px] text-white/35 hover:text-white/60 transition-colors"
              >
                Back
              </Link>
            </>
          ) : (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-cf-orange/10 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <p className="text-[18px] font-bold mb-2 font-heading">
                Registration started.
              </p>
              <p className="text-[14px] text-white/60 mb-6">
                <span className="font-mono text-white">{bought.domain}</span> is being
                registered. DNS + email authentication are wired up automatically;
                it can take 1–3 minutes for the records to go green.
              </p>
              <button
                type="button"
                onClick={() => router.push("/onboarding/inbox")}
                className="w-full bg-cf-orange text-white text-sm font-bold py-3.5 px-7 rounded-[14px] border-none cursor-pointer hover:-translate-y-0.5 transition-all duration-150 font-heading uppercase tracking-wide hover:shadow-[0_4px_20px_rgba(249,115,22,0.3)]"
              >
                Continue to inbox
              </button>
            </div>
          )}
        </div>
      </div>
    </OnboardingLayout>
  );
}
