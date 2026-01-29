# Agentic Commerce Demo - Technical Specification

## Project Overview

Build a conversation-first, generative commerce experience using Salesforce Agentforce Vibes with React. The demo showcases a "beauty concierge" that transforms the UI dynamically based on conversation context, generating personalized product recommendations with AI-generated contextual backgrounds.

### Demo Flow Summary

1. **Opening Scene**: Minimalist page with centered chat input - "I'm your beauty concierge, how can I help today?"
2. **Product Discovery**: User asks for moisturizer → UI morphs, product appears hero-style with generative bathroom scene background
3. **Quick Purchase**: User says "buy it" → Frictionless checkout overlay with stored payment
4. **Contextual Expansion**: User mentions India trip → Scene transforms to travel kit with luggage/toiletries background

### Core Technologies

| Layer | Technology |
|-------|------------|
| Frontend Framework | React 18+ with TypeScript |
| Salesforce Platform | Agentforce Vibes (React support) |
| AI Agent | Agentforce with custom Topics/Actions |
| Generative Images | Adobe Firefly API (or DALL-E 3 fallback) |
| Product Catalog | Salesforce Commerce Cloud (or mock data for demo) |
| Customer Data | Salesforce Data Cloud (or mock profiles for demo) |
| Animations | Framer Motion |
| Styling | Tailwind CSS |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Application                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Scene       │  │ Product     │  │ Agentforce Chat         │  │
│  │ Manager     │  │ Showcase    │  │ Component               │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                      │                │
│         └────────────────┼──────────────────────┘                │
│                          │                                       │
│                    ┌─────▼─────┐                                │
│                    │ App State │                                │
│                    │ (Context) │                                │
│                    └─────┬─────┘                                │
└──────────────────────────┼──────────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │Agentforce│ │ Firefly  │ │ Commerce │
       │   API    │ │   API    │ │   API    │
       └──────────┘ └──────────┘ └──────────┘
```

---

## Project Structure

```
agentic-commerce-demo/
├── README.md
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
├── .env.example
├── .env.local                    # API keys (gitignored)
│
├── public/
│   ├── index.html
│   └── assets/
│       ├── logo.svg
│       └── fallback-backgrounds/  # Pre-generated fallback images
│           ├── bathroom-scene.jpg
│           ├── travel-scene.jpg
│           └── lifestyle-scene.jpg
│
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Main app component
│   ├── index.css                 # Global styles + Tailwind
│   │
│   ├── components/
│   │   ├── ConciergePage/
│   │   │   ├── index.tsx         # Main page orchestrator
│   │   │   ├── ConciergePage.tsx
│   │   │   └── ConciergePage.test.tsx
│   │   │
│   │   ├── ChatInterface/
│   │   │   ├── index.tsx
│   │   │   ├── ChatInterface.tsx      # Chat input + message display
│   │   │   ├── ChatInput.tsx          # Styled input with mic icon
│   │   │   ├── ChatMessages.tsx       # Message bubbles
│   │   │   └── TypingIndicator.tsx    # Agent typing animation
│   │   │
│   │   ├── ProductShowcase/
│   │   │   ├── index.tsx
│   │   │   ├── ProductShowcase.tsx    # Main product display
│   │   │   ├── ProductHero.tsx        # Single product hero layout
│   │   │   ├── ProductGrid.tsx        # Multi-product grid layout
│   │   │   ├── ProductCard.tsx        # Individual product card
│   │   │   └── ProductDetails.tsx     # Floating details panel
│   │   │
│   │   ├── GenerativeBackground/
│   │   │   ├── index.tsx
│   │   │   ├── GenerativeBackground.tsx  # Background container
│   │   │   ├── BackgroundTransition.tsx  # Crossfade animation
│   │   │   └── LoadingShimmer.tsx        # Loading state
│   │   │
│   │   ├── CheckoutOverlay/
│   │   │   ├── index.tsx
│   │   │   ├── CheckoutOverlay.tsx    # Slide-up checkout panel
│   │   │   ├── PaymentSummary.tsx     # Order summary
│   │   │   └── OneClickBuy.tsx        # Confirm button
│   │   │
│   │   └── ui/                        # Reusable UI primitives
│   │       ├── Button.tsx
│   │       ├── Badge.tsx
│   │       ├── Skeleton.tsx
│   │       └── Icons.tsx
│   │
│   ├── contexts/
│   │   ├── ConversationContext.tsx    # Chat state + Agentforce connection
│   │   ├── SceneContext.tsx           # Current visual scene state
│   │   ├── ProductContext.tsx         # Selected/recommended products
│   │   └── CustomerContext.tsx        # Customer profile data
│   │
│   ├── hooks/
│   │   ├── useAgentforce.ts           # Agentforce API hook
│   │   ├── useGenerativeBackground.ts # Firefly generation hook
│   │   ├── useSceneTransition.ts      # Scene state machine
│   │   └── useProducts.ts             # Product catalog queries
│   │
│   ├── services/
│   │   ├── agentforce/
│   │   │   ├── index.ts
│   │   │   ├── client.ts              # Agentforce API client
│   │   │   ├── types.ts               # Response/request types
│   │   │   └── parseDirectives.ts     # Extract UI directives from responses
│   │   │
│   │   ├── firefly/
│   │   │   ├── index.ts
│   │   │   ├── client.ts              # Adobe Firefly API client
│   │   │   ├── prompts.ts             # Scene prompt templates
│   │   │   └── types.ts
│   │   │
│   │   ├── commerce/
│   │   │   ├── index.ts
│   │   │   ├── client.ts              # Commerce Cloud API (or mock)
│   │   │   ├── products.ts            # Product queries
│   │   │   └── checkout.ts            # Checkout flow
│   │   │
│   │   └── datacloud/
│   │       ├── index.ts
│   │       └── customerProfile.ts     # Customer profile fetching
│   │
│   ├── types/
│   │   ├── index.ts
│   │   ├── scene.ts                   # Scene state types
│   │   ├── product.ts                 # Product types
│   │   ├── customer.ts                # Customer profile types
│   │   └── agent.ts                   # Agentforce response types
│   │
│   ├── utils/
│   │   ├── animations.ts              # Framer motion variants
│   │   ├── sceneStateMachine.ts       # Scene transition logic
│   │   └── cn.ts                      # Classname utility
│   │
│   ├── constants/
│   │   ├── scenes.ts                  # Scene configuration
│   │   ├── products.ts                # Mock product data
│   │   └── prompts.ts                 # Firefly prompt templates
│   │
│   └── mocks/
│       ├── products.json              # Mock product catalog
│       ├── customer.json              # Mock customer profile
│       └── agentResponses.json        # Mock agent responses for testing
│
├── salesforce/                        # Salesforce metadata (if deploying)
│   ├── force-app/
│   │   └── main/default/
│   │       ├── agents/
│   │       │   └── Beauty_Concierge/
│   │       │       ├── Beauty_Concierge.agent-meta.xml
│   │       │       └── topics/
│   │       │           ├── ProductDiscovery.agentTopic-meta.xml
│   │       │           ├── ProductRecommendation.agentTopic-meta.xml
│   │       │           ├── TravelConsultation.agentTopic-meta.xml
│   │       │           └── CheckoutAssistance.agentTopic-meta.xml
│   │       │
│   │       ├── flows/
│   │       │   ├── Search_Product_Catalog.flow-meta.xml
│   │       │   └── Generate_Scene_Context.flow-meta.xml
│   │       │
│   │       └── classes/
│   │           ├── ProductCatalogService.cls
│   │           ├── ProductCatalogService.cls-meta.xml
│   │           ├── SceneGeneratorService.cls
│   │           └── SceneGeneratorService.cls-meta.xml
│   │
│   └── sfdx-project.json
│
└── docs/
    ├── ARCHITECTURE.md
    ├── AGENTFORCE_SETUP.md
    └── FIREFLY_INTEGRATION.md
