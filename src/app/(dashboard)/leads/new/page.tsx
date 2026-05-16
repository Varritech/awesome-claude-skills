"use client";

/**
 * Manual lead creation form.
 *
 * Submits to POST /api/leads with source: 'manual'.
 * Uses react-hook-form + zod for client-side validation.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const newLeadSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email("Valid email is required"),
  company: z.string().optional(),
  title: z.string().optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
});

type NewLeadFormValues = z.infer<typeof newLeadSchema>;

export default function NewLeadPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewLeadFormValues>({
    resolver: zodResolver(newLeadSchema),
  });

  async function onSubmit(values: NewLeadFormValues) {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "manual",
          leads: [values],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      router.push("/leads");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create lead");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-heading tracking-tight">Add Lead</h1>
        <p className="text-white/40 text-sm mt-1">Manually add a new contact to your lead list.</p>
      </div>

      <Card padding="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wide">
                First Name *
              </label>
              <Input
                {...register("firstName")}
                placeholder="Alex"
                state={errors.firstName ? "error" : "default"}
              />
              {errors.firstName && (
                <p className="text-cf-red text-xs mt-1">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wide">
                Last Name
              </label>
              <Input
                {...register("lastName")}
                placeholder="Chen"
                state={errors.lastName ? "error" : "default"}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wide">
              Email *
            </label>
            <Input
              {...register("email")}
              type="email"
              placeholder="alex@company.com"
              state={errors.email ? "error" : "default"}
            />
            {errors.email && <p className="text-cf-red text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wide">
              Company
            </label>
            <Input
              {...register("company")}
              placeholder="Acme Inc."
              state={errors.company ? "error" : "default"}
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wide">
              Title
            </label>
            <Input
              {...register("title")}
              placeholder="Head of Growth"
              state={errors.title ? "error" : "default"}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wide">
                Industry
              </label>
              <Input
                {...register("industry")}
                placeholder="SaaS"
                state={errors.industry ? "error" : "default"}
              />
            </div>

            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wide">
                Location
              </label>
              <Input
                {...register("location")}
                placeholder="New York, NY"
                state={errors.location ? "error" : "default"}
              />
            </div>
          </div>

          {submitError && (
            <div className="bg-cf-red/10 border border-cf-red/20 rounded-cf-icon px-4 py-3">
              <p className="text-cf-red text-sm">{submitError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/leads")}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Lead"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
