# Agentic Personalization at Scale
## Beyond Abandoned Cart: How Identity, Context, and AI Agents Unlock True 1:1 Marketing

---

## The Scale Problem

Think about a brand like Gap Inc. — four iconic brands, thousands of stores, tens of millions of consumers across every region, every demographic, every life stage. Anyone subscribed to their email list knows the reality: batch sends, seasonal campaigns, promotional blasts. The same email to millions.

Every brand at this scale wants to get to 1:1 — highly dynamic, deeply personalized experiences for every individual. But the gap (no pun intended) between aspiration and execution is enormous.

**If we can solve personalized activation at Gap's scale, we can solve it for any industry, any vertical, any brand.**

---

## Where Personalization Stalls Today

Marketers have built a reliable playbook around high-signal, repeatable moments:

| Journey | Signal | Why It Works |
|---------|--------|--------------|
| **Abandoned Cart** | Added to cart, didn't purchase | Clear purchase intent — the strongest behavioral signal we have |
| **Abandoned Browse** | Viewed products, left site | Slightly weaker intent, but still a directional signal |
| **Welcome Series** | New subscriber or customer | Predictable lifecycle moment |
| **Post-Purchase** | Order confirmed | Known state change, easy to trigger |

These journeys work because the signals are **obvious, repeatable, and easy to automate**. They're table stakes.

But after these? The intent signals get harder to spot. The journey logic gets harder to define. The personalization gets harder to scale. So most marketers stop here.

**The result: brands are leaving an enormous amount of value on the table.**

---

## The Insight: Consumers Are Telling Us Everything

Consumers express meaningful life events constantly — through their clickstream behavior, past purchases, explicit first-party and zero-party data, and enriched third-party context:

- A customer browsing SPF products and beach accessories after searching flights
- A loyalty member who mentioned a wedding to a clientelling associate in-store
- A VIP shopper whose browse patterns shifted from professional wear to baby and maternity
- A long-dormant customer who just re-engaged with a fragrance campaign after a life change

**The context is there. The challenge has never been capturing it — it's been scaling the activation of it.**

A marketing team can't realistically build a bespoke journey for every individual consumer based on their unique context payload. They don't have the time, the tools, or the operational model to do it.

**But agents can.**

---

## The Architecture: Identity + Context + Agents + Humans

### Data and Identity: Merkury as the Foundation

Everything starts with knowing who you're talking to. Merkury — Merkle's proprietary identity resolution platform — is the superpower that makes this work:

- **On-site recognition**: Merkury identifies consumers in real-time, even before authentication, resolving anonymous visitors to known identity graphs
- **In-store enrichment**: Merkury Server-Side (tagless) enriches walk-in customers in real-time, giving clientelling associates and agents immediate context without requiring the customer to identify themselves
- **Media attribution at the person level**: Merkury resolves which media exposure brought a consumer in — what ad, what channel, what campaign. This is particularly powerful in B2B contexts where a LinkedIn ad targeting CMOs means something very different than organic search
- **Cross-device, cross-channel resolution**: A single consumer identity across web, app, store, call center, and media touchpoints

Merkury doesn't just tell us *what* happened — it tells us *who* it happened to, and what else we know about them.

### Context Mining: Finding the Moments That Matter

With identity resolved, we mine for context from every touchpoint:

**Digital Signals**
- Browse sessions: categories viewed, products examined, time spent, device
- Purchase history: recency, frequency, monetary value, product affinities
- Engagement patterns: email opens, click-throughs, app activity

**Conversational Signals**
- AI advisor conversations: "I have a beach trip next month and I have sensitive skin"
- In-store clientelling: "She mentioned she's planning a wedding in June"
- Service interactions: product concerns, returns patterns, satisfaction signals

**Enriched Signals**
- Loyalty tier and trajectory (ascending, stable, at-risk)
- Appended lifestyle and demographic data (with careful data provenance governance)
- Media context: what campaign or ad drove this visit, and what does that tell us about intent

**Temporal Intelligence**
- We don't just capture events — we parse timing: "in two weeks," "next month," "this Saturday"
- We calculate actual event dates from relative expressions
- We classify urgency: Immediate, This Week, This Month, Future

All of this context gets packaged into a rich payload for every individual consumer.

### AI Agents: Turning Context into Action

This is where the paradigm shifts. We feed that context payload to AI agents — in our case, Salesforce Agentforce — and the agent does what no human team could do at scale:

1. **Understand** the consumer's unique situation from their full context
2. **Generate** a bespoke multi-step journey tailored to that individual
3. **Recommend** specific products based on affinity, event type, and profile
4. **Compose** personalized content — subject lines, body copy, even creative
5. **Orchestrate** timing and channel selection across email, SMS, push, web, and media
6. **Score** its own confidence in the recommendation

A two-step journey for a VIP planning a destination wedding looks completely different from a three-step journey for a new customer who just browsed skincare after a mentioned breakout concern. The agent designs both — simultaneously, at scale, for millions of consumers.

### Humans in the Loop: Expertise at the Point of Decision

Agents generate. Humans govern.

We don't auto-send everything. We distribute ownership to **portfolio managers** — domain experts who are responsible for specific segments of the customer base:

| Portfolio | Owner Expertise | Example |
|-----------|----------------|---------|
| **Wedding & Celebrations** | Bridal beauty specialist | Reviews journeys triggered by wedding/engagement events |
| **Travel & Adventure** | Travel-ready product curator | Reviews journeys for trip-related events |
| **VIP Platinum** | High-touch relationship manager | Reviews all journeys for top-tier loyalty members |
| **Northeast Region** | Regional merchandising lead | Reviews journeys for customers in NE markets |
| **New Customer Nurture** | Onboarding specialist | Reviews welcome and early-lifecycle journeys |

Each portfolio manager sees an approval queue ranked by priority — urgency of the event, value of the customer, and confidence of the AI's recommendation.

**The confidence score is critical.** It articulates how confident the AI is that the detected event and recommended journey are actually relevant:

- A customer who explicitly said *"I'm planning a trip to Mexico, leaving February 28th"* — **high confidence**. We have an explicit date, rich context, clear intent.
- A customer whose browse patterns vaguely suggest packing or travel — **lower confidence**. The signal is there, but it's inferential.

This confidence drives automation thresholds:

| Confidence | Tier | What Happens |
|------------|------|--------------|
| **90-100** | Auto-Send | Fires automatically after a 4-hour review window |
| **70-89** | Soft Review | Auto-fires in 4 hours unless the marketer intervenes |
| **40-69** | Review Required | Marketer must explicitly approve before anything sends |
| **Below 40** | Escalate | Requires manager review — the signal is too weak for a line reviewer |

**Different portfolios can set different thresholds.** A dormant customer re-engagement portfolio might auto-send at a lower confidence threshold — the downside risk is low. A VIP segment might keep human-in-the-loop always — these are your highest-value relationships and the stakes of getting it wrong are too high.

The human in the loop serves two purposes:
1. **Quality control** — Is the event real? Is the journey recommendation actually good? Does the creative make sense?
2. **Cost control** — Every image generation calls a production API (Adobe Firefly). Human review before activation minimizes unnecessary API consumption on low-quality recommendations.

---

## What This Looks Like in Practice

### Capture: Finding the Moment

**On-site (Beauty Advisor Chat)**
> Customer: "I have a beach trip coming up next month and my skin is really dry lately"

The AI agent:
- Detects a **life event**: travel/trip
- Parses **temporal context**: "next month" = ~30 days out
- Notes a **concern**: dry skin
- Recommends SPF + hydration products immediately
- Generates a **visual scene**: products composited into a tropical beach setting using Adobe Firefly
- Silently captures the event for downstream journey generation

**In-store (Clientelling)**

A walk-in customer enters a store location. Merkury Server-Side identifies them in real-time. The clientelling copilot enriches the associate's view with:
- Loyalty status, recent purchases, known preferences
- Recommended conversation topics (surfaced carefully — more on data provenance below)
- Previous meaningful events and active journeys

The associate learns the customer is preparing for a wedding. The copilot captures the event with context the customer shared willingly.

**From Media Context**

A consumer clicks through from a LinkedIn ad targeting marketing executives interested in sustainability. Merkury resolves who they are. The agent now knows: this person came in through a B2B sustainability campaign — that context enriches the conversation and downstream activation. In a B2C context, a consumer who clicked a "Summer Travel Essentials" display ad carries that intent signal forward.

### Generate: Building the Journey

The nightly batch process picks up newly captured events and builds personalized journeys:

**Example: Wedding Journey (High Confidence — Score: 87)**
- **Step 1** (Day 0, Email): "Your Bridal Beauty Countdown Starts Now" — Curated skincare regimen for the 6 weeks before the wedding, featuring products matched to her skin type and concerns
- **Step 2** (Day 14, SMS): Quick reminder with a link to her personalized bridal beauty kit
- **Step 3** (Day 35, Email): "One Week to Go" — Final prep products, travel-sized favorites for the destination