```

---

## Type Definitions

### Scene Types (`src/types/scene.ts`)

```typescript
export type SceneLayout = 
  | 'conversation-centered'  // Initial state - chat is hero
  | 'product-hero'           // Single product showcase
  | 'product-grid'           // Multiple products displayed
  | 'checkout';              // Checkout overlay active

export type SceneSetting = 
  | 'neutral'        // Gradient background, no context
  | 'bathroom'       // Skincare context
  | 'travel'         // Travel/toiletries context
  | 'outdoor'        // Active/outdoor products
  | 'lifestyle';     // General lifestyle

export interface SceneBackground {
  type: 'gradient' | 'image' | 'generative';
  value: string;           // CSS gradient, image URL, or generation status
  generationPrompt?: string;
  isLoading?: boolean;
}

export interface SceneState {
  layout: SceneLayout;
  setting: SceneSetting;
  background: SceneBackground;
  chatPosition: 'center' | 'bottom' | 'minimized';
  products: Product[];
  checkoutActive: boolean;
  transitionKey: string;   // Unique key for AnimatePresence
}

export interface SceneTransition {
  from: SceneLayout;
  to: SceneLayout;
  animation: 'fade' | 'morph' | 'slide-up' | 'expand';
  duration: number;
}
```

### Product Types (`src/types/product.ts`)

```typescript
export interface Product {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  price: number;
  currency: string;
  description: string;
  shortDescription: string;
  imageUrl: string;
  images: string[];
  attributes: ProductAttributes;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  personalizationScore?: number;  // 0-1 relevance to customer
}

export type ProductCategory = 
  | 'moisturizer'
  | 'cleanser'
  | 'serum'
  | 'sunscreen'
  | 'mask'
  | 'toner'
  | 'travel-kit';

export interface ProductAttributes {
  skinType?: ('dry' | 'oily' | 'combination' | 'sensitive' | 'normal')[];
  concerns?: string[];        // ['anti-aging', 'hydration', 'acne']
  ingredients?: string[];
  size?: string;
  isTravel?: boolean;
}
```

### Customer Types (`src/types/customer.ts`)

```typescript
export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  beautyProfile: BeautyProfile;
  purchaseHistory: PurchaseRecord[];
  savedPaymentMethods: PaymentMethod[];
  shippingAddresses: Address[];
  travelPreferences?: TravelPreferences;
}

export interface BeautyProfile {
  skinType: 'dry' | 'oily' | 'combination' | 'sensitive' | 'normal';
  concerns: string[];
  allergies: string[];
  preferredBrands: string[];
  ageRange?: string;
}

export interface TravelPreferences {
  upcomingTrips?: {
    destination: string;
    departureDate: string;
    climate: 'hot' | 'cold' | 'temperate' | 'humid';
  }[];
  prefersTravelSize: boolean;
}

export interface PurchaseRecord {
  productId: string;
  productName: string;
  purchaseDate: string;
  quantity: number;
  rating?: number;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'applepay';
  last4?: string;
  brand?: string;
  isDefault: boolean;
}

export interface Address {
  id: string;
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}
```

### Agent Types (`src/types/agent.ts`)

```typescript
export interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  uiDirective?: UIDirective;
}

export interface UIDirective {
  action: UIAction;
  payload: UIDirectivePayload;
}

export type UIAction = 
  | 'SHOW_PRODUCT'
  | 'SHOW_PRODUCTS'
  | 'CHANGE_SCENE'
  | 'INITIATE_CHECKOUT'
  | 'CONFIRM_ORDER'
  | 'RESET_SCENE';

export interface UIDirectivePayload {
  products?: Product[];
  sceneContext?: {
    setting: SceneSetting;
    mood?: string;
    generateBackground?: boolean;
    backgroundPrompt?: string;
  };
  checkoutData?: {
    products: Product[];
    useStoredPayment: boolean;
  };
  orderConfirmation?: {
    orderId: string;
    estimatedDelivery: string;
  };
}

export interface AgentResponse {
  sessionId: string;
  message: string;
  uiDirective?: UIDirective;
  suggestedActions?: string[];
  confidence: number;
}
```

---

## Core Components Implementation

### 1. ConciergePage (Main Orchestrator)

```typescript
// src/components/ConciergePage/ConciergePage.tsx

import { motion, AnimatePresence } from 'framer-motion';
import { useScene } from '@/contexts/SceneContext';
import { useConversation } from '@/contexts/ConversationContext';
import { GenerativeBackground } from '@/components/GenerativeBackground';
import { ChatInterface } from '@/components/ChatInterface';
import { ProductShowcase } from '@/components/ProductShowcase';
import { CheckoutOverlay } from '@/components/CheckoutOverlay';
import { sceneAnimationVariants } from '@/utils/animations';

