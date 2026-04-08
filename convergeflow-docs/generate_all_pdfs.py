#!/usr/bin/env python3
"""
Generate 7 Varritech-branded PDF documents for ConvergeFlow.
Uses reportlab for professional PDF generation with dark theme + purple/green accents.
"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Frame, PageTemplate, BaseDocTemplate
)
from reportlab.platypus.flowables import Flowable
from reportlab.pdfgen import canvas as pdfcanvas

# ============================================================
# BRAND CONSTANTS
# ============================================================
BRAND_DARK = HexColor("#030303")
BRAND_PURPLE_DEEP = HexColor("#170E74")
BRAND_PURPLE_MID = HexColor("#412E91")
BRAND_GREEN = HexColor("#96F01E")
BRAND_WHITE = HexColor("#FFFFFF")
BRAND_GRAY_LIGHT = HexColor("#E0E0E0")
BRAND_GRAY_MED = HexColor("#999999")
BRAND_ROW_ALT = HexColor("#0D0D2B")
BRAND_ROW_BASE = HexColor("#060618")
BRAND_TABLE_HEADER = HexColor("#1A1060")
BRAND_TABLE_BORDER = HexColor("#2A1A80")
BRAND_LAVENDER = HexColor("#B89CFF")

OUTPUT_DIR = "/Users/christianvarriale/awesome-claude-skills/convergeflow-docs/"
CURRENT_DATE = "April 2026"
FOOTER_TEXT = "Confidential - Prepared by Varritech for ConvergeFlow"

W, H = letter  # 612 x 792


# ============================================================
# COVER PAGE (drawn directly on canvas, separate from story)
# ============================================================
def draw_cover(c, title, subtitle=""):
    """Draw a full-page cover on the canvas."""
    w, h = W, H

    # Dark background
    c.setFillColor(BRAND_DARK)
    c.rect(0, 0, w, h, fill=1, stroke=0)

    # Purple accent bar (top area)
    c.setFillColor(BRAND_PURPLE_DEEP)
    c.rect(0, h - 100, w, 60, fill=1, stroke=0)
    c.setFillColor(BRAND_PURPLE_MID)
    c.rect(0, h - 104, w, 6, fill=1, stroke=0)

    # Green accent line
    c.setStrokeColor(BRAND_GREEN)
    c.setLineWidth(3)
    c.line(60, h - 160, w - 60, h - 160)

    # VARRITECH wordmark
    c.setFillColor(BRAND_WHITE)
    c.setFont("Helvetica-Bold", 26)
    x = 60
    for ch in "VARRITECH":
        c.drawString(x, h - 145, ch)
        x += c.stringWidth(ch, "Helvetica-Bold", 26) + 3

    # Title (word-wrapped)
    c.setFillColor(BRAND_WHITE)
    c.setFont("Helvetica-Bold", 32)
    words = title.split()
    lines, current = [], ""
    for word in words:
        test = (current + " " + word).strip()
        if c.stringWidth(test, "Helvetica-Bold", 32) > w - 140:
            lines.append(current)
            current = word
        else:
            current = test
    if current:
        lines.append(current)
    y = h / 2 + 50
    for line in lines:
        c.drawString(60, y, line)
        y -= 44

    # Subtitle
    if subtitle:
        c.setFillColor(BRAND_GRAY_LIGHT)
        c.setFont("Helvetica", 15)
        c.drawString(60, y - 10, subtitle)

    # Prepared for
    c.setFillColor(BRAND_GREEN)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(60, 160, "Prepared for ConvergeFlow")
    c.setFillColor(BRAND_GRAY_MED)
    c.setFont("Helvetica", 11)
    c.drawString(60, 142, CURRENT_DATE)

    # Tagline
    c.setFillColor(BRAND_GRAY_MED)
    c.setFont("Helvetica-Oblique", 9)
    c.drawRightString(w - 60, 70, "Bold ideas wait for no one")

    # Footer
    c.setFillColor(BRAND_GRAY_MED)
    c.setFont("Helvetica", 7)
    c.drawCentredString(w / 2, 42, FOOTER_TEXT + "  |  " + CURRENT_DATE)

    c.showPage()


def draw_header_footer(c, doc):
    """Header and footer for content pages."""
    c.saveState()
    w, h = W, H

    # Header bar
    c.setFillColor(BRAND_DARK)
    c.rect(0, h - 36, w, 36, fill=1, stroke=0)
    c.setFillColor(BRAND_PURPLE_DEEP)
    c.rect(0, h - 38, w, 3, fill=1, stroke=0)

    # VARRITECH in header
    c.setFillColor(BRAND_WHITE)
    c.setFont("Helvetica-Bold", 9)
    x = 45
    for ch in "VARRITECH":
        c.drawString(x, h - 25, ch)
        x += c.stringWidth(ch, "Helvetica-Bold", 9) + 1.2

    # Page number
    c.setFillColor(BRAND_GRAY_MED)
    c.setFont("Helvetica", 7.5)
    c.drawRightString(w - 45, h - 25, f"Page {doc.page}")

    # Footer
    c.setFillColor(BRAND_DARK)
    c.rect(0, 0, w, 30, fill=1, stroke=0)
    c.setFillColor(BRAND_PURPLE_MID)
    c.rect(0, 29, w, 2, fill=1, stroke=0)
    c.setFillColor(BRAND_GRAY_MED)
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(w / 2, 12, FOOTER_TEXT + "  |  " + CURRENT_DATE)

    c.restoreState()


# ============================================================
# STYLES
# ============================================================
def get_styles():
    styles = getSampleStyleSheet()
    defs = [
        ('VTTitle', 'Title', 'Helvetica-Bold', 22, BRAND_WHITE, TA_LEFT, 0, 6, None),
        ('VTH1', 'Heading1', 'Helvetica-Bold', 17, BRAND_GREEN, TA_LEFT, 18, 6, None),
        ('VTH2', 'Heading2', 'Helvetica-Bold', 13, BRAND_WHITE, TA_LEFT, 12, 5, None),
        ('VTH3', 'Heading3', 'Helvetica-Bold', 11, BRAND_LAVENDER, TA_LEFT, 8, 3, None),
        ('VTBody', 'Normal', 'Helvetica', 9.5, BRAND_GRAY_LIGHT, TA_JUSTIFY, 2, 3, 13),
        ('VTSmall', 'Normal', 'Helvetica', 8.5, BRAND_GRAY_LIGHT, TA_LEFT, 1, 2, 11),
        ('VTBullet', 'Normal', 'Helvetica', 9.5, BRAND_GRAY_LIGHT, TA_LEFT, 2, 2, 13),
        ('VTCell', 'Normal', 'Helvetica', 8, BRAND_GRAY_LIGHT, TA_LEFT, 0, 0, 10),
        ('VTCellH', 'Normal', 'Helvetica-Bold', 8.5, BRAND_WHITE, TA_LEFT, 0, 0, 11),
        ('VTCallout', 'Normal', 'Helvetica-Bold', 9.5, BRAND_GREEN, TA_LEFT, 6, 3, None),
        ('VTSub', 'Normal', 'Helvetica', 11, BRAND_GRAY_MED, TA_LEFT, 0, 10, None),
    ]
    for name, parent, font, size, color, align, sb, sa, lead in defs:
        kw = dict(fontName=font, fontSize=size, textColor=color, alignment=align,
                  spaceBefore=sb, spaceAfter=sa)
        if lead:
            kw['leading'] = lead
        styles.add(ParagraphStyle(name, parent=styles[parent], **kw))
    # Bullet with indent
    styles['VTBullet'].leftIndent = 18
    styles['VTBullet'].bulletIndent = 6
    styles['VTBullet'].bulletFontName = 'Helvetica'
    styles['VTBullet'].bulletFontSize = 9.5
    styles['VTBullet'].bulletColor = BRAND_GREEN
    return styles


# ============================================================
# HELPERS
# ============================================================
class GreenBar(Flowable):
    def __init__(self, w=468):
        Flowable.__init__(self)
        self.width = w
        self.height = 4
    def draw(self):
        self.canv.setFillColor(BRAND_GREEN)
        self.canv.rect(0, 0, self.width, 3, fill=1, stroke=0)


class PurpleBar(Flowable):
    def __init__(self, w=468):
        Flowable.__init__(self)
        self.width = w
        self.height = 3
    def draw(self):
        self.canv.setFillColor(BRAND_PURPLE_MID)
        self.canv.rect(0, 0, self.width, 2, fill=1, stroke=0)


S = None  # global styles cache

def sty():
    global S
    if S is None:
        S = get_styles()
    return S


def make_table(headers, rows, col_widths=None):
    """Branded table with alternating row colors."""
    st = sty()
    hdr = [Paragraph(h, st['VTCellH']) for h in headers]
    data = [hdr]
    for row in rows:
        data.append([Paragraph(str(c), st['VTCell']) for c in row])
    if col_widths is None:
        col_widths = [468 // len(headers)] * len(headers)
    t = Table(data, colWidths=col_widths, repeatRows=1)
    cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_TABLE_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, 0), BRAND_WHITE),
        ('GRID', (0, 0), (-1, -1), 0.5, BRAND_TABLE_BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(data)):
        bg = BRAND_ROW_ALT if i % 2 == 0 else BRAND_ROW_BASE
        cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(cmds))
    return t


def bul(text):
    return Paragraph(f'<bullet>&bull;</bullet> {text}', sty()['VTBullet'])


def h1(text):
    return Paragraph(text, sty()['VTH1'])

def h2(text):
    return Paragraph(text, sty()['VTH2'])

def h3(text):
    return Paragraph(text, sty()['VTH3'])

def body(text):
    return Paragraph(text, sty()['VTBody'])

def callout(text):
    return Paragraph(text, sty()['VTCallout'])

def sp(n=8):
    return Spacer(1, n)

def gb():
    return GreenBar()

def pb():
    return PurpleBar()

def pgb():
    return PageBreak()


def build_pdf(filename, title, subtitle, story_fn):
    """Build a PDF with cover + branded content pages."""
    filepath = os.path.join(OUTPUT_DIR, filename)

    # First pass: draw the cover
    c = pdfcanvas.Canvas(filepath, pagesize=letter)
    draw_cover(c, title, subtitle)
    c.save()

    # Now build content pages into a temp file
    tmppath = filepath + ".tmp"
    doc = SimpleDocTemplate(tmppath, pagesize=letter,
                            topMargin=52, bottomMargin=42, leftMargin=50, rightMargin=50)
    story = story_fn()
    doc.build(story, onFirstPage=draw_header_footer, onLaterPages=draw_header_footer)

    # Merge: cover + content using pdfrw or manual approach
    # Since we need simple merge, use reportlab's approach:
    # Re-build everything in one doc using BaseDocTemplate with 2 templates
    _build_merged(filepath, title, subtitle, story_fn)
    if os.path.exists(tmppath):
        os.remove(tmppath)
    print(f"  Generated: {filepath}")


def _build_merged(filepath, title, subtitle, story_fn):
    """Build a single PDF with cover page template + content page template."""

    class VTDocTemplate(BaseDocTemplate):
        def __init__(self, filename, **kw):
            BaseDocTemplate.__init__(self, filename, **kw)
            self._title = kw.pop('doc_title', title)
            self._subtitle = kw.pop('doc_subtitle', subtitle)

            # Cover frame (full page, tiny margins for the flowable)
            cover_frame = Frame(0, 0, W, H, id='cover', leftPadding=0,
                                rightPadding=0, topPadding=0, bottomPadding=0)
            # Content frame
            content_frame = Frame(50, 42, W - 100, H - 94, id='content')

            cover_tmpl = PageTemplate(id='Cover', frames=[cover_frame],
                                      onPage=self._on_cover)
            content_tmpl = PageTemplate(id='Content', frames=[content_frame],
                                        onPage=draw_header_footer)
            self.addPageTemplates([cover_tmpl, content_tmpl])

        def _on_cover(self, canvas_obj, doc):
            draw_cover(canvas_obj, self._title, self._subtitle)

    doc = VTDocTemplate(filepath, pagesize=letter,
                        doc_title=title, doc_subtitle=subtitle)

    story = []
    # On the cover page, we just need a NextPageTemplate + PageBreak
    from reportlab.platypus import NextPageTemplate
    story.append(NextPageTemplate('Content'))
    story.append(PageBreak())

    # Now add all content
    story.extend(story_fn())
    doc.build(story)


# ============================================================
# DOCUMENT 1: Competitor Teardown
# ============================================================
def doc1_story():
    st = sty()
    story = []

    # TOC
    story.append(Paragraph("Table of Contents", st['VTTitle']))
    story.append(gb())
    story.append(sp(10))
    for item in [
        "1. Executive Summary",
        "2. Instantly - The Volume Play",
        "3. Smartlead - The Mid-Market Option",
        "4. Lemlist - The Complexity Trap",
        "5. SalesHandy - The Enterprise Creep",
        "6. Prospy.ai - The Closest Competitor",
        "7. Comparative Matrix",
        "8. ConvergeFlow Positioning",
        "9. Market Data & Opportunity",
    ]:
        story.append(body(item))
    story.append(pgb())

    # Exec Summary
    story.append(h1("1. Executive Summary"))
    story.append(gb())
    story.append(sp())
    story.append(body(
        "The cold email market is fragmented, overpriced, and unnecessarily complex. "
        "Platforms like Instantly advertise at $30/month but real costs balloon to $300+ with upsells. "
        "Lemlist is notoriously difficult to set up. SalesHandy charges premium prices for enterprise features "
        "most SMBs will never use. Prospy.ai comes closest to our model with done-for-you pricing at $2k/month. "
        "ConvergeFlow enters this market with a radically simple proposition: 5 clicks to a booked call, "
        "powered by a self-hosted LLM at a fraction of competitor costs."
    ))
    story.append(sp())
    story.append(body(
        "Key insight: SMBs have a 51% cold email open rate versus 29.4% for enterprise. "
        "Users abandon tools if setup takes more than a few hours, even if the tool is free. "
        "ConvergeFlow is built for this reality."
    ))
    story.append(pgb())

    competitors = [
        ("2", "Instantly", "The Volume Play",
         "$30/mo advertised, real cost ~$300/mo with required upsells (warm-up, lead finder, CRM, etc.)",
         "3/5",
         "Agencies and sales teams with technical staff. MLM-like pricing psychology attracts beginners who then upgrade.",
         ["Strong brand recognition and marketing presence",
          "Large warm-up network for deliverability",
          "Good UI/UX design and onboarding flow",
          "Extensive integration ecosystem"],
         ["Bait-and-switch pricing: $30 headline hides true $300+ cost",
          "Per-seat pricing adds up quickly for teams",
          "MLM-like referral structure creates skepticism",
          "Complex feature set overwhelms blue-collar SMBs",
          "Volume-focused approach risks domain reputation"],
         "ConvergeFlow offers transparent pricing at ~$300/mo with everything included. No upsells, no hidden costs. Simpler setup targets users who would never survive Instantly's complexity."),

        ("3", "Smartlead", "The Mid-Market Option",
         "$39-$174/mo across multiple plan tiers",
         "3/5",
         "Mid-market sales teams and agencies looking for more features than Instantly at a similar price point.",
         ["Competitive pricing across tiers",
          "Good email warm-up capabilities",
          "Multi-channel outreach (email + LinkedIn)",
          "API access for custom integrations"],
         ["Feature bloat confuses simple use cases",
          "Support quality inconsistent at lower tiers",
          "Requires technical knowledge for optimal setup",
          "No done-for-you offering for non-technical users"],
         "ConvergeFlow eliminates the need to understand tiers and feature matrices. One plan, one price, everything works out of the box. Blue-collar SMBs do not comparison-shop plan features."),

        ("4", "Lemlist", "The Complexity Trap",
         "$70-$100/mo per seat",
         "5/5 (Most Complex)",
         "Tech-savvy sales professionals and agencies who want granular control over every aspect of outreach.",
         ["Advanced personalization (custom images, landing pages)",
          "Multi-channel sequences (email, LinkedIn, calls)",
          "Strong community and educational content",
          "Detailed analytics and A/B testing"],
         ["Notoriously difficult to set up and configure",
          "Per-seat pricing makes team use expensive",
          "Steep learning curve deters non-technical users",
          "Over-engineered for simple cold email use cases",
          "Setup can take days to weeks for full configuration"],
         "ConvergeFlow is the anti-Lemlist. Where Lemlist takes days to configure, ConvergeFlow takes 2 minutes. Where Lemlist requires a tutorial library, ConvergeFlow requires 5 clicks."),

        ("5", "SalesHandy", "The Enterprise Creep",
         "Higher price range, enterprise-oriented tiers",
         "4/5",
         "Growing sales teams transitioning from basic tools to enterprise-grade outreach platforms.",
         ["Document tracking and analytics",
          "Email scheduling and follow-up automation",
          "CRM integrations (Salesforce, HubSpot)",
          "Team collaboration features"],
         ["Enterprise pricing alienates SMB market",
          "Complex feature set with significant learning curve",
          "Heavy focus on enterprise workflows irrelevant to SMBs",
          "Similar complexity issues to other platforms"],
         "ConvergeFlow targets the users SalesHandy ignores: small business owners who need leads, not a CRM integration matrix. Our blue-collar language and mobile-first design speak directly to this market."),

        ("6", "Prospy.ai", "The Closest Competitor",
         "$395/mo DIY, $2,000/mo Done-For-You",
         "2/5 (DFY option removes complexity)",
         "Business owners willing to pay premium for done-for-you automation. Strong visual branding with lightning bolt motif.",
         ["Clear DIY vs DFY pricing that Kareem flagged as a model to follow",
          "'Agent Frank' AI automation concept resonates with buyers",
          "Strong visual branding (blue/white palette, lightning bolt)",
          "Effective messaging around automation and simplicity",
          "Done-for-you tier removes all technical barriers"],
         ["High price point ($395-$2k) limits market size",
          "DIY tier still requires some technical knowledge",
          "Smaller brand recognition than Instantly/Lemlist",
          "Less transparent about underlying infrastructure",
          "No self-hosted LLM option (higher marginal costs)"],
         "ConvergeFlow matches Prospy's DFY model via OpenClaw at ~$500/mo (vs $2k). Our self-hosted LLM keeps costs at $20/mo flat versus token-based pricing. We combine Prospy's simplicity philosophy with dramatically lower pricing."),
    ]

    for num, name, tag, pricing, setup, audience, strengths, weaknesses, advantage in competitors:
        story.append(h1(f"{num}. {name} \u2014 {tag}"))
        story.append(gb())
        story.append(sp())
        story.append(body(f"<b>Pricing:</b> {pricing}"))
        story.append(body(f"<b>Setup Complexity:</b> {setup}"))
        story.append(body(f"<b>Target Audience:</b> {audience}"))
        story.append(sp(4))
        story.append(h3("Key Strengths"))
        for x in strengths:
            story.append(bul(x))
        story.append(sp(4))
        story.append(h3("Key Weaknesses"))
        for x in weaknesses:
            story.append(bul(x))
        story.append(sp(4))
        story.append(h3("ConvergeFlow Advantage"))
        story.append(body(advantage))
        story.append(pgb())

    # Matrix
    story.append(h1("7. Comparative Matrix"))
    story.append(gb())
    story.append(sp(8))
    story.append(make_table(
        ["Platform", "Price Range", "Setup", "DFY", "Self-Host LLM", "SMB Friendly"],
        [["Instantly", "$30-$300+/mo", "3/5", "No", "No", "Partial"],
         ["Smartlead", "$39-$174/mo", "3/5", "No", "No", "Partial"],
         ["Lemlist", "$70-$100/seat", "5/5", "No", "No", "No"],
         ["SalesHandy", "$100+/mo", "4/5", "No", "No", "No"],
         ["Prospy.ai", "$395-$2k/mo", "2/5", "Yes", "No", "Yes"],
         ["<b>ConvergeFlow</b>", "<b>$300-$500/mo</b>", "<b>1/5</b>", "<b>Yes</b>", "<b>Yes</b>", "<b>Yes</b>"]],
        [85, 85, 55, 50, 75, 68]
    ))
    story.append(pgb())

    # Positioning
    story.append(h1("8. ConvergeFlow Positioning"))
    story.append(gb())
    story.append(sp(8))
    for p in [
        "<b>For:</b> Small business owners and agencies",
        "<b>Who need:</b> Leads and booked calls",
        "<b>ConvergeFlow is:</b> A simple email AI system",
        "<b>That delivers:</b> 5 clicks to a booked call",
        "<b>Unlike:</b> SalesHandy or Instantly, we eat your email complexity",
    ]:
        story.append(body(p))
        story.append(sp(3))

    story.append(sp(10))
    story.append(h1("9. Market Data & Opportunity"))
    story.append(gb())
    story.append(sp(8))
    for x in [
        "SMBs have a <b>51% cold email open rate</b> versus 29.4% for enterprise",
        "Users abandon tools if setup takes more than a few hours, even if the tool is free",
        "Blue-collar SMBs (solar, contractors, plumbers, roofers) are underserved by current platforms",
        "The DFY market ($2k+/month) is proven by Prospy.ai but priced out of reach for most SMBs",
        "ConvergeFlow's self-hosted LLM creates a structural cost advantage over token-based competitors",
    ]:
        story.append(bul(x))

    return story


# ============================================================
# DOCUMENT 2: PRD v1
# ============================================================
def doc2_story():
    st = sty()
    story = []

    story.append(Paragraph("Table of Contents", st['VTTitle']))
    story.append(gb())
    story.append(sp(10))
    for i, name in enumerate([
        "Authentication & Onboarding", "Domain Management", "Mailbox Configuration",
        "Lead Generation & Database", "AI Email Composition (GLM Engine)",
        "Campaign Engine & Send Management", "Dashboard & Reporting",
        "Spam & Deliverability Management", "Scaling & Growth Controls",
        "OpenClaw DWY Tier", "Payments & Billing",
    ], 1):
        story.append(body(f"Epic {i}: {name}"))
    story.append(pgb())

    epics = [
        ("Epic 1: Authentication & Onboarding",
         "Sign up via Google/Facebook using Clerk. 5-click wizard: Auth > Domain > Mailbox > Industry > Template.",
         [("As a new user, I want to sign up with my Google account so that I can get started without creating another password.",
           ["Given a new visitor, when they click 'Sign up with Google', then a Clerk auth flow completes and account is created",
            "The onboarding wizard launches immediately after first sign-in",
            "User profile is populated from Google account data (name, email, avatar)"]),
          ("As a new user, I want to complete onboarding in 5 clicks so that I can start getting leads immediately.",
           ["Given a signed-in user on step 1, when they complete all 5 steps, then the system begins domain warm-up automatically",
            "Each step has a single primary action (no branching or multi-field forms)",
            "Progress indicator shows 5 steps with current position highlighted",
            "Total time from first click to completion is under 2 minutes"]),
          ("As a new user, I want to choose my industry so that the system pre-loads relevant leads and email templates.",
           ["Given onboarding step 4, when user selects an industry, then lead APIs are queried for matching contacts",
            "At least 10 industry categories are available (solar, contracting, plumbing, roofing, HVAC, landscaping, etc.)",
            "Selected industry determines default email persona and template"]),
          ("As a returning user, I want to sign in with one click so that I can check my campaign status quickly.",
           ["Given a user with an existing account, when they visit the login page, then Clerk SSO completes in one click",
            "User is redirected to their dashboard immediately after auth"]),
         ]),
        ("Epic 2: Domain Management",
         "Connect custom domain (copy/paste DNS records, red/yellow/green status tracking) or select pre-warmed domain. 14-day warmup sequence handled by Mailforge.",
         [("As a user, I want to connect my custom domain by copying DNS records so that emails come from my business domain.",
           ["Given domain setup step, when user enters their domain name, then DNS records (DKIM, SPF, DMARC) are displayed for copying",
            "Copy-to-clipboard buttons are provided for each record",
            "Verification check runs automatically every 60 seconds after records are entered"]),
          ("As a user, I want to see domain health status (red/yellow/green) so that I know when my domain is ready.",
           ["Red status indicates DNS records not yet propagated or missing",
            "Yellow status indicates warmup in progress (days 1-13)",
            "Green status indicates domain is fully warmed and ready for campaigns",
            "Status updates in real-time without page refresh"]),
          ("As a non-technical user, I want to select a pre-warmed domain so that I can skip DNS setup entirely.",
           ["Given domain setup, when user selects 'Use our domain', then a pre-warmed domain is assigned within 60 seconds",
            "Pre-warmed domains have full DKIM/SPF/DMARC configured",
            "User can switch to custom domain later without losing campaign data"]),
         ]),
        ("Epic 3: Mailbox Configuration",
         "Connect email (Gmail, Yahoo, Proton, custom). Mailforge handles warm-up, IP rotation, verification.",
         [("As a user, I want to connect my Gmail account so that outreach emails send from my existing address.",
           ["Given mailbox setup, when user clicks 'Connect Gmail', then OAuth flow completes and mailbox is linked",
            "Mailforge begins warm-up sequence automatically after connection",
            "Connection status is visible on the dashboard"]),
          ("As a user, I want Mailforge to handle email warm-up automatically so that I do not have to learn about deliverability.",
           ["Warm-up begins within 1 hour of mailbox connection",
            "Send volume ramps from 5/day to 30/day over 14 days",
            "IP rotation is managed automatically by Mailforge",
            "User receives no technical notifications during warm-up (only completion notice)"]),
          ("As a user, I want to connect a custom email provider so that I can use my business email system.",
           ["Given mailbox setup, when user selects 'Other provider', then SMTP/IMAP fields are displayed",
            "Connection test runs before saving configuration",
            "Error messages use plain language (not technical SMTP codes)"]),
         ]),
        ("Epic 4: Lead Generation & Database",
         "Industry selection pre-loads leads from Apollo, A-Leads, Outscraper, Snov.io, D7 Lead Finder. Data freshness tracking.",
         [("As a user, I want the system to automatically find potential customers in my industry.",
           ["Given industry selection, system queries multiple lead APIs (Apollo, A-Leads, Outscraper, Snov.io, D7)",
            "At least 25 leads are available within 5 minutes of onboarding completion",
            "Leads include business name, contact name, email, phone, and location"]),
          ("As a user, I want to see how fresh my lead data is so that I am not emailing outdated contacts.",
           ["Each lead displays a freshness indicator (days since last verified)",
            "Leads older than 90 days are flagged with a warning",
            "System re-verifies lead emails before sending campaigns"]),
          ("As a user, I want to filter leads by location so that I can target customers in my service area.",
           ["Given the lead database, when user sets a location filter, then only leads within that area are displayed",
            "Filtering by city, state, or ZIP code radius is supported",
            "Filter persists across sessions"]),
         ]),
        ("Epic 5: AI Email Composition (GLM Engine)",
         "Email personas/frameworks ('The Closer,' 'The Neighbor'). GLM-5 LLM generates copy. Self-hosted via Ollama ($20/mo flat).",
         [("As a user, I want to select an email persona so that my outreach matches my business style.",
           ["At least 4 personas available: 'The Closer', 'The Neighbor', 'The Expert', 'The Helper'",
            "Each persona generates distinctly different email tone and structure",
            "Preview of generated email shown before confirming selection"]),
          ("As a user, I want the AI to write my emails for me so that I do not have to be a copywriter.",
           ["Given a selected persona and lead list, when user clicks 'Generate Emails', then GLM-5 produces personalized copy",
            "Each email is unique (no duplicate content across leads)",
            "Email length stays between 50-150 words"]),
          ("As a user, I want to edit AI-generated emails before they send so that I can add personal touches.",
           ["Inline editor allows text modification without leaving the campaign view",
            "Changes save automatically",
            "User can regenerate individual emails without affecting the full batch"]),
         ]),
        ("Epic 6: Campaign Engine & Send Management",
         "Low daily send limit (20-50 emails). Quality over volume approach. Domain reputation protection.",
         [("As a user, I want my emails to send automatically each day.",
           ["Emails send automatically during optimal hours (9am-12pm recipient timezone)",
            "Daily volume stays within 20-50 email limit",
            "Send pacing distributes emails across the day (not all at once)"]),
          ("As a user, I want the system to protect my domain reputation.",
           ["Send limits are enforced even if user requests higher volume",
            "Bounce rate monitoring pauses campaigns if bounces exceed 5%",
            "Domain reputation score is checked daily via Mailforge API"]),
          ("As a user, I want to see which emails were sent today.",
           ["Dashboard shows sent/delivered/opened/replied counts for current day",
            "Email list shows status icon for each sent message",
            "Real-time updates without page refresh"]),
         ]),
        ("Epic 7: Dashboard & Reporting",
         "Mobile-first design. Blue-collar friendly language. No tech jargon.",
         [("As a user, I want a simple dashboard that tells me how my emails are doing.",
           ["Dashboard displays 4 key numbers: Emails Sent, Replies, Interested, Calls Booked",
            "Numbers use large, readable fonts",
            "No charts, graphs, or analytics jargon on the main view"]),
          ("As a user, I want to check my dashboard from my phone while on a job site.",
           ["Dashboard is fully responsive and mobile-first",
            "Touch targets meet 44x44px minimum",
            "Page loads in under 2 seconds on 4G connection"]),
          ("As a user, I want notifications when someone replies so that I can follow up immediately.",
           ["Push notification sent within 60 seconds of reply detection",
            "Notification shows sender name and first line of reply",
            "One-tap opens the full reply in the app"]),
         ]),
        ("Epic 8: Spam & Deliverability Management",
         "EULA and in-app disclaimers shift responsibility for blacklisted domains/bad lists to user.",
         [("As a platform operator, I want users to accept responsibility for their email lists.",
           ["EULA explicitly states user responsibility for list quality and compliance",
            "In-app disclaimer shown before first campaign launch",
            "User must check acknowledgment box before sending"]),
          ("As a user, I want the system to verify email addresses before sending.",
           ["Mailforge pre-send verification runs on all leads before campaign launch",
            "Invalid emails are flagged and excluded automatically",
            "Verification results shown as pass/fail count before send confirmation"]),
          ("As a user, I want unsubscribe links in every email so that I stay compliant.",
           ["Every outgoing email includes a one-click unsubscribe link",
            "Unsubscribed contacts are permanently excluded from future sends",
            "Unsubscribe rate is tracked and displayed on dashboard"]),
         ]),
        ("Epic 9: Scaling & Growth Controls",
         "'Book a Call' CTA for scaling requests. Prevents system overload. Creates high-touch sales opportunity.",
         [("As a user, I want to request higher send volumes so that I can grow my outreach.",
           ["When user clicks 'Send More Emails', a 'Book a Call' CTA is presented",
            "Calendly or similar scheduling widget is embedded",
            "No self-service volume increase is available (prevents abuse)"]),
          ("As a platform operator, I want to manually approve scaling requests.",
           ["Admin dashboard shows pending scaling requests",
            "Each request includes user's current stats (send volume, bounce rate, reply rate)",
            "Approval triggers automatic volume increase in user's account"]),
          ("As a user, I want to understand why my volume is limited.",
           ["In-app messaging explains quality-over-volume philosophy",
            "Language is positive: 'We keep your sends low so every email lands in the inbox'",
            "Comparison data shows higher reply rates at lower volumes"]),
         ]),
        ("Epic 10: OpenClaw DWY Tier",
         "Done-With-You tier via WhatsApp or phone. OpenClaw agent handles entire campaign setup and management.",
         [("As a busy business owner, I want someone to handle my entire email outreach.",
           ["DWY tier includes complete campaign setup by OpenClaw agent",
            "Single phone call onboarding (15-30 minutes) replaces self-serve wizard",
            "Daily management updates sent via WhatsApp channel"]),
          ("As a DWY customer, I want to communicate via WhatsApp.",
           ["Dedicated WhatsApp channel created for each DWY customer",
            "Text and voice note communication supported",
            "Response time SLA of 4 hours during business hours"]),
          ("As a DWY customer, I want to see results without logging into a dashboard.",
           ["Weekly summary sent via WhatsApp with key metrics",
            "Format: plain text with numbers (no links, no charts)",
            "Monthly detailed report available on request"]),
         ]),
        ("Epic 11: Payments & Billing",
         "Stripe (US) + Paddle (global tax compliance). Self-Serve ~$300/mo, DWY ~$500/mo, Enterprise ~$3k setup.",
         [("As a user, I want to pay with my credit card to start my subscription immediately.",
           ["Stripe checkout handles US payments with instant activation",
            "Card details are never stored on ConvergeFlow servers (Stripe tokenization)",
            "Payment confirmation email sent within 60 seconds"]),
          ("As an international user, I want to pay in my local currency.",
           ["Paddle handles non-US payments with automatic tax calculation",
            "Local currency display at checkout",
            "Tax receipt generated automatically and emailed"]),
          ("As a user, I want to see my billing history so that I can track expenses.",
           ["Billing page shows all past invoices with download links",
            "Current plan and next billing date displayed prominently",
            "Cancel/downgrade option available without contacting support"]),
         ]),
    ]

    for title, desc, stories in epics:
        story.append(h1(title))
        story.append(gb())
        story.append(sp(4))
        story.append(body(desc))
        story.append(sp(6))

        for i, (us, criteria) in enumerate(stories, 1):
            story.append(h3(f"User Story {i}"))
            story.append(Paragraph(f"<i>{us}</i>", st['VTBody']))
            story.append(sp(3))
            story.append(callout("Acceptance Criteria:"))
            for c in criteria:
                story.append(bul(c))
            story.append(sp(6))
        story.append(pgb())

    return story


# ============================================================
# DOCUMENT 3: Technical Risk Register
# ============================================================
def doc3_story():
    st = sty()
    story = []

    story.append(Paragraph("Risk Register Overview", st['VTTitle']))
    story.append(gb())
    story.append(sp(8))
    story.append(body(
        "This document identifies and assesses 8 technical risks for the ConvergeFlow platform. "
        "Each risk is scored on likelihood (1-5) and impact (1-5) to produce a risk score. "
        "Mitigations and ownership are assigned for active management."
    ))
    story.append(sp(10))

    story.append(h2("Risk Summary Matrix"))
    story.append(sp(4))
    story.append(make_table(
        ["#", "Risk", "Severity", "Like.", "Impact", "Score", "Owner"],
        [["1", "ESP Prohibition", "CRITICAL", "4", "5", "20", "Kareem"],
         ["2", "LLM Cost Escalation", "HIGH", "3", "4", "12", "Kareem"],
         ["3", "Domain Rep. Damage", "HIGH", "3", "4", "12", "Cristiano"],
         ["4", "Lead Data Quality", "MEDIUM", "3", "3", "9", "Kareem"],
         ["5", "Mailforge Dependency", "MEDIUM", "2", "4", "8", "Cristiano"],
         ["6", "Scaling Degradation", "MEDIUM", "2", "3", "6", "Cristiano"],
         ["7", "CAN-SPAM Compliance", "MEDIUM", "2", "4", "8", "Kareem"],
         ["8", "OpenClaw Reliability", "LOW-MED", "2", "3", "6", "Kareem"]],
        [22, 100, 60, 40, 45, 40, 65]
    ))
    story.append(pgb())

    risks = [
        (1, "ESP Prohibition Risk", "CRITICAL", 4, 5, "Kareem Maize",
         "Traditional ESPs (Mailgun, AWS SES, SendGrid) have strict anti-cold-email policies. Cold outreach violates their Terms of Service. Using these providers risks account suspension, loss of sending infrastructure, and potential legal exposure.",
         ["Mailforge is purpose-built for cold email infrastructure and does not prohibit outreach",
          "No dependency on traditional ESPs eliminates TOS violation risk entirely",
          "Mailforge handles DNS configuration, warm-up, and IP rotation within their platform",
          "Contractual agreement with Mailforge explicitly covers cold email use case"],
         "MITIGATED - Mailforge selected"),

        (2, "LLM Cost Escalation", "HIGH", 3, 4, "Kareem Maize",
         "GPU clusters for self-hosted LLM inference cost approximately $2,000/month. If Ollama changes pricing, degrades service, or goes offline, the AI email generation capability is at risk.",
         ["Start with Ollama at $20/month flat rate (not token-based)",
          "Document migration path to self-hosted GPU cluster for scale",
          "Keep model requirements flexible: GLM-5 and Minimax 2.7 are both viable",
          "Monitor Ollama service reliability and pricing changes monthly",
          "Budget $2k/month GPU cluster as growth milestone"],
         "ACTIVE - Monitoring Ollama stability"),

        (3, "Domain Reputation Damage", "HIGH", 3, 4, "Cristiano Varriale",
         "Users who bring blacklisted domains or use poor-quality lead lists could damage the platform's overall reputation with email providers. Shared IP addresses mean one bad actor can affect deliverability for all users.",
         ["EULA and in-app disclaimers assign list quality responsibility to users",
          "Low send limits (20-50/day) prevent rapid reputation damage",
          "Quality-over-volume approach reduces spam complaints",
          "Mailforge pre-send verification catches invalid addresses",
          "Bounce rate monitoring pauses campaigns automatically if bounces exceed 5%"],
         "ACTIVE - Controls in place for MVP"),

        (4, "Lead Data Quality", "MEDIUM", 3, 3, "Kareem Maize",
         "API lead sources may return stale, incorrect, or duplicate data. Poor lead quality directly impacts email deliverability and user satisfaction.",
         ["Multi-provider strategy reduces single-source dependency",
          "Data freshness tracking system flags leads older than 90 days",
          "Pre-send email verification catches invalid addresses",
          "Future phase: proprietary scraping capability for higher-quality leads"],
         "ACTIVE - Multi-provider strategy implemented"),

        (5, "Single Provider Dependency - Mailforge", "MEDIUM", 2, 4, "Cristiano Varriale",
         "The entire email infrastructure depends on Mailforge. If Mailforge experiences downtime or discontinues service, ConvergeFlow cannot send emails.",
         ["Mailforge provides a documented API for all integrations",
          "Integration points documented for potential provider swap",
          "Monitor Mailforge reliability metrics monthly",
          "Evaluate backup providers quarterly (without active integration)"],
         "ACCEPTED - Monitoring in place"),

        (6, "Scaling Without Degradation", "MEDIUM", 2, 3, "Cristiano Varriale",
         "Uncontrolled user growth could degrade deliverability for existing users. Shared infrastructure means capacity is finite.",
         ["'Book a Call' CTA gates all scaling requests",
          "Manual approval process ensures capacity matches infrastructure",
          "Low default send limits keep per-user resource consumption predictable",
          "Infrastructure scaling plan documented for growth milestones"],
         "MITIGATED - Growth controls designed"),

        (7, "CAN-SPAM / Regulatory Compliance", "MEDIUM", 2, 4, "Kareem Maize",
         "Cold email must comply with CAN-SPAM (US), CASL (Canada), GDPR (EU), and other regional regulations. Non-compliance risks fines and platform shutdown.",
         ["EULA includes compliance requirements for all users",
          "Mandatory unsubscribe links in every outgoing email",
          "Low send limits reduce regulatory exposure",
          "Opt-out mechanisms meet CAN-SPAM requirements",
          "Legal review of EULA before launch"],
         "ACTIVE - Legal review pending"),

        (8, "OpenClaw Reliability for DWY Tier", "LOW-MEDIUM", 2, 3, "Kareem Maize",
         "OpenClaw is open-source and still maturing. Kareem noted difficulty running it on Mac. If OpenClaw fails during DWY operations, customer experience degrades.",
         ["Position DWY as premium tier with limited capacity (max 20 clients at launch)",
          "Manual fallback process documented for OpenClaw agent failures",
          "WhatsApp communication channel allows human intervention when agent fails",
          "Monitor OpenClaw project development and community stability"],
         "ACCEPTED - Limited launch scope"),
    ]

    for num, name, sev, lik, imp, owner, desc, mits, status in risks:
        story.append(h1(f"Risk {num}: {name}"))
        story.append(gb())
        story.append(sp(4))
        story.append(make_table(
            ["Severity", "Likelihood", "Impact", "Score", "Owner", "Status"],
            [[sev, str(lik), str(imp), str(lik*imp), owner, status]],
            [60, 60, 50, 50, 100, 120]
        ))
        story.append(sp(6))
        story.append(h3("Description"))
        story.append(body(desc))
        story.append(sp(4))
        story.append(h3("Mitigations"))
        for m in mits:
            story.append(bul(m))
        story.append(sp(4))
        story.append(pb())
        story.append(sp(10))

    return story


# ============================================================
# DOCUMENT 4: Brand Voice Document
# ============================================================
def doc4_story():
    st = sty()
    story = []

    story.append(h1("Tone & Philosophy"))
    story.append(gb())
    story.append(sp())
    story.append(body(
        "ConvergeFlow speaks like a trusted friend who happens to be great at email. "
        "Direct, confident, blue-collar friendly. No corporate BS. No tech jargon. "
        "Talk like a person, not a platform. Inspired by Sam Ovens: we eat our clients' complexity. "
        "All user-facing copy should be written at a 3rd grade reading level."
    ))
    story.append(sp(4))
    for p in [
        "<b>Simple first.</b> If a 12-year-old cannot understand it, rewrite it.",
        "<b>Action-oriented.</b> Every screen should tell the user what to do next.",
        "<b>Honest.</b> No hype, no fake urgency, no manipulation.",
        "<b>Warm but professional.</b> Friendly without being cheesy.",
        "<b>Confident.</b> We know this works. That confidence shows in every word.",
    ]:
        story.append(bul(p))

    story.append(pgb())

    story.append(h1("Language Rules: Word Substitutions"))
    story.append(gb())
    story.append(sp())
    story.append(body(
        "Replace corporate and technical language with words real people use. "
        "These substitutions apply to all user-facing copy including UI, emails, notifications, and marketing."
    ))
    story.append(sp(6))
    story.append(make_table(
        ["Instead of...", "Use..."],
        [["task", "job"], ["client", "customer"], ["proposal", "estimate"],
         ["mailbox configuration", "inbox"], ["prospects", "leads"],
         ["onboard", "get started"], ["campaigns", "your emails"],
         ["schedule a meeting", "book a call"]],
        [234, 234]
    ))

    story.append(pgb())

    story.append(h1("Banned Words"))
    story.append(gb())
    story.append(sp())
    story.append(body(
        "The following words are banned from all user-facing copy. "
        "These terms are either too corporate, too technical, or too jargon-heavy for our audience."
    ))
    story.append(sp(6))
    banned = [
        "pipeline", "deployment", "workflow", "integration", "optimization",
        "leverage", "synergy", "stakeholder", "scalable", "paradigm",
        "ROI (use 'money back')", "KPI", "CRM", "SaaS",
        "API (in user-facing copy)", "onboarding (use 'getting started')",
        "campaign (use 'emails')", ""
    ]
    rows = []
    for i in range(0, len(banned), 2):
        left = banned[i]
        right = banned[i+1] if i+1 < len(banned) else ""
        rows.append([left, right])
    story.append(make_table(["Banned Term", "Banned Term"], rows, [234, 234]))

    story.append(pgb())

    story.append(h1("Screen Names & UI Copy"))
    story.append(gb())
    story.append(sp())
    story.append(make_table(
        ["Technical Name", "User Sees"],
        [["Dashboard", "Home"], ["Campaigns", "Your Emails"],
         ["Leads Database", "Find Customers"], ["Settings", "Your Account"],
         ["Analytics", "How It's Going"], ["Templates", "Email Styles"],
         ["Support", "Need Help?"]],
        [234, 234]
    ))

    story.append(pgb())

    story.append(h1("10 Sample Messages"))
    story.append(gb())
    story.append(sp())
    story.append(make_table(
        ["Context", "Message"],
        [["Onboarding Welcome", "Let's get you some customers. Takes about 2 minutes."],
         ["Domain Setup", "Connect your website so emails come from you, not us."],
         ["Email Sent", "Your first batch went out. We'll let you know when someone replies."],
         ["Lead Found", "We found 47 potential customers in your area."],
         ["Campaign Active", "Your emails are going out. Sit back - we've got this."],
         ["Reply Received", "Someone's interested. Check your inbox."],
         ["Error / Bounce", "A few emails didn't go through. No worries - we'll try again."],
         ["Warmup in Progress", "We're warming up your inbox. Takes about 2 weeks, but you don't need to do anything."],
         ["Scaling Prompt", "Want to send more emails? Book a quick call and we'll set you up."],
         ["OpenClaw DWY Pitch", "Too busy to sit at a laptop? We'll handle everything. Just tell us what you need over WhatsApp."]],
        [110, 358]
    ))

    return story


# ============================================================
# DOCUMENT 5: Run-Rate Cost Model
# ============================================================
def doc5_story():
    st = sty()
    story = []

    story.append(Paragraph("Monthly OPEX Breakdown", st['VTTitle']))
    story.append(gb())
    story.append(sp(8))
    story.append(make_table(
        ["Service", "Provider", "Monthly Cost", "Notes"],
        [["Email Infrastructure", "Mailforge", "$20-50/mo", "DNS, provisioning, warm-up, IP rotation"],
         ["LLM Inference", "Ollama", "$20/mo flat", "Replaces ~$2k/mo GPU cluster"],
         ["Lead Generation APIs", "Apollo, A-Leads,\nOutscraper, Snov.io, D7", "$30-80/mo", "Multi-provider, pay-per-use"],
         ["Hosting & CDN", "Vercel + Cloudflare", "$20-40/mo", "Bot protection included"],
         ["Database", "Firebase", "$9-25/mo", "General data storage"],
         ["Vector DB (RAG)", "Supabase", "$0-25/mo", "Free tier initially"],
         ["Auth", "Clerk", "$0-25/mo", "Free tier up to limit"],
         ["Error Monitoring", "Sentry", "$0-9/mo", "Free tier initially"],
         ["Logging", "GCP Monitoring", "$0-20/mo", "Slack alerts integration"],
         ["Payments", "Stripe + Paddle", "$0/mo fixed", "Transaction % only"]],
        [95, 100, 75, 198]
    ))
    story.append(sp(10))
    story.append(Paragraph(
        '<b><font color="#96F01E">TOTAL MONTHLY OPEX: $119 - $274/mo</font></b>', st['VTBody']))

    story.append(pgb())

    story.append(h1("Scale Scenarios"))
    story.append(gb())
    story.append(sp(8))
    story.append(make_table(
        ["Phase", "Users", "Est. Monthly Cost", "Key Cost Drivers"],
        [["Pre-launch", "0 users", "~$119/mo", "Base infrastructure costs only"],
         ["Early Traction", "1-50 users", "~$174/mo", "Lead API usage, Clerk auth scaling"],
         ["Growth", "50-200 users", "~$274/mo", "Higher lead API, Firebase scaling, support"],
         ["Scale Trigger", "200+ users", "~$2,000+/mo", "GPU cluster for self-hosted LLM"]],
        [85, 65, 100, 218]
    ))

    story.append(sp(14))
    story.append(h1("Breakeven Analysis"))
    story.append(gb())
    story.append(sp(8))
    story.append(body(
        "At $300/month per Self-Serve customer, ConvergeFlow reaches breakeven at 1 paying customer. "
        "This is possible because the entire infrastructure runs on managed services with minimal fixed costs."
    ))
    story.append(sp(6))
    story.append(make_table(
        ["Metric", "Value"],
        [["Self-Serve Price", "$300/mo"],
         ["Pre-launch OPEX", "$119/mo"],
         ["Breakeven Point", "1 customer"],
         ["Gross Margin (1 customer)", "~60%"],
         ["Gross Margin (50 customers)", "~98%"],
         ["DWY Price (OpenClaw)", "$500/mo"],
         ["Enterprise Setup", "~$3,000 + retainer"]],
        [200, 268]
    ))

    story.append(pgb())
    story.append(h1("Cost Advantage: Self-Hosted LLM"))
    story.append(gb())
    story.append(sp(8))
    story.append(body(
        "The single largest cost advantage ConvergeFlow holds over competitors is the self-hosted LLM via Ollama. "
        "While competitors using OpenAI or Anthropic APIs pay per-token (costs scale linearly with usage), "
        "ConvergeFlow pays a flat $20/month regardless of email volume."
    ))
    story.append(sp(6))
    story.append(make_table(
        ["Approach", "Cost @ 1k emails", "Cost @ 10k emails", "Cost @ 100k emails"],
        [["OpenAI API (GPT-4)", "~$50/mo", "~$500/mo", "~$5,000/mo"],
         ["Anthropic API (Claude)", "~$40/mo", "~$400/mo", "~$4,000/mo"],
         ["Ollama (GLM-5)", "$20/mo", "$20/mo", "$20/mo"],
         ["Self-hosted GPU", "$2,000/mo", "$2,000/mo", "$2,000/mo"]],
        [115, 105, 110, 118]
    ))

    return story


# ============================================================
# DOCUMENT 6: 14-Day Launch Sequence
# ============================================================
def doc6_story():
    st = sty()
    story = []

    story.append(Paragraph("Launch Sequence Overview", st['VTTitle']))
    story.append(gb())
    story.append(sp(8))
    story.append(body(
        "Every new ConvergeFlow user goes through a 14-day automated launch sequence. "
        "The user completes 5 clicks on Day 0 and does nothing else until Day 14, when their first campaign goes live. "
        "Everything in between is handled by the platform automatically."
    ))
    story.append(sp(4))
    story.append(Paragraph(
        '<b><font color="#96F01E">Key principle: The user does nothing after Day 0. '
        'They get one notification on Day 14 saying their emails are going out.</font></b>', st['VTBody']))

    story.append(pgb())

    story.append(h1("Day-by-Day Timeline"))
    story.append(gb())
    story.append(sp(8))
    story.append(make_table(
        ["Day", "Phase", "Actions (Automated)", "Volume", "Status"],
        [["0", "Onboarding", "User completes 5-click wizard:\nAuth > Domain > Mailbox > Industry > Template", "0", "RED"],
         ["1-3", "DNS Setup", "DNS propagation & domain verification.\nMailforge configures DKIM, SPF, DMARC.", "0", "RED>YLW"],
         ["4-7", "Early\nWarm-up", "Mailbox warm-up begins.\nMailforge sends/receives in warm-up network.", "5-10/day", "YELLOW"],
         ["8-10", "Ramp Up", "Warm-up volume increases.\nInbox placement testing via Mailforge API.", "10-20/day", "YELLOW"],
         ["11-13", "Final\nWarm-up", "GLM generates first campaign emails.\nLead list pulled from APIs and verified.", "20-30/day", "YLW>GRN"],
         ["14", "GO LIVE", "Campaign goes live.\nUser notified. Dashboard shows activity.", "20-50/day", "GREEN"]],
        [32, 52, 220, 52, 52]
    ))

    story.append(pgb())

    story.append(h1("Visual Timeline (Gantt)"))
    story.append(gb())
    story.append(sp(8))
    story.append(make_table(
        ["Phase", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"],
        [["Onboard", "X", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
         ["DNS", "", "X", "X", "X", "", "", "", "", "", "", "", "", "", "", ""],
         ["Warm-up", "", "", "", "", "X", "X", "X", "X", "X", "X", "X", "X", "X", "X", ""],
         ["AI Gen", "", "", "", "", "", "", "", "", "", "", "", "X", "X", "X", ""],
         ["LIVE", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "X"]],
        [52] + [26] * 15
    ))

    story.append(pgb())

    story.append(h1("Post-Launch Operations"))
    story.append(gb())
    story.append(sp(8))
    story.append(body("Once a user's campaign is live (Day 14+), the following automated operations continue:"))
    story.append(sp(4))
    for x in [
        "<b>Daily sends:</b> 20-50 emails per day, paced across optimal hours",
        "<b>Reply monitoring:</b> Push notifications within 60 seconds of reply detection",
        "<b>Bounce tracking:</b> Campaigns auto-pause if bounce rate exceeds 5%",
        "<b>Domain health:</b> Daily reputation checks via Mailforge API",
        "<b>Lead refresh:</b> Stale leads (90+ days) flagged for re-verification",
        "<b>Scaling path:</b> 'Book a Call' CTA presented when user requests higher volume",
    ]:
        story.append(bul(x))

    story.append(sp(14))
    story.append(h1("User Communication Schedule"))
    story.append(gb())
    story.append(sp(8))
    story.append(make_table(
        ["Day", "Communication", "Channel"],
        [["0", "Welcome: 'Let's get you some customers.'", "In-app + Email"],
         ["1", "DNS: 'We're setting up your email. Nothing to do.'", "Email"],
         ["7", "Progress: 'Halfway there. Your inbox is warming up.'", "Email"],
         ["13", "Preview: 'Tomorrow your emails start going out.'", "Push + Email"],
         ["14", "Live: 'Your emails are going out. Sit back.'", "Push + Email"],
         ["21", "Check-in: 'Here's how your first week went.'", "Email"]],
        [35, 310, 95]
    ))

    return story


# ============================================================
# DOCUMENT 7: Provider Decision Matrix
# ============================================================
def doc7_story():
    st = sty()
    story = []

    story.append(Paragraph("Provider Decision Matrix", st['VTTitle']))
    story.append(gb())
    story.append(sp(4))
    story.append(body(
        "All technology provider decisions for ConvergeFlow MVP, reviewed and approved by founder Kareem Maize. "
        "Each selection includes alternatives considered and rationale for the final choice."
    ))
    story.append(pgb())

    providers = [
        ("Email Infrastructure", "Mailforge", "Mailgun, AWS SES, SendGrid",
         "Purpose-built for cold email. No red tape. Handles DNS, warm-up, IP rotation. Traditional ESPs prohibit cold email.", "APPROVED"),
        ("LLM Inference (MVP)", "Ollama", "GPU cluster, OpenAI API, Anthropic API",
         "$20/mo flat vs $2k/mo GPUs. Not token-based. Sufficient for MVP volume.", "APPROVED"),
        ("LLM Model", "GLM-5 / Minimax 2.7", "GPT-4, Claude, Llama",
         "Open-source, self-hostable. Zero token costs at scale. Custom fine-tuning possible.", "APPROVED"),
        ("Lead Generation", "Multi-API (Apollo, A-Leads,\nOutscraper, Snov.io, D7)", "Single provider, proprietary DB",
         "Diversified sources reduce single-provider risk. Data freshness tracking.", "APPROVED"),
        ("Frontend", "Next.js", "React SPA, Vue, Svelte",
         "SSR for performance. React ecosystem. Team expertise. Vercel deployment.", "APPROVED"),
        ("Backend", "Node.js", "Python/Django, Go",
         "JavaScript full-stack. Fast development. Shared types with frontend.", "APPROVED"),
        ("Database", "Firebase", "PostgreSQL, MongoDB",
         "Real-time capabilities. Easy setup. Scales with usage. Good free tier.", "APPROVED"),
        ("Vector DB", "Supabase", "Pinecone, Weaviate, Qdrant",
         "Free tier. pgvector integration. RAG-ready for knowledge base.", "APPROVED"),
        ("Hosting", "Vercel + Cloudflare", "AWS, GCP, Railway",
         "Easy deployment. Bot protection. Edge network. Good DX.", "APPROVED"),
        ("Auth", "Clerk", "Auth0, Firebase Auth, NextAuth",
         "Google/Facebook SSO. Simple integration. Free tier. Good React components.", "APPROVED"),
        ("Payments (US)", "Stripe", "Square, Braintree",
         "Industry standard. Easy setup. Good docs. Subscription management.", "APPROVED"),
        ("Payments (Global)", "Paddle", "Stripe Tax, FastSpring",
         "Handles international tax compliance automatically. Merchant of record.", "APPROVED"),
        ("Banking", "Mercury", "Chase, SVB",
         "Startup-friendly. Easy LLC banking setup. Good API.", "APPROVED"),
        ("Error Monitoring", "Sentry", "Bugsnag, Rollbar",
         "Free tier. Good Next.js integration. Source maps.", "APPROVED"),
        ("Logging", "GCP Monitoring", "Datadog, New Relic",
         "Cost-effective. Slack alerts integration. Sufficient for MVP.", "APPROVED"),
        ("Support", "Zendesk", "Intercom, Freshdesk",
         "Ticket system. Optional $1k AI chatbot add-on. Scales well.", "APPROVED"),
        ("AI Agent (DWY)", "OpenClaw", "Custom build, AgentGPT",
         "Open-source. Free. WhatsApp integration possible. Phase 2 deployment.", "APPROVED\n(Phase 2)"),
    ]

    for cat, sel, alts, rationale, status in providers:
        story.append(h2(cat))
        story.append(pb())
        story.append(sp(3))
        story.append(make_table(
            ["Field", "Value"],
            [["Selected Provider", sel],
             ["Alternatives Considered", alts],
             ["Rationale", rationale],
             ["Status", status]],
            [120, 348]
        ))
        story.append(sp(8))

    story.append(pgb())

    # Summary table
    story.append(h1("Complete Decision Summary"))
    story.append(gb())
    story.append(sp(8))
    story.append(make_table(
        ["Category", "Selected", "Status"],
        [[cat, sel, status] for cat, sel, _, _, status in providers],
        [130, 210, 128]
    ))

    story.append(sp(24))
    story.append(pb())
    story.append(sp(10))
    story.append(Paragraph(
        '<b><font color="#96F01E">Approved: Kareem Maize - March 30, 2026</font></b>', st['VTBody']))
    story.append(sp(4))
    story.append(body(
        '<font color="#999999">Technical Program Manager: Cristiano Varriale (christian@varritech.com)</font>'))

    return story


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    print("=" * 60)
    print("  Varritech PDF Generator for ConvergeFlow")
    print("=" * 60)
    print()

    docs = [
        ("competitor-teardown.pdf", "Competitor Teardown: 5-Platform Analysis", "Cold Email Platform Landscape Review", doc1_story),
        ("prd-v1.pdf", "Product Requirements Document v1", "User Stories & Acceptance Criteria - All 11 Epics", doc2_story),
        ("technical-risk-register.pdf", "Technical Risk Register", "8 Identified Risks with Mitigations", doc3_story),
        ("brand-voice-doc.pdf", "ConvergeFlow Brand Voice Guide", "Language, Tone & UI Copy Standards", doc4_story),
        ("run-rate-cost-model.pdf", "Run-Rate Cost Model", "Monthly OPEX Breakdown: $119-$274/mo", doc5_story),
        ("14-day-launch-sequence.pdf", "14-Day Launch Sequence", "Domain Warm-Up to Live Campaign Timeline", doc6_story),
        ("provider-decision-matrix.pdf", "Provider Decision Matrix", "Signed Off by Kareem - March 30, 2026", doc7_story),
    ]

    for filename, title, subtitle, story_fn in docs:
        print(f"Generating: {filename}...")
        _build_merged(os.path.join(OUTPUT_DIR, filename), title, subtitle, story_fn)
        print(f"  Done: {os.path.join(OUTPUT_DIR, filename)}")

    print()
    print("=" * 60)
    print("  All 7 PDFs generated successfully!")
    print(f"  Output directory: {OUTPUT_DIR}")
    print("=" * 60)