Each step includes AI-generated subject lines, personalized copy, recommended products, and a Firefly-generated hero image compositing her recommended products into a bridal beauty scene.

**Example: Vague Travel Signal (Low Confidence — Score: 32)**
- Browse data shows luggage and travel-sized products viewed
- No explicit mention of a trip, no date
- Journey created but escalated for manager review
- Manager can approve with edits, or decline — the signal may be noise

### Route: Getting It to the Right Expert

The system evaluates every journey against portfolio definitions:

1. Does this customer match a **segment**? (e.g., Northeast region based on mailing state, VIP based on loyalty tier, wedding based on event type)
2. Which portfolio has the **best-fit specialist** for this type of event?
3. Is the portfolio at **capacity**, or can it absorb more?
4. What's the **priority order** for tiebreaking?

A wedding event for a VIP customer in the Northeast could match three portfolios. The routing engine scores each, and the highest-fit portfolio wins — with priority ordering breaking ties.

### Review: Human Expertise at Scale

The portfolio manager opens their approval dashboard and sees:

- **Priority-ranked queue** — most urgent and valuable at the top
- **Confidence score and tier** — immediately understands the AI's certainty
- **Full event context** — what was captured, when, from what source
- **AI-generated journey** — subject, body, products, creative
- **Edit capabilities** — swap products, adjust copy, regenerate images with a custom prompt
- **One-click actions** — Approve, Decline with reason, Send

### Activate: Cross-Channel Orchestration

Approved journeys fire across channels:

- **Email** — Rich HTML with personalized content and composited product imagery
- **SMS** — Concise, action-oriented messages
- **Push Notifications** — Mobile app engagement
- **Web Personalization** — On-site experience tailored to the active journey
- **Media Activation** — Think: a CTV ad on Hulu that only runs if the consumer didn't open the email, SMS, or push notification on a high-value journey. The journey spans owned AND paid channels.

---

## The Flywheel: Media + CRM + AI

This isn't a linear funnel. It's a flywheel:

```
    Media Intelligence + Targeting
              |
              v
    Identity Resolution (Merkury)
              |
              v
    Context Assembly (Browse, Purchase, Conversation, Profile, Media)
              |
              v
    AI Agent Processing (Understand, Generate, Score)
              |
              v
    Human Review + Approval (Portfolio Experts)
              |
              v
    Cross-Channel Activation (Email, SMS, Push, Web, Media)
              |
              v
    Engagement Data + New Signals
              |
              v
    [Back to Identity + Context]
```

Every activation generates new engagement data. Every new signal enriches the context. Every enriched context feeds better AI recommendations. The flywheel accelerates.

**Media becomes both an activation channel and an enrichment source.** What media brought you in tells us something about who you are and what you care about. Merkury lets us understand that at the person level. That intelligence feeds back to the agent, which uses it to design smarter journeys that span both owned and paid channels.

We are creating the **media + CRM flywheel** — using media intelligence and targeting, combined with data and identity, to feed AI agents that generate cross-channel custom experiences. Humans stay in the loop to review, refine, and activate.

---

## Push vs. Pull: A New Mental Model

This approach transforms **pull marketing** — finding more individual moments to act on, more reasons to reach out with something genuinely relevant and timely. It won't replace **push marketing** where we need batch activations to drive demand.

But here's where it gets interesting: **push campaigns become context engineering exercises.**

When we design a promotional email blast or a seasonal campaign, we're not just trying to drive opens and clicks. We're mining for context cues:
- What are we looking for users to do in response?
- What behaviors might they exhibit that signal a deeper intent?
- What kind of bespoke journey might the agent recommend if they start engaging with our push campaign?

The batch email becomes a **signal generator**. The engagement data feeds back into the context assembly layer. The agents pick up new signals and generate new personalized journeys. Push and pull work together.

---

## Data Provenance: The Guardrails That Matter

With great data comes great responsibility. We've built a comprehensive data provenance strategy around what agents (and humans) should and shouldn't surface:

**Safe to Reference Explicitly**
- Information the customer shared directly: "You mentioned you have sensitive skin when you visited our SoHo store last month"
- Loyalty status and rewards: "As a Platinum member, you have early access to..."
- Purchase history: "Based on your recent order of..."
- Explicitly captured preferences: "Since you prefer fragrance-free products..."