export const ConciergePage: React.FC = () => {
  const { scene } = useScene();
  const { messages, sendMessage, isAgentTyping } = useConversation();

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Generative/Dynamic Background */}
      <GenerativeBackground 
        background={scene.background}
        setting={scene.setting}
      />
      
      {/* Main Content Layer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scene.transitionKey}
          variants={sceneAnimationVariants[scene.layout]}
          initial="initial"
          animate="animate"
          exit="exit"
          className="relative z-10 min-h-screen flex flex-col"
        >
          {/* Product Display Area */}
          {scene.layout !== 'conversation-centered' && (
            <ProductShowcase 
              products={scene.products}
              layout={scene.layout}
            />
          )}
          
          {/* Chat Interface */}
          <ChatInterface
            position={scene.chatPosition}
            messages={messages}
            onSendMessage={sendMessage}
            isAgentTyping={isAgentTyping}
            isMinimized={scene.layout === 'checkout'}
          />
        </motion.div>
      </AnimatePresence>
      
      {/* Checkout Overlay */}
      <AnimatePresence>
        {scene.checkoutActive && (
          <CheckoutOverlay />
        )}
      </AnimatePresence>
    </div>
  );
};
```

### 2. ChatInterface Component

```typescript
// src/components/ChatInterface/ChatInterface.tsx

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { TypingIndicator } from './TypingIndicator';
import type { AgentMessage } from '@/types/agent';

interface ChatInterfaceProps {
  position: 'center' | 'bottom' | 'minimized';
  messages: AgentMessage[];
  onSendMessage: (message: string) => void;
  isAgentTyping: boolean;
  isMinimized?: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  position,
  messages,
  onSendMessage,
  isAgentTyping,
  isMinimized = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isMinimized) {
    return (
      <motion.button
        className="fixed bottom-4 right-4 w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Chat icon */}
        <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </motion.button>
    );
  }

  return (
    <motion.div
      layout
      className={cn(
        'flex flex-col w-full max-w-2xl mx-auto px-4',
        position === 'center' && 'flex-1 justify-center',
        position === 'bottom' && 'mt-auto pb-8'
      )}
    >
      {/* Welcome Message (only in center position with no messages) */}
      {position === 'center' && messages.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-light text-white mb-2">
            I'm your beauty concierge
          </h1>
          <p className="text-white/70 text-lg">
            How can I help you today?
          </p>
        </motion.div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <ChatMessages messages={messages} />
      )}
      
      {/* Typing Indicator */}
      {isAgentTyping && <TypingIndicator />}
      
      <div ref={messagesEndRef} />

      {/* Input */}
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        placeholder="Ask me anything..."
        isCentered={position === 'center'}
      />
    </motion.div>
  );
};
```

### 3. ChatInput Component

```typescript
// src/components/ChatInterface/ChatInput.tsx

import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  isCentered?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Type a message...',
  isCentered = false,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <motion.div
      layout
      className={cn(
        'relative w-full',
        isCentered ? 'max-w-xl mx-auto' : 'max-w-2xl'
      )}
    >
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full px-6 py-4 rounded-full',
            'bg-white/10 backdrop-blur-md',
            'border border-white/20',
            'text-white placeholder-white/50',
            'focus:outline-none focus:ring-2 focus:ring-white/30',
            'transition-all duration-200',
            isCentered && 'text-lg'
          )}
        />
        
        {/* Microphone button */}
        <button
          className="absolute right-14 p-2 text-white/60 hover:text-white transition-colors"
          aria-label="Voice input"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>

        {/* Send button */}
        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          className={cn(
            'absolute right-3 p-2 rounded-full',
            'bg-white/20 hover:bg-white/30',
            'text-white transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label="Send message"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </motion.div>
  );
};
```

### 4. ProductShowcase Component

```typescript
// src/components/ProductShowcase/ProductShowcase.tsx

import { motion } from 'framer-motion';
import { ProductHero } from './ProductHero';
import { ProductGrid } from './ProductGrid';
import type { Product } from '@/types/product';
import type { SceneLayout } from '@/types/scene';

interface ProductShowcaseProps {
  products: Product[];
  layout: SceneLayout;
}

export const ProductShowcase: React.FC<ProductShowcaseProps> = ({
  products,
  layout,
}) => {
  if (products.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="flex-1 flex items-center justify-center p-8"
    >
      {layout === 'product-hero' && products.length === 1 ? (
        <ProductHero product={products[0]} />
      ) : (
        <ProductGrid products={products} />
      )}
    </motion.div>
  );
};
```

### 5. ProductHero Component

```typescript
// src/components/ProductShowcase/ProductHero.tsx

import { motion } from 'framer-motion';
import { useScene } from '@/contexts/SceneContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Product } from '@/types/product';

interface ProductHeroProps {
  product: Product;
}

