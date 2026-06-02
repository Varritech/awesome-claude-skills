import OnboardingGuard from "./OnboardingGuard";

export default function OnboardingGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OnboardingGuard>{children}</OnboardingGuard>;
}
