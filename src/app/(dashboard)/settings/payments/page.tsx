"use client";

import { useEffect, useState } from "react";
import { Card, Button, Skeleton } from "@/components/ui";
import { CreditCardIcon, CheckIcon } from "@/components/icons";
import { apiGet, apiPost } from "@/lib/api-client";

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  emails: string;
  features: string[];
  current?: boolean;
  popular?: boolean;
}

interface PaymentMethod {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface SubscriptionData {
  plans: Plan[];
  currentPlanId?: string;
  paymentMethod?: PaymentMethod | null;
}

const fallbackPlans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 49,
    period: "mo",
    emails: "50 emails/day",
    features: [
      "1 connected inbox",
      "1 sending domain",
      "1 email style",
      "Basic analytics",
      "Email support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 149,
    period: "mo",
    emails: "500 emails/day",
    features: [
      "5 connected inboxes",
      "3 sending domains",
      "All email styles",
      "Advanced analytics",
      "Priority support",
      "A/B testing",
    ],
    popular: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: 399,
    period: "mo",
    emails: "Unlimited emails",
    features: [
      "Unlimited inboxes",
      "Unlimited domains",
      "All email styles",
      "Full analytics suite",
      "Dedicated support",
      "A/B testing",
      "API access",
      "Custom integrations",
    ],
  },
];

export default function PaymentsPage() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [paymentMsg, setPaymentMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiGet<SubscriptionData>("/api/billing/subscription")
      .then((data) => {
        if (cancelled) return;
        setSubscription(data ?? null);
      })
      .catch((err) => {
        console.error("Failed to load subscription", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpgrade = async (planId: string) => {
    if (upgrading) return;
    setUpgrading(planId);
    try {
      const res = await apiPost<{ url?: string }>("/api/billing/checkout", {
        planId,
      });
      if (res?.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      console.error("Checkout failed", err);
      setUpgrading(null);
    }
  };

  if (loading) {
    return (
      <>
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-72 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-96" rounded="lg" />
          ))}
        </div>
        <Skeleton className="h-24" rounded="lg" />
      </>
    );
  }

  const plans = subscription?.plans?.length ? subscription.plans : fallbackPlans;
  const currentPlanId = subscription?.currentPlanId ?? plans.find((p) => p.current)?.id ?? "starter";
  const paymentMethod = subscription?.paymentMethod;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight font-heading">Plan & Billing</h1>
        <p className="text-[13px] text-white/25 mt-1">
          Manage your subscription and payment method
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isPopular = plan.popular;
          return (
            <Card
              key={plan.id}
              className={`flex flex-col ${isPopular ? "ring-1 ring-cf-orange" : ""}`}
            >
              {isPopular && (
                <span className="self-start px-3 py-1 rounded-[var(--radius-pill)] text-[10px] font-bold bg-cf-orange/15 text-cf-orange mb-3">
                  Most Popular
                </span>
              )}
              <h3 className="text-[18px] font-bold font-heading">{plan.name}</h3>
              <p className="text-[12px] text-white/25 mt-1">{plan.emails}</p>
              <div className="flex items-end gap-1 mt-4 mb-5">
                <span className="text-[36px] font-bold tracking-tighter leading-none font-mono">
                  ${plan.price}
                </span>
                <span className="text-[13px] text-white/25 mb-1">
                  /{plan.period}
                </span>
              </div>

              <div className="flex flex-col gap-2.5 mb-5 flex-1">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <CheckIcon size={14} className="text-cf-green shrink-0" />
                    <span className="text-[12px] text-white/50">{feature}</span>
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <button className="w-full py-2.5 rounded-[var(--radius-button)] bg-white/[0.04] text-[13px] text-white/30 font-medium">
                  Current Plan
                </button>
              ) : (
                <Button
                  variant={isPopular ? "primary" : "secondary"}
                  className="w-full"
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={upgrading === plan.id}
                >
                  {upgrading === plan.id ? "Redirecting..." : "Upgrade"}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      {/* Payment method */}
      <Card>
        <p className="text-sm font-bold mb-4 font-heading">Payment Method</p>
        {paymentMethod ? (
          <div className="flex items-center gap-3 py-2">
            <div className="w-10 h-7 rounded bg-cf-elevated flex items-center justify-center">
              <CreditCardIcon size={16} className="text-white/40" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-medium">
                {paymentMethod.brand} ending in {paymentMethod.last4}
              </p>
              <p className="text-[11px] text-white/20">
                Expires {String(paymentMethod.expMonth).padStart(2, "0")}/{paymentMethod.expYear}
              </p>
            </div>
            <button
              className="text-[13px] text-cf-orange hover:opacity-80 transition-opacity"
              onClick={() => {
                setPaymentMsg("To update your payment method, please contact support@convergeflow.io or use the billing portal link in your Stripe email.");
                setTimeout(() => setPaymentMsg(""), 5000);
              }}
            >
              Update
            </button>
          </div>
        ) : (
          <p className="text-[13px] text-white/40 py-2">No payment method on file.</p>
        )}
        {paymentMsg && (
          <p className="text-[12px] text-cf-orange mt-3">{paymentMsg}</p>
        )}
      </Card>
    </>
  );
}