export const ProductHero: React.FC<ProductHeroProps> = ({ product }) => {
  const { openCheckout } = useScene();

  return (
    <div className="flex flex-col md:flex-row items-center gap-12 max-w-5xl">
      {/* Product Image */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="relative"
      >
        <div className="w-80 h-80 rounded-3xl overflow-hidden shadow-2xl bg-white/10 backdrop-blur-sm">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
        {product.personalizationScore && product.personalizationScore > 0.8 && (
          <Badge className="absolute -top-2 -right-2 bg-green-500">
            Perfect Match
          </Badge>
        )}
      </motion.div>

      {/* Product Details */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col gap-4 text-white max-w-md"
      >
        <span className="text-white/60 uppercase tracking-wider text-sm">
          {product.brand}
        </span>
        <h2 className="text-3xl font-semibold">
          {product.name}
        </h2>
        <p className="text-white/80 text-lg leading-relaxed">
          {product.description}
        </p>
        
        {/* Attributes */}
        <div className="flex flex-wrap gap-2 mt-2">
          {product.attributes.skinType?.map((type) => (
            <span
              key={type}
              className="px-3 py-1 bg-white/20 rounded-full text-sm"
            >
              {type} skin
            </span>
          ))}
        </div>

        {/* Price & CTA */}
        <div className="flex items-center gap-6 mt-4">
          <span className="text-3xl font-light">
            ${product.price.toFixed(2)}
          </span>
          <Button
            onClick={() => openCheckout()}
            size="lg"
            className="bg-white text-purple-900 hover:bg-white/90"
          >
            Add to Bag
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
```

### 6. ProductGrid Component

```typescript
// src/components/ProductShowcase/ProductGrid.tsx

import { motion } from 'framer-motion';
import { ProductCard } from './ProductCard';
import type { Product } from '@/types/product';

interface ProductGridProps {
  products: Product[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const ProductGrid: React.FC<ProductGridProps> = ({ products }) => {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl"
    >
      {products.map((product) => (
        <motion.div key={product.id} variants={itemVariants}>
          <ProductCard product={product} />
        </motion.div>
      ))}
    </motion.div>
  );
};
```

### 7. ProductCard Component

```typescript
// src/components/ProductShowcase/ProductCard.tsx

import { motion } from 'framer-motion';
import { useScene } from '@/contexts/SceneContext';
import { Badge } from '@/components/ui/Badge';
import type { Product } from '@/types/product';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { openCheckout } = useScene();

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden cursor-pointer group"
    >
      {/* Image */}
      <div className="relative aspect-square">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover"
        />
        {product.attributes.isTravel && (
          <Badge className="absolute top-3 left-3 bg-blue-500">
            Travel Size
          </Badge>
        )}
      </div>

      {/* Details */}
      <div className="p-4 text-white">
        <span className="text-white/60 text-xs uppercase tracking-wider">
          {product.brand}
        </span>
        <h3 className="font-medium mt-1 line-clamp-2">
          {product.name}
        </h3>
        <p className="text-white/70 text-sm mt-2 line-clamp-2">
          {product.shortDescription}
        </p>
        
        <div className="flex items-center justify-between mt-4">
          <span className="text-xl font-light">
            ${product.price.toFixed(2)}
          </span>
          <button
            onClick={() => openCheckout()}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full text-sm transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </motion.div>
  );
};
```

### 8. GenerativeBackground Component

```typescript
// src/components/GenerativeBackground/GenerativeBackground.tsx

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingShimmer } from './LoadingShimmer';
import type { SceneBackground, SceneSetting } from '@/types/scene';

interface GenerativeBackgroundProps {
  background: SceneBackground;
  setting: SceneSetting;
}

export const GenerativeBackground: React.FC<GenerativeBackgroundProps> = ({
  background,
}) => {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [previousImage, setPreviousImage] = useState<string | null>(null);

  // When background changes, crossfade
  useEffect(() => {
    if (background.type === 'image' || background.type === 'generative') {
      if (background.value && background.value !== currentImage) {
        setPreviousImage(currentImage);
        setCurrentImage(background.value);
      }
    }
  }, [background.value, currentImage]);

  // Gradient backgrounds
  if (background.type === 'gradient') {
    return (
      <div
        className="absolute inset-0 -z-10 transition-all duration-1000"
        style={{ background: background.value }}
      />
    );
  }

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {/* Previous image (fading out) */}
      <AnimatePresence>
        {previousImage && previousImage !== currentImage && (
          <motion.img
            key={`prev-${previousImage}`}
            src={previousImage}
            alt=""
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </AnimatePresence>

      {/* Current image (fading in) */}
      {currentImage && (
        <motion.img
          key={`curr-${currentImage}`}
          src={currentImage}
          alt=""
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Loading state */}
      {background.isLoading && (
        <LoadingShimmer />
      )}

      {/* Overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/40" />
    </div>
  );
};
```

### 9. LoadingShimmer Component

```typescript
// src/components/GenerativeBackground/LoadingShimmer.tsx

import { motion } from 'framer-motion';

export const LoadingShimmer: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute inset-0 -translate-x-full"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
        }}
        animate={{ x: ['0%', '200%'] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
};
```

### 10. CheckoutOverlay Component

```typescript
// src/components/CheckoutOverlay/CheckoutOverlay.tsx

import { motion } from 'framer-motion';
import { useScene } from '@/contexts/SceneContext';
import { useCustomer } from '@/contexts/CustomerContext';
import { Button } from '@/components/ui/Button';

export const CheckoutOverlay: React.FC = () => {
  const { scene, closeCheckout } = useScene();
  const { customer } = useCustomer();

  const products = scene.products;
  const total = products.reduce((sum, p) => sum + p.price, 0);
  const defaultPayment = customer?.savedPaymentMethods.find((p) => p.isDefault);
  const defaultAddress = customer?.shippingAddresses.find((a) => a.isDefault);

  const handleConfirmPurchase = () => {
    // In production, this would call the checkout API
    console.log('Processing purchase...', { products, total });
    // Show confirmation, then close
    setTimeout(() => {
      closeCheckout();
    }, 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={closeCheckout}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-white rounded-t-3xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />

        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          Quick Checkout
        </h2>

        {/* Products */}
        <div className="space-y-4 mb-6">
          {products.map((product) => (
            <div key={product.id} className="flex items-center gap-4">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{product.name}</p>
                <p className="text-gray-500 text-sm">{product.brand}</p>
              </div>
              <span className="font-medium">${product.price.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 my-4" />

        {/* Payment Method */}
        {defaultPayment && (
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-600">Payment</span>
            <span className="font-medium">
              {defaultPayment.brand?.toUpperCase()} •••• {defaultPayment.last4}
            </span>
          </div>
        )}

        {/* Shipping Address */}
        {defaultAddress && (
          <div className="flex items-center justify-between mb-6">
            <span className="text-gray-600">Ship to</span>
            <span className="font-medium text-right">
              {defaultAddress.city}, {defaultAddress.state}
            </span>
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-xl font-semibold">Total</span>
          <span className="text-xl font-semibold">${total.toFixed(2)}</span>
        </div>

        {/* Confirm Button */}
        <Button
          onClick={handleConfirmPurchase}
          size="lg"
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
        >
          Confirm Purchase
        </Button>

        <button
          onClick={closeCheckout}
          className="w-full mt-3 py-3 text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
      </motion.div>
    </motion.div>
  );
};
```

---

## Services Implementation

### 1. Agentforce Service

```typescript
// src/services/agentforce/client.ts

import type { AgentResponse } from '@/types/agent';
import { parseUIDirective } from './parseDirectives';

interface AgentforceConfig {
  baseUrl: string;
  agentId: string;
  accessToken: string;
}

export class AgentforceClient {
  private config: AgentforceConfig;
  private sessionId: string | null = null;

  constructor(config: AgentforceConfig) {
    this.config = config;
  }

  async initSession(customerId?: string): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId: this.config.agentId,
        context: {
          customerId,
          channel: 'web',
          platform: 'agentic-commerce-demo',
        },
      }),
    });

    const data = await response.json();
    this.sessionId = data.sessionId;
    return this.sessionId;
  }

  async sendMessage(message: string): Promise<AgentResponse> {
    if (!this.sessionId) {
      throw new Error('Session not initialized. Call initSession() first.');
    }

    const response = await fetch(
      `${this.config.baseUrl}/sessions/${this.sessionId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          requestUIDirective: true,
        }),
      }
    );

    const data = await response.json();
    const uiDirective = parseUIDirective(data);

    return {
      sessionId: this.sessionId,
      message: data.message,
      uiDirective,
      suggestedActions: data.suggestedActions || [],
      confidence: data.confidence || 1,
    };
  }

  async endSession(): Promise<void> {
    if (this.sessionId) {
      await fetch(`${this.config.baseUrl}/sessions/${this.sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
        },
      });
      this.sessionId = null;
    }
  }
}

// Singleton instance
let agentforceClient: AgentforceClient | null = null;

export const getAgentforceClient = (): AgentforceClient => {
  if (!agentforceClient) {
    agentforceClient = new AgentforceClient({
      baseUrl: import.meta.env.VITE_AGENTFORCE_BASE_URL || '',
      agentId: import.meta.env.VITE_AGENTFORCE_AGENT_ID || '',
      accessToken: import.meta.env.VITE_AGENTFORCE_ACCESS_TOKEN || '',
    });
  }
  return agentforceClient;
};
```

### 2. Directive Parser

```typescript
// src/services/agentforce/parseDirectives.ts

import type { UIDirective, UIAction } from '@/types/agent';

interface RawAgentResponse {
  message: string;
  metadata?: {
    uiDirective?: {
      action: string;
      payload: Record<string, unknown>;
    };
  };
  // Some agents embed directives in the message itself
  rawText?: string;
}

export function parseUIDirective(response: RawAgentResponse): UIDirective | undefined {
  // Check if directive is in metadata
  if (response.metadata?.uiDirective) {
    return {
      action: response.metadata.uiDirective.action as UIAction,
      payload: response.metadata.uiDirective.payload as UIDirective['payload'],
    };
  }

  // Try to extract from raw text (fallback for agents that embed JSON)
  const jsonMatch = response.rawText?.match(/\{[\s\S]*"uiDirective"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.uiDirective) {
        return {
          action: parsed.uiDirective.action as UIAction,
          payload: parsed.uiDirective.payload,
        };
      }
    } catch {
      // JSON parsing failed, no directive
    }
  }

  return undefined;
}
```

### 3. Firefly Service

```typescript
// src/services/firefly/client.ts

import { SCENE_PROMPTS } from './prompts';
import type { SceneSetting } from '@/types/scene';
import type { Product } from '@/types/product';

interface FireflyConfig {
  apiKey: string;
  baseUrl: string;
}

interface GenerationOptions {
  width?: number;
  height?: number;
  style?: 'photorealistic' | 'artistic' | 'minimal';
  negativePrompt?: string;
}

export class FireflyClient {
  private config: FireflyConfig;

  constructor(config: FireflyConfig) {
    this.config = config;
  }

  async generateSceneBackground(
    setting: SceneSetting,
    products: Product[],
    options: GenerationOptions = {}
  ): Promise<string> {
    const {
      width = 1920,
      height = 1080,
      style = 'photorealistic',
    } = options;

    const basePrompt = SCENE_PROMPTS[setting];
    const productContext = this.buildProductContext(products);
    const fullPrompt = `${basePrompt}. ${productContext}. Professional product photography lighting, elegant and luxurious atmosphere, soft shadows, ${style} style.`;

    const response = await fetch(`${this.config.baseUrl}/v2/images/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        negativePrompt: options.negativePrompt || 'text, watermark, logo, blurry, low quality',
        contentClass: 'photo',
        size: { width, height },
        n: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Firefly generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.outputs[0].image.url;
  }

  private buildProductContext(products: Product[]): string {
    if (products.length === 0) return '';
    const categories = [...new Set(products.map((p) => p.category))];
    return `Featuring ${categories.join(' and ')} products in an elegant arrangement`;
  }
}

// Singleton
let fireflyClient: FireflyClient | null = null;

export const getFireflyClient = (): FireflyClient => {
  if (!fireflyClient) {
    fireflyClient = new FireflyClient({
      apiKey: import.meta.env.VITE_FIREFLY_API_KEY || '',
      baseUrl: import.meta.env.VITE_FIREFLY_BASE_URL || 'https://firefly-api.adobe.io',
    });
  }
  return fireflyClient;
};
```

### 4. Firefly Prompts

```typescript
// src/services/firefly/prompts.ts

import type { SceneSetting } from '@/types/scene';

export const SCENE_PROMPTS: Record<SceneSetting, string> = {
  neutral: 'Elegant gradient background with soft bokeh lights, minimal and sophisticated',
  
  bathroom: 'Luxurious modern bathroom counter with marble surface, soft natural light from window, morning atmosphere, potted plant accent, high-end spa aesthetic',
  
  travel: 'Stylish travel toiletries bag next to premium luggage, hotel room or airport lounge setting, warm wanderlust atmosphere, adventure ready',
  
  outdoor: 'Fresh outdoor setting with natural elements, morning dew, healthy active lifestyle, green foliage in background, energetic mood',
  
  lifestyle: 'Sophisticated vanity table or dresser setup, soft feminine aesthetic, natural daylight, organized and beautiful arrangement',
};
```

### 5. Mock Agent Service (for development)

```typescript
// src/services/mock/mockAgent.ts

import type { AgentResponse, UIAction } from '@/types/agent';
import { MOCK_PRODUCTS } from '@/mocks/products';

const RESPONSE_PATTERNS: {
  pattern: RegExp;
  response: () => Partial<AgentResponse>;
}[] = [
  {
    pattern: /moisturizer|hydrat|dry skin|sensitive/i,
    response: () => ({
      message: "I'd recommend our Hydra-Calm Sensitive Moisturizer. It's specifically formulated for sensitive skin with soothing ingredients like centella and hyaluronic acid. Would you like to learn more or shall I add it to your bag?",
      uiDirective: {
        action: 'SHOW_PRODUCT' as UIAction,
        payload: {
          products: [MOCK_PRODUCTS.find((p) => p.id === 'moisturizer-sensitive')!],
          sceneContext: {
            setting: 'bathroom',
            generateBackground: true,
            backgroundPrompt: 'Serene bathroom counter with soft morning light',
          },
        },
      },
    }),
  },
  {
    pattern: /buy|purchase|add to (bag|cart)|get (it|this)/i,
    response: () => ({
      message: "Perfect choice! I'll set that up for you. Since you have a payment method on file, this will just take a moment.",
      uiDirective: {
        action: 'INITIATE_CHECKOUT' as UIAction,
        payload: {
          checkoutData: {
            products: [],
            useStoredPayment: true,
          },
        },
      },
    }),
  },
  {
    pattern: /travel|trip|going to|vacation|india|hot (weather|climate)/i,
    response: () => ({
      message: "For your trip to a hot climate, I'd suggest our travel essentials kit. It includes a lightweight SPF moisturizer, a refreshing mist, and oil-absorbing sheets - all travel-sized!",
      uiDirective: {
        action: 'SHOW_PRODUCTS' as UIAction,
        payload: {
          products: MOCK_PRODUCTS.filter((p) => p.attributes.isTravel),
          sceneContext: {
            setting: 'travel',
            generateBackground: true,
            backgroundPrompt: 'Travel toiletries bag with passport and luggage',
          },
        },
      },
    }),
  },
];

export const generateMockResponse = async (message: string): Promise<AgentResponse> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));

  for (const { pattern, response } of RESPONSE_PATTERNS) {
    if (message.match(pattern)) {
      const result = response();
      return {
        sessionId: 'mock-session',
        message: result.message!,
        uiDirective: result.uiDirective,
        suggestedActions: [],
        confidence: 0.95,
      };
    }
  }

  return {
    sessionId: 'mock-session',
    message: "I'd be happy to help you find the perfect product. Are you looking for something specific like a moisturizer, cleanser, or perhaps something for travel?",
    suggestedActions: ['Show me moisturizers', 'I need travel products', 'What do you recommend?'],
    confidence: 0.8,
  };
};
```

---

## Context Providers

### SceneContext

```typescript
// src/contexts/SceneContext.tsx

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { SceneState, SceneLayout, SceneSetting, SceneBackground } from '@/types/scene';
import type { Product } from '@/types/product';
import type { UIDirective } from '@/types/agent';
import { useGenerativeBackground } from '@/hooks/useGenerativeBackground';

interface SceneContextValue {
  scene: SceneState;
  transitionTo: (layout: SceneLayout, products?: Product[]) => void;
  setBackground: (background: SceneBackground) => void;
  setSetting: (setting: SceneSetting) => void;
  processUIDirective: (directive: UIDirective) => Promise<void>;
  openCheckout: () => void;
  closeCheckout: () => void;
  resetScene: () => void;
}

const initialScene: SceneState = {
  layout: 'conversation-centered',
  setting: 'neutral',
  background: {
    type: 'gradient',
    value: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
  chatPosition: 'center',
  products: [],
  checkoutActive: false,
  transitionKey: 'initial',
};

type SceneAction =
  | { type: 'TRANSITION_LAYOUT'; layout: SceneLayout; products?: Product[] }
  | { type: 'SET_BACKGROUND'; background: SceneBackground }
  | { type: 'SET_SETTING'; setting: SceneSetting }
  | { type: 'SET_PRODUCTS'; products: Product[] }
  | { type: 'OPEN_CHECKOUT' }
  | { type: 'CLOSE_CHECKOUT' }
  | { type: 'RESET' };

function sceneReducer(state: SceneState, action: SceneAction): SceneState {
  switch (action.type) {
    case 'TRANSITION_LAYOUT': {
      const chatPosition = action.layout === 'conversation-centered' 
        ? 'center' 
        : action.layout === 'checkout' 
          ? 'minimized' 
          : 'bottom';
      
      return {
        ...state,
        layout: action.layout,
        chatPosition,
        products: action.products ?? state.products,
        transitionKey: `${action.layout}-${Date.now()}`,
      };
    }
    case 'SET_BACKGROUND':
      return { ...state, background: action.background };
    case 'SET_SETTING':
      return { ...state, setting: action.setting };
    case 'SET_PRODUCTS':
      return { ...state, products: action.products };
    case 'OPEN_CHECKOUT':
      return { ...state, checkoutActive: true, chatPosition: 'minimized' };
    case 'CLOSE_CHECKOUT':
      return { ...state, checkoutActive: false, chatPosition: 'bottom' };
    case 'RESET':
      return initialScene;
    default:
      return state;
  }
}

const SceneContext = createContext<SceneContextValue | null>(null);

export const SceneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scene, dispatch] = useReducer(sceneReducer, initialScene);
  const { generateBackground } = useGenerativeBackground();

  const transitionTo = useCallback((layout: SceneLayout, products?: Product[]) => {
    dispatch({ type: 'TRANSITION_LAYOUT', layout, products });
  }, []);

  const setBackground = useCallback((background: SceneBackground) => {
    dispatch({ type: 'SET_BACKGROUND', background });
  }, []);

  const setSetting = useCallback((setting: SceneSetting) => {
    dispatch({ type: 'SET_SETTING', setting });
  }, []);

  const processUIDirective = useCallback(async (directive: UIDirective) => {
    const { action, payload } = directive;

    switch (action) {
      case 'SHOW_PRODUCT':
      case 'SHOW_PRODUCTS': {
        if (payload.products && payload.products.length > 0) {
          const layout = payload.products.length === 1 ? 'product-hero' : 'product-grid';
          dispatch({ type: 'TRANSITION_LAYOUT', layout, products: payload.products });
        }
        
        if (payload.sceneContext) {
          dispatch({ type: 'SET_SETTING', setting: payload.sceneContext.setting });
          
          if (payload.sceneContext.generateBackground) {
            dispatch({
              type: 'SET_BACKGROUND',
              background: { type: 'generative', value: '', isLoading: true },
            });
            
            try {
              const imageUrl = await generateBackground(
                payload.sceneContext.setting,
                payload.products || []
              );
              
              dispatch({
                type: 'SET_BACKGROUND',
                background: { type: 'image', value: imageUrl },
              });
            } catch (error) {
              console.error('Background generation failed:', error);
              // Fall back to gradient
              dispatch({
                type: 'SET_BACKGROUND',
                background: {
                  type: 'gradient',
                  value: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                },
              });
            }
          }
        }
        break;
      }
      
      case 'INITIATE_CHECKOUT':
        dispatch({ type: 'OPEN_CHECKOUT' });
        break;
        
      case 'RESET_SCENE':
        dispatch({ type: 'RESET' });
        break;
    }
  }, [generateBackground]);

  const openCheckout = useCallback(() => {
    dispatch({ type: 'OPEN_CHECKOUT' });
  }, []);

  const closeCheckout = useCallback(() => {
    dispatch({ type: 'CLOSE_CHECKOUT' });
  }, []);

  const resetScene = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return (
    <SceneContext.Provider
      value={{
        scene,
        transitionTo,
        setBackground,
        setSetting,
        processUIDirective,
        openCheckout,
        closeCheckout,
        resetScene,
      }}
    >
      {children}
    </SceneContext.Provider>
  );
};

export const useScene = (): SceneContextValue => {
  const context = useContext(SceneContext);
  if (!context) {
    throw new Error('useScene must be used within SceneProvider');
  }
  return context;
};
```

### ConversationContext

```typescript
// src/contexts/ConversationContext.tsx

import React, { createContext, useContext, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AgentMessage } from '@/types/agent';
import { useScene } from './SceneContext';
import { generateMockResponse } from '@/services/mock/mockAgent';

interface ConversationContextValue {
  messages: AgentMessage[];
  isAgentTyping: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearConversation: () => void;
}

const ConversationContext = createContext<ConversationContextValue | null>(null);

export const ConversationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const { processUIDirective } = useScene();

  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: AgentMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Show typing indicator
    setIsAgentTyping(true);

    try {
      // Get agent response (using mock for now)
      const response = await generateMockResponse(content);

      // Add agent message
      const agentMessage: AgentMessage = {
        id: uuidv4(),
        role: 'agent',
        content: response.message,
        timestamp: new Date(),
        uiDirective: response.uiDirective,
      };
      setMessages((prev) => [...prev, agentMessage]);

      // Process UI directive if present
      if (response.uiDirective) {
        await processUIDirective(response.uiDirective);
      }
    } catch (error) {
      console.error('Failed to get agent response:', error);
      // Add error message
      const errorMessage: AgentMessage = {
        id: uuidv4(),
        role: 'agent',
        content: "I'm sorry, I encountered an issue. Could you try again?",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsAgentTyping(false);
    }
  }, [processUIDirective]);

  const clearConversation = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <ConversationContext.Provider
      value={{
        messages,
        isAgentTyping,
        sendMessage,
        clearConversation,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversation = (): ConversationContextValue => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within ConversationProvider');
  }
  return context;
};
```

### CustomerContext

```typescript
// src/contexts/CustomerContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CustomerProfile } from '@/types/customer';
import { MOCK_CUSTOMER } from '@/mocks/customer';

interface CustomerContextValue {
  customer: CustomerProfile | null;
  isLoading: boolean;
  error: Error | null;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Simulate fetching customer profile
    const fetchCustomer = async () => {
      try {
        // In production, this would be a real API call
        await new Promise((resolve) => setTimeout(resolve, 500));
        setCustomer(MOCK_CUSTOMER);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch customer'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomer();
  }, []);

  return (
    <CustomerContext.Provider value={{ customer, isLoading, error }}>
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomer = (): CustomerContextValue => {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error('useCustomer must be used within CustomerProvider');
  }
  return context;
};
```

---

## Hooks

### useGenerativeBackground

```typescript
// src/hooks/useGenerativeBackground.ts

import { useCallback } from 'react';
import type { SceneSetting } from '@/types/scene';
import type { Product } from '@/types/product';

// Fallback images for when generation is disabled or fails
const FALLBACK_IMAGES: Record<SceneSetting, string> = {
  neutral: '/assets/fallback-backgrounds/neutral.jpg',
  bathroom: '/assets/fallback-backgrounds/bathroom-scene.jpg',
  travel: '/assets/fallback-backgrounds/travel-scene.jpg',
  outdoor: '/assets/fallback-backgrounds/outdoor-scene.jpg',
  lifestyle: '/assets/fallback-backgrounds/lifestyle-scene.jpg',
};

export function useGenerativeBackground() {
  const generateBackground = useCallback(
    async (setting: SceneSetting, products: Product[]): Promise<string> => {
      const useGeneration = import.meta.env.VITE_ENABLE_GENERATIVE_BACKGROUNDS === 'true';

      if (!useGeneration) {
        // Return fallback image
        return FALLBACK_IMAGES[setting] || FALLBACK_IMAGES.neutral;
      }

      try {
        // Dynamic import to avoid loading firefly client if not needed
        const { getFireflyClient } = await import('@/services/firefly/client');
        const client = getFireflyClient();
        return await client.generateSceneBackground(setting, products);
      } catch (error) {
        console.error('Background generation failed, using fallback:', error);
        return FALLBACK_IMAGES[setting] || FALLBACK_IMAGES.neutral;
      }
    },
    []
  );

  return { generateBackground };
}
```

---

## UI Components

### Button

```typescript
// src/components/ui/Button.tsx

import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-full font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500':
              variant === 'primary',
            'bg-white/20 text-white hover:bg-white/30 focus:ring-white/50':
              variant === 'secondary',
            'bg-transparent text-white hover:bg-white/10 focus:ring-white/50':
              variant === 'ghost',
          },
          {
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-base': size === 'md',
            'px-6 py-3 text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

### Badge

```typescript
// src/components/ui/Badge.tsx

import { cn } from '@/utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, className }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        'bg-purple-500 text-white',
        className
      )}
    >
      {children}
    </span>
  );
};
```

---

## Utilities

### cn (classname utility)

```typescript
// src/utils/cn.ts

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Animation Variants

```typescript
// src/utils/animations.ts

import type { Variants } from 'framer-motion';
import type { SceneLayout } from '@/types/scene';

export const sceneAnimationVariants: Record<SceneLayout, Variants> = {
  'conversation-centered': {
    initial: { opacity: 0, scale: 0.95 },
    animate: { 
      opacity: 1, 
      scale: 1,
      transition: { duration: 0.5, ease: 'easeOut' }
    },
    exit: { 
      opacity: 0, 
      scale: 1.02,
      transition: { duration: 0.3, ease: 'easeIn' }
    },
  },
  'product-hero': {
    initial: { opacity: 0, y: 40 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.6, 
        ease: [0.22, 1, 0.36, 1]
      }
    },
    exit: { 
      opacity: 0, 
      y: -20,
      transition: { duration: 0.3 }
    },
  },
  'product-grid': {
    initial: { opacity: 0 },
    animate: { 
      opacity: 1,
      transition: { 
        duration: 0.4,
        staggerChildren: 0.1
      }
    },
    exit: { opacity: 0 },
  },
  'checkout': {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
};

export const productCardVariants: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.4, ease: 'easeOut' }
  },
  hover: {
    y: -8,
    scale: 1.02,
    transition: { duration: 0.2 }
  },
};
```

---

## Mock Data

### Products

```typescript
// src/mocks/products.ts

import type { Product } from '@/types/product';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'moisturizer-sensitive',
    name: 'Hydra-Calm Sensitive Moisturizer',
    brand: 'SERENE',
    category: 'moisturizer',
    price: 58.00,
    currency: 'USD',
    description: 'A deeply hydrating yet gentle moisturizer formulated specifically for sensitive skin. Featuring centella asiatica, hyaluronic acid, and ceramides to strengthen the skin barrier while providing long-lasting comfort.',
    shortDescription: 'Gentle hydration for sensitive skin',
    imageUrl: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=800',
    images: ['https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=800'],
    attributes: {
      skinType: ['sensitive', 'dry'],
      concerns: ['hydration', 'redness', 'barrier repair'],
      ingredients: ['Centella Asiatica', 'Hyaluronic Acid', 'Ceramides'],
      size: '50ml',
    },
    rating: 4.8,
    reviewCount: 1247,
    inStock: true,
    personalizationScore: 0.92,
  },
  {
    id: 'sunscreen-lightweight',
    name: 'Invisible Shield SPF 50',
    brand: 'SERENE',
    category: 'sunscreen',
    price: 42.00,
    currency: 'USD',
    description: 'Ultra-lightweight, invisible sunscreen that absorbs instantly without white cast. Perfect for daily use and hot climates.',
    shortDescription: 'Weightless daily SPF protection',
    imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800',
    images: ['https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800'],
    attributes: {
      skinType: ['normal', 'oily', 'combination'],
      concerns: ['sun protection', 'anti-aging'],
      size: '40ml',
      isTravel: true,
    },
    rating: 4.6,
    reviewCount: 892,
    inStock: true,
    personalizationScore: 0.85,
  },
  {
    id: 'mist-refreshing',
    name: 'Cooling Facial Mist',
    brand: 'SERENE',
    category: 'toner',
    price: 28.00,
    currency: 'USD',
    description: 'Refreshing facial mist with cucumber and aloe vera. Perfect for on-the-go hydration and cooling relief in hot weather.',
    shortDescription: 'Instant refresh and hydration',
    imageUrl: 'https://images.unsplash.com/photo-1570194065650-d99fb4b38b15?w=800',
    images: ['https://images.unsplash.com/photo-1570194065650-d99fb4b38b15?w=800'],
    attributes: {
      skinType: ['normal', 'dry', 'combination', 'sensitive', 'oily'],
      concerns: ['hydration', 'refreshing'],
      size: '75ml',
      isTravel: true,
    },
    rating: 4.5,
    reviewCount: 654,
    inStock: true,
    personalizationScore: 0.78,
  },
  {
    id: 'blotting-sheets',
    name: 'Oil Control Blotting Papers',
    brand: 'SERENE',
    category: 'travel-kit',
    price: 12.00,
    currency: 'USD',
    description: 'Natural bamboo charcoal blotting sheets that instantly absorb excess oil without disturbing makeup. 100 sheets per pack.',
    shortDescription: 'Instant oil control on-the-go',
    imageUrl: 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800',
    images: ['https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800'],
    attributes: {
      skinType: ['oily', 'combination'],
      concerns: ['oil control'],
      size: '100 sheets',
      isTravel: true,
    },
    rating: 4.7,
    reviewCount: 2103,
    inStock: true,
    personalizationScore: 0.72,
  },
];
```

### Customer

```typescript
// src/mocks/customer.ts

import type { CustomerProfile } from '@/types/customer';

export const MOCK_CUSTOMER: CustomerProfile = {
  id: 'cust-12345',
  name: 'Sarah',
  email: 'sarah@example.com',
  beautyProfile: {
    skinType: 'sensitive',
    concerns: ['hydration', 'redness'],
    allergies: ['fragrance'],
    preferredBrands: ['SERENE', 'Gentle Care'],
    ageRange: '30-40',
  },
  purchaseHistory: [
    {
      productId: 'cleanser-gentle',
      productName: 'Gentle Foaming Cleanser',
      purchaseDate: '2024-11-15',
      quantity: 1,
      rating: 5,
    },
  ],
  savedPaymentMethods: [
    {
      id: 'pm-1',
      type: 'card',
      last4: '4242',
      brand: 'visa',
      isDefault: true,
    },
  ],
  shippingAddresses: [
    {
      id: 'addr-1',
      name: 'Sarah Chen',
      line1: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94102',
      country: 'US',
      isDefault: true,
    },
  ],
  travelPreferences: {
    upcomingTrips: [
      {
        destination: 'Mumbai, India',
        departureDate: '2025-03-15',
        climate: 'hot',
      },
    ],
    prefersTravelSize: true,
  },
};
```

---

## App Entry Point

### main.tsx

```typescript
// src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### App.tsx

```typescript
// src/App.tsx

import { SceneProvider } from '@/contexts/SceneContext';
import { ConversationProvider } from '@/contexts/ConversationContext';
import { CustomerProvider } from '@/contexts/CustomerContext';
import { ConciergePage } from '@/components/ConciergePage';

function App() {
  return (
    <CustomerProvider>
      <SceneProvider>
        <ConversationProvider>
          <ConciergePage />
        </ConversationProvider>
      </SceneProvider>
    </CustomerProvider>
  );
}

export default App;
```

### index.css

```css
/* src/index.css */

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply antialiased;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
}

