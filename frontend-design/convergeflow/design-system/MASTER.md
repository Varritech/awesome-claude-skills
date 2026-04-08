# ConvergeFlow Design System

## Brand Identity
- **Product**: Simple outbound cold email platform for blue-collar SMBs
- **Positioning**: "5 clicks to a booked call" - we eat your email complexity
- **Target**: Roofers, solar installers, contractors, agencies
- **Competitors**: Instantly, Smartlead, Lemlist, SalesHandy, Prospy.ai

## Visual Style
- **Style**: Flat Design - 2D, minimalist, bold colors, clean lines, typography-focused
- **Theme**: Dark mode primary (matches competitor landscape, feels premium)
- **Performance**: Excellent | Accessibility: WCAG AAA

## Colors
| Token | Hex | Usage |
|-------|-----|-------|
| primary | #2563EB | Primary actions, links, active states |
| primary-light | #3B82F6 | Hover states, secondary elements |
| accent | #F97316 | CTA buttons, success highlights |
| bg-dark | #0F172A | Main background (slate-900) |
| bg-card | #1E293B | Card backgrounds (slate-800) |
| bg-surface | #334155 | Elevated surfaces (slate-700) |
| text-primary | #F8FAFC | Primary text (slate-50) |
| text-secondary | #94A3B8 | Secondary text (slate-400) |
| text-muted | #64748B | Muted text (slate-500) |
| success | #22C55E | Positive metrics, green status |
| warning | #EAB308 | Warmup in progress, caution |
| error | #EF4444 | Errors, bounces, red status |
| border | #334155 | Card borders (slate-700) |

## Typography
- **Font**: Plus Jakarta Sans (Google Fonts)
- **Weights**: 300 (light), 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Heading scale**: 2xl (dashboard title), xl (card titles), lg (section headers)
- **Body**: base (16px), sm (14px for secondary)
- **Reading level**: 3rd grade - if a 12-year-old can't understand it, rewrite it

## Brand Voice & UI Copy

### Word Substitutions (MANDATORY)
| Don't Say | Say Instead |
|-----------|------------|
| task | job |
| client | customer |
| proposal | estimate |
| mailbox configuration | inbox |
| prospects | leads |
| onboard | get started |
| campaigns | your emails |
| schedule a meeting | book a call |

### Banned Words (NEVER use in UI)
pipeline, deployment, workflow, integration, optimization, leverage, synergy, stakeholder, scalable, paradigm, ROI (use "money back"), KPI, CRM, SaaS, API (in user-facing copy), onboarding (use "getting started"), campaign (use "emails")

### Screen Names
| Technical | User Sees |
|-----------|----------|
| Dashboard | Home |
| Campaigns | Your Emails |
| Leads Database | Find Customers |
| Settings | Your Account |
| Analytics | How It's Going |
| Templates | Email Styles |
| Support | Need Help? |

### Sample Messages
- Onboarding Welcome: "Let's get you some customers. Takes about 2 minutes."
- Domain Setup: "Connect your website so emails come from you, not us."
- Email Sent: "Your first batch went out. We'll let you know when someone replies."
- Lead Found: "We found 47 potential customers in your area."
- Campaign Active: "Your emails are going out. Sit back - we've got this."
- Reply Received: "Someone's interested. Check your inbox."
- Error/Bounce: "A few emails didn't go through. No worries - we'll try again."
- Warmup: "We're warming up your inbox. Takes about 2 weeks, but you don't need to do anything."
- Scaling: "Want to send more emails? Book a quick call and we'll set you up."

## Design Principles
1. Mobile-first: users check on phones at job sites
2. Large touch targets: 44x44px minimum
3. No charts/graphs/analytics jargon on main views
4. Large, readable numbers for key metrics
5. Every screen tells the user what to do next
6. Fewer elements, more whitespace
7. No emojis as icons - use Lucide SVGs
8. cursor-pointer on all clickable elements

## Layout
- **Navigation**: Left sidebar on desktop, bottom tabs on mobile
- **Content max-width**: 1280px centered
- **Card border-radius**: 12px (rounded-xl)
- **Spacing scale**: 4, 8, 12, 16, 24, 32, 48
- **Transitions**: 150-200ms ease for hover/focus

## Tech Stack (for code designs)
- HTML5 + Tailwind CSS (CDN)
- Lucide Icons (CDN)
- Plus Jakarta Sans (Google Fonts)
- No build step - open directly in browser
