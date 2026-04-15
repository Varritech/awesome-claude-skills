"use client";

import { Card, Button } from "@/components/ui";
import { CreditCardIcon, CheckIcon } from "@/components/icons";

const plans = [
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
    current: true,
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
    current: false,
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
    current: false,
  },
];

export default function PaymentsPage() {
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
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`flex flex-col ${
              plan.popular ? "ring-1 ring-cf-orange" : ""
            }`}
          >
            {plan.popular && (
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

            {plan.current ? (
              <button className="w-full py-2.5 rounded-[var(--radius-button)] bg-white/[0.04] text-[13px] text-white/30 font-medium">
                Current Plan
              </button>
            ) : (
              <Button
                variant={plan.popular ? "primary" : "secondary"}
                className="w-full"
              >
                Upgrade
              </Button>
            )}
          </Card>
        ))}
      </div>

      {/* Payment method */}
      <Card>
        <p className="text-sm font-bold mb-4 font-heading">Payment Method</p>
        <div className="flex items-center gap-3 py-2">
          <div className="w-10 h-7 rounded bg-cf-elevated flex items-center justify-center">
            <CreditCardIcon size={16} className="text-white/40" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-medium">Visa ending in 4242</p>
            <p className="text-[11px] text-white/20">Expires 12/2027</p>
          </div>
          <button className="text-[13px] text-cf-orange hover:opacity-80 transition-opacity">
            Update
          </button>
        </div>
      </Card>
    </>
  );
}