@layer utilities {
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}
```

---

## Configuration Files

### package.json

```json
{
  "name": "agentic-commerce-demo",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "framer-motion": "^11.0.0",
    "uuid": "^9.0.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/uuid": "^9.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
});
```

### tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### .env.example

```bash
# Agentforce Configuration
VITE_AGENTFORCE_BASE_URL=https://your-instance.salesforce.com/services/data/v60.0/einstein/ai-agents
VITE_AGENTFORCE_AGENT_ID=your-agent-id
VITE_AGENTFORCE_ACCESS_TOKEN=your-access-token

# Adobe Firefly Configuration
VITE_FIREFLY_API_KEY=your-firefly-api-key
VITE_FIREFLY_BASE_URL=https://firefly-api.adobe.io

# Feature Flags
VITE_USE_MOCK_DATA=true
VITE_ENABLE_GENERATIVE_BACKGROUNDS=false
```

---

## Build & Run Instructions

### Quick Start (Mock Mode)

```bash
# 1. Create the project
mkdir agentic-commerce-demo && cd agentic-commerce-demo

# 2. Initialize with the spec
# Copy all files from this specification

# 3. Install dependencies
npm install

# 4. Create .env.local
cp .env.example .env.local
# Set VITE_USE_MOCK_DATA=true