**Use to Inform, Never to Mention**
- Appended household income or demographic data
- Inferred life stage from third-party enrichment
- Media exposure history (don't say "we saw you clicked our LinkedIn ad")
- Behavioral scoring and propensity models

The agent uses enriched data to make better recommendations, but it only *references* what the consumer would expect you to know. This isn't just about compliance — it's about trust.

---

## The Business Case: Why This Matters Now

### The Pricing Pressure Reality

Implementation pricing is facing dramatic downward pressure. AI and turnkey solutions make standing up technology faster and cheaper every quarter. If we compete on implementation effort, we lose.

**We have to compete on outcomes.**

This model shifts the value conversation:
- From "how many hours to implement" to "how much incremental revenue per personalized touchpoint"
- From "what features does the platform have" to "how many more 1:1 moments can we activate"
- From technology deployment to **operational transformation**

### The Change Management Opportunity

The real value isn't in the code — it's in the new operating model:

1. **Portfolio-based ownership** — Breaking down silos between channels, giving domain experts cross-channel authority over their customer segments
2. **Agents in the flow of work** — Marketing teams operating with AI agents as co-pilots, not as separate tools in separate workflows
3. **Confidence-driven governance** — Clear frameworks for when to trust the AI and when to intervene, tunable by segment and risk tolerance
4. **Data provenance strategy** — Defining what data feeds the AI, what surfaces to consumers, and what stays behind the curtain
5. **Cross-channel orchestration** — Journeys that span email, SMS, push, web, and paid media as a unified experience, not siloed channel campaigns

This is change management work. It's strategy work. It's the kind of work that drives transformation and sustains long-term partnerships.

---

## What We Built: The Demo

Everything described above is running in a fully functional demonstration environment built on Salesforce's ecosystem:

### Consumer Experience
- **React storefront** with integrated AI Beauty Advisor (powered by Agentforce)
- Real-time product recommendations with **AI-generated visual scenes** (Adobe Firefly + Google Imagen)
- **Browse tracking** capturing every category, product, and session
- **Conversational event capture** — the agent detects and records life events mid-conversation
- **Merkury-integrated identity** — anonymous visitors resolved to known profiles

### In-Store Experience
- **Clientelling Copilot** embedded in Service Cloud for sales associates
- Real-time customer enrichment for walk-ins via Merkury Server-Side
- Guided conversation topics, product recommendations, and event capture
- Consultation notes and appointment management

### Backend Intelligence
- **13 segment definitions** with structured criteria (regional, VIP, behavioral, lifecycle, event-based)
- **Rules engine** that evaluates segment membership across 6 data sources in real-time
- **Nightly batch processing** that turns captured events into multi-step personalized journeys
- **Confidence scoring** reflecting how certain the AI is about each recommendation
- **Temporal intelligence** parsing relative time expressions into actionable dates and urgency levels

### Operational Layer
- **Portfolio management** with segment-based, regional, event-specialist, and VIP routing
- **Priority-ranked approval queues** for portfolio managers
- **Automation tiers** — auto-send, soft review, review required, escalate — configurable per portfolio
- **In-line editing** — swap products, adjust copy, regenerate creative before activation
- **Cross-channel send** — email, SMS, push via Marketing Cloud Advanced with platform event integration

### The Numbers (Demo Configuration)
- **13 customer segments** with real evaluation criteria
- **5 portfolio types** with intelligent routing and load balancing
- **4 automation tiers** with configurable confidence thresholds
- **3 channels** orchestrated per journey (email, SMS, push) with media activation framework
- **6 data sources** evaluated per segment (Contact, Loyalty, Orders, Events, Browse, Profile)

---

## The Bottom Line

Every brand wants 1:1 personalization. Most stop at abandoned cart because scaling beyond the obvious signals is operationally impossible with traditional tools and teams.

**Agents change the math.**

Identity tells us who. Context tells us what matters to them right now. Agents turn that understanding into personalized, multi-step, cross-channel journeys — at a scale no human team could achieve. And humans stay in the loop where it matters most — governing quality, protecting brand relationships, and making the final call on high-value moments.

This isn't a future-state vision. We built it. It's running. And if it works for a brand with the scale and complexity of Gap — it works for everyone.

---

*Built with Salesforce Agentforce, Adobe Firefly, Google Imagen, Merkury Identity, and Marketing Cloud Advanced.*
*Designed and developed by Merkle.*