# 5. Start development server
npm run dev

# 6. Open http://localhost:5173
```

### With Real APIs

```bash
# 1. Configure .env.local with real API keys

# 2. Set feature flags
VITE_USE_MOCK_DATA=false
VITE_ENABLE_GENERATIVE_BACKGROUNDS=true

# 3. Run the app
npm run dev
```

---

## Testing the Demo Flow

### Test Script

1. **Opening**: Page loads with centered chat, purple gradient background
2. **Say**: "I need a new moisturizer for my sensitive skin"
   - Expected: Product hero appears, background transitions to bathroom scene
3. **Say**: "Let's buy it" or "Add to bag"
   - Expected: Checkout overlay slides up with stored payment
4. **Complete checkout** or cancel
5. **Say**: "I have a work trip coming up to India where it's very hot, do you have any travel product recommendations?"
   - Expected: Product grid with travel items, background transitions to travel scene

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Initial load (LCP) | < 2.5s |
| Scene transition | < 600ms |
| Agent response | < 2s |
| Background generation | < 5s (with loading state) |
| Checkout completion | < 3s |

---

## Next Steps After Initial Build

1. **Connect to Real Agentforce** - Replace mock with actual API
2. **Adobe Firefly Integration** - Enable generative backgrounds
3. **Commerce Cloud** - Real product catalog and checkout
4. **Data Cloud** - Customer profiles and personalization
5. **Analytics** - Track conversion and engagement
6. **Voice Input** - Add microphone support
7. **Mobile Optimization** - Responsive design improvements