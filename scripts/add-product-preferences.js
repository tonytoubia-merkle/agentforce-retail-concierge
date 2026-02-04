/**
 * Script to add consumer preference fields to Product2.json
 * Adds: Is_Fragrance_Free__c, Is_Vegan__c, Is_Cruelty_Free__c,
 *       Is_Paraben_Free__c, Is_Hypoallergenic__c, Is_Dermatologist_Tested__c,
 *       Key_Ingredients__c
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load existing products
const productPath = resolve(__dirname, '..', 'data', 'Product2.json');
const data = JSON.parse(readFileSync(productPath, 'utf-8'));

// Key ingredients by product type/name keywords
const ingredientMap = {
  'hyaluronic': 'Hyaluronic Acid',
  'vitamin c': 'Vitamin C;Ferulic Acid',
  'retinol': 'Retinol;Vitamin E',
  'retinoid': 'Retinoid;Vitamin E',
  'niacinamide': 'Niacinamide;Zinc PCA',
  'salicylic': 'Salicylic Acid',
  'glycolic': 'Glycolic Acid',
  'azelaic': 'Azelaic Acid',
  'centella': 'Centella Asiatica;Green Tea',
  'ceramide': 'Ceramides;Cholesterol;Fatty Acids',
  'peptide': 'Peptides;Amino Acids',
  'caffeine': 'Caffeine;Peptides',
  'bakuchiol': 'Bakuchiol;Squalane',
  'benzoyl': 'Benzoyl Peroxide',
  'sulfur': 'Sulfur',
  'charcoal': 'Activated Charcoal;Kaolin',
  'clay': 'Kaolin Clay;Bentonite',
  'zinc': 'Zinc PCA;Kaolin',
  'spf': 'Zinc Oxide;Titanium Dioxide',
  'sunscreen': 'Zinc Oxide;Avobenzone',
  'mineral': 'Zinc Oxide',
  'moisturizer': 'Hyaluronic Acid;Glycerin',
  'cleanser': 'Glycerin;Aloe Vera',
  'toner': 'Witch Hazel;Aloe Vera',
  'mask': 'Kaolin;Hyaluronic Acid',
  'serum': 'Hyaluronic Acid;Glycerin',
  'shampoo': 'Keratin;Panthenol',
  'conditioner': 'Argan Oil;Keratin',
  'fragrance': 'Essential Oils',
  'lipstick': 'Vitamin E;Jojoba Oil',
  'mascara': 'Beeswax;Carnauba Wax',
  'foundation': 'Hyaluronic Acid;Vitamin E',
  'blush': 'Vitamin E;Jojoba Oil',
  'cucumber': 'Cucumber Extract;Aloe Vera',
  'honey': 'Honey;Propolis',
  'squalane': 'Squalane;Jojoba Oil',
  'oil': 'Argan Oil;Jojoba Oil',
  'tea tree': 'Tea Tree Oil;Salicylic Acid',
};

function getKeyIngredients(product) {
  const name = product.Name.toLowerCase();
  const desc = product.Description__c.toLowerCase();
  const combined = name + ' ' + desc;

  const ingredients = new Set();

  for (const [keyword, ingredientList] of Object.entries(ingredientMap)) {
    if (combined.includes(keyword)) {
      ingredientList.split(';').forEach(i => ingredients.add(i));
    }
  }

  // Default ingredients if none found
  if (ingredients.size === 0) {
    if (product.Category__c === 'Fragrance') {
      ingredients.add('Essential Oils');
      ingredients.add('Alcohol');
    } else {
      ingredients.add('Glycerin');
      ingredients.add('Vitamin E');
    }
  }

  return Array.from(ingredients).slice(0, 5).join(';');
}

function assignPreferences(product) {
  const brand = product.Brand__c;
  const category = product.Category__c;
  const name = product.Name.toLowerCase();
  const skinTypes = product.Skin_Types__c || '';
  const concerns = product.Concerns__c || '';
  const desc = product.Description__c.toLowerCase();

  // Default values
  let fragranceFree = false;
  let vegan = false;
  let crueltyFree = true; // All brands are cruelty-free
  let parabenFree = false;
  let hypoallergenic = false;
  let dermatologistTested = false;

  // Brand-specific defaults
  if (brand === 'SERENE') {
    fragranceFree = Math.random() > 0.3; // 70% fragrance-free
    vegan = Math.random() > 0.2; // 80% vegan
    parabenFree = Math.random() > 0.3; // 70% paraben-free
    dermatologistTested = Math.random() > 0.5; // 50% tested
  } else if (brand === 'LUMIERE') {
    fragranceFree = Math.random() > 0.6; // 40% fragrance-free
    vegan = Math.random() > 0.4; // 60% vegan
    parabenFree = Math.random() > 0.2; // 80% paraben-free
    dermatologistTested = Math.random() > 0.7; // 30% tested
  } else if (brand === 'DERMAFIX') {
    fragranceFree = Math.random() > 0.1; // 90% fragrance-free
    vegan = Math.random() > 0.3; // 70% vegan
    parabenFree = Math.random() > 0.05; // 95% paraben-free
    dermatologistTested = true; // 100% tested
  } else if (brand === 'MAISON') {
    if (category === 'Fragrance') {
      fragranceFree = false; // Fragrances are not fragrance-free
    } else {
      fragranceFree = Math.random() > 0.5; // 50% fragrance-free for hair
    }
    vegan = Math.random() > 0.2; // 80% vegan
    parabenFree = Math.random() > 0.3; // 70% paraben-free
    dermatologistTested = Math.random() > 0.8; // 20% tested
  }

  // Override based on product characteristics
  if (skinTypes.includes('Sensitive') || concerns.includes('sensitive') || name.includes('sensitive') || name.includes('calm')) {
    fragranceFree = true;
    hypoallergenic = true;
    parabenFree = true;
  }

  if (concerns.includes('acne') || concerns.includes('rosacea') || name.includes('acne')) {
    dermatologistTested = true;
    fragranceFree = true;
  }

  if (name.includes('gentle') || desc.includes('gentle')) {
    hypoallergenic = true;
    fragranceFree = true;
  }

  if (name.includes('mineral') || desc.includes('mineral-only')) {
    fragranceFree = true;
    hypoallergenic = true;
  }

  // Mascara with sensitive eyes
  if (concerns.includes('sensitive eyes')) {
    hypoallergenic = true;
    fragranceFree = true;
  }

  return {
    ...product,
    Is_Fragrance_Free__c: fragranceFree,
    Is_Vegan__c: vegan,
    Is_Cruelty_Free__c: crueltyFree,
    Is_Paraben_Free__c: parabenFree,
    Is_Hypoallergenic__c: hypoallergenic,
    Is_Dermatologist_Tested__c: dermatologistTested,
    Key_Ingredients__c: getKeyIngredients(product)
  };
}

// Process all existing products
const updatedRecords = data.records.map(assignPreferences);

// New niche products to add
const newProducts = [
  // Fragrance-Free Collection (SERENE)
  {
    attributes: { type: "Product2", referenceId: "FFMoisturizerDaily" },
    Name: "Pure Comfort Daily Moisturizer",
    Brand__c: "SERENE",
    Category__c: "Moisturizer",
    Price__c: 52.00,
    Description__c: "100% fragrance-free daily moisturizer for extremely sensitive and reactive skin. Formulated without any perfumes or masking agents.",
    Image_URL__c: "/assets/products/ff-moisturizer-daily.png",
    Skin_Types__c: "Sensitive;Dry;Normal",
    Concerns__c: "fragrance sensitivity;reactive skin;minimal ingredients",
    Rating__c: 4.9,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Ceramides;Squalane;Glycerin"
  },
  {
    attributes: { type: "Product2", referenceId: "FFCleanserMild" },
    Name: "Zero Fragrance Gentle Cleanser",
    Brand__c: "SERENE",
    Category__c: "Cleanser",
    Price__c: 32.00,
    Description__c: "Ultra-mild cleanser with absolutely no fragrance. Perfect for those with fragrance allergies or sensitivities.",
    Image_URL__c: "/assets/products/ff-cleanser-mild.png",
    Skin_Types__c: "Sensitive;Normal;Dry;Combination",
    Concerns__c: "fragrance sensitivity;allergies;gentle cleansing",
    Rating__c: 4.8,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Glycerin;Aloe Vera;Chamomile"
  },
  {
    attributes: { type: "Product2", referenceId: "FFSunscreenSensitive" },
    Name: "Pure Protect Mineral Sunscreen SPF 50",
    Brand__c: "SERENE",
    Category__c: "Sunscreen",
    Price__c: 42.00,
    Description__c: "Fragrance-free mineral sunscreen with zinc oxide only. Designed for the most sensitive skin types including babies.",
    Image_URL__c: "/assets/products/ff-sunscreen-sensitive.png",
    Skin_Types__c: "Sensitive;Normal;Dry",
    Concerns__c: "fragrance sensitivity;baby-safe;mineral protection",
    Rating__c: 4.7,
    Is_Travel__c: true,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Zinc Oxide;Vitamin E;Aloe Vera"
  },

  // Vegan Collection (LUMIERE)
  {
    attributes: { type: "Product2", referenceId: "VeganFoundation" },
    Name: "Plant Power Serum Foundation",
    Brand__c: "LUMIERE",
    Category__c: "Foundation",
    Price__c: 48.00,
    Description__c: "100% vegan and plant-derived serum foundation. No animal-derived ingredients or byproducts. Buildable medium coverage.",
    Image_URL__c: "/assets/products/vegan-foundation.png",
    Skin_Types__c: "Normal;Combination;Dry",
    Concerns__c: "vegan;plant-based;ethical beauty",
    Rating__c: 4.7,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: false,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Plant Squalane;Vitamin E;Jojoba Oil"
  },
  {
    attributes: { type: "Product2", referenceId: "VeganMascara" },
    Name: "Lash Love Vegan Mascara",
    Brand__c: "LUMIERE",
    Category__c: "Mascara",
    Price__c: 26.00,
    Description__c: "Vegan mascara made without beeswax or carmine. Uses plant-based waxes for volume and length.",
    Image_URL__c: "/assets/products/vegan-mascara.png",
    Skin_Types__c: "",
    Concerns__c: "vegan;no beeswax;plant-based",
    Rating__c: 4.6,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: false,
    Key_Ingredients__c: "Candelilla Wax;Rice Bran Wax;Vitamin E"
  },
  {
    attributes: { type: "Product2", referenceId: "VeganLipstick" },
    Name: "Botanical Lip Color",
    Brand__c: "LUMIERE",
    Category__c: "Lipstick",
    Price__c: 32.00,
    Description__c: "100% vegan lipstick colored with mineral pigments and fruit extracts. No carmine or animal-derived ingredients.",
    Image_URL__c: "/assets/products/vegan-lipstick.png",
    Skin_Types__c: "",
    Concerns__c: "vegan;no carmine;plant-based",
    Rating__c: 4.8,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: false,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: false,
    Is_Dermatologist_Tested__c: false,
    Key_Ingredients__c: "Shea Butter;Coconut Oil;Fruit Extracts"
  },
  {
    attributes: { type: "Product2", referenceId: "VeganBlush" },
    Name: "Garden Glow Vegan Blush",
    Brand__c: "LUMIERE",
    Category__c: "Blush",
    Price__c: 34.00,
    Description__c: "Plant-based cream blush made entirely from vegan ingredients. Natural flush from botanical extracts.",
    Image_URL__c: "/assets/products/vegan-blush.png",
    Skin_Types__c: "",
    Concerns__c: "vegan;plant-based;natural color",
    Rating__c: 4.7,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: false,
    Is_Dermatologist_Tested__c: false,
    Key_Ingredients__c: "Jojoba Oil;Plant Pigments;Vitamin E"
  },

  // Sensitive/Hypoallergenic Collection (DERMAFIX)
  {
    attributes: { type: "Product2", referenceId: "HypoMoisturizer" },
    Name: "Eczema Relief Moisturizing Cream",
    Brand__c: "DERMAFIX",
    Category__c: "Moisturizer",
    Price__c: 45.00,
    Description__c: "Hypoallergenic moisturizer specifically formulated for eczema-prone skin. Dermatologist tested and approved.",
    Image_URL__c: "/assets/products/hypo-moisturizer.png",
    Skin_Types__c: "Sensitive;Dry",
    Concerns__c: "eczema;extremely sensitive;barrier repair",
    Rating__c: 4.9,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Colloidal Oatmeal;Ceramides;Shea Butter"
  },
  {
    attributes: { type: "Product2", referenceId: "HypoCleanser" },
    Name: "Ultra-Gentle Hypoallergenic Cleanser",
    Brand__c: "DERMAFIX",
    Category__c: "Cleanser",
    Price__c: 28.00,
    Description__c: "Minimal ingredient cleanser for highly reactive and allergy-prone skin. Contains only 6 essential ingredients.",
    Image_URL__c: "/assets/products/hypo-cleanser.png",
    Skin_Types__c: "Sensitive;Normal;Dry",
    Concerns__c: "allergies;minimal ingredients;reactive skin",
    Rating__c: 4.8,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Glycerin;Water;Aloe Vera"
  },
  {
    attributes: { type: "Product2", referenceId: "HypoSerum" },
    Name: "Allergy-Safe Hydrating Serum",
    Brand__c: "DERMAFIX",
    Category__c: "Serum",
    Price__c: 52.00,
    Description__c: "Hypoallergenic serum tested on 500+ allergy-prone individuals. Zero common allergens formula.",
    Image_URL__c: "/assets/products/hypo-serum.png",
    Skin_Types__c: "Sensitive;Normal;Dry;Combination",
    Concerns__c: "allergies;zero allergens;hydration",
    Rating__c: 4.7,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Hyaluronic Acid;Glycerin;Panthenol"
  },

  // Clean Beauty / Paraben-Free Collection
  {
    attributes: { type: "Product2", referenceId: "CleanSerumAntiAge" },
    Name: "Clean Age-Defying Serum",
    Brand__c: "LUMIERE",
    Category__c: "Serum",
    Price__c: 75.00,
    Description__c: "Clean beauty anti-aging serum. Free from parabens, sulfates, phthalates, and synthetic fragrances.",
    Image_URL__c: "/assets/products/clean-serum-antiage.png",
    Skin_Types__c: "Normal;Dry;Combination",
    Concerns__c: "clean beauty;anti-aging;no parabens",
    Rating__c: 4.8,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: false,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Bakuchiol;Vitamin C;Peptides"
  },
  {
    attributes: { type: "Product2", referenceId: "CleanMoisturizerDaily" },
    Name: "Clean Slate Daily Moisturizer",
    Brand__c: "SERENE",
    Category__c: "Moisturizer",
    Price__c: 48.00,
    Description__c: "Clean formula moisturizer with only naturally-derived preservatives. No synthetic chemicals.",
    Image_URL__c: "/assets/products/clean-moisturizer-daily.png",
    Skin_Types__c: "Normal;Combination;Dry",
    Concerns__c: "clean beauty;natural preservatives;no synthetics",
    Rating__c: 4.6,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Aloe Vera;Jojoba Oil;Vitamin E"
  },

  // Pregnancy-Safe Collection
  {
    attributes: { type: "Product2", referenceId: "PregSafeMoisturizer" },
    Name: "Expecting Glow Moisturizer",
    Brand__c: "SERENE",
    Category__c: "Moisturizer",
    Price__c: 55.00,
    Description__c: "Pregnancy-safe moisturizer free from retinoids, salicylic acid, and other ingredients to avoid during pregnancy.",
    Image_URL__c: "/assets/products/preg-safe-moisturizer.png",
    Skin_Types__c: "Normal;Dry;Combination;Sensitive",
    Concerns__c: "pregnancy-safe;retinoid-free;gentle",
    Rating__c: 4.9,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Hyaluronic Acid;Vitamin E;Shea Butter"
  },
  {
    attributes: { type: "Product2", referenceId: "PregSafeSunscreen" },
    Name: "Mama Shield Mineral SPF 40",
    Brand__c: "SERENE",
    Category__c: "Sunscreen",
    Price__c: 38.00,
    Description__c: "Pregnancy-safe mineral sunscreen using only zinc oxide. No chemical filters or retinyl palmitate.",
    Image_URL__c: "/assets/products/preg-safe-sunscreen.png",
    Skin_Types__c: "Normal;Sensitive;Dry;Combination",
    Concerns__c: "pregnancy-safe;mineral-only;gentle",
    Rating__c: 4.8,
    Is_Travel__c: true,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Zinc Oxide;Vitamin E;Aloe Vera"
  },
  {
    attributes: { type: "Product2", referenceId: "PregSafeSerum" },
    Name: "Bump-Safe Brightening Serum",
    Brand__c: "LUMIERE",
    Category__c: "Serum",
    Price__c: 62.00,
    Description__c: "Pregnancy-safe brightening serum using azelaic acid and vitamin C instead of retinoids or hydroquinone.",
    Image_URL__c: "/assets/products/preg-safe-serum.png",
    Skin_Types__c: "Normal;Combination;Dry",
    Concerns__c: "pregnancy-safe;brightening;melasma",
    Rating__c: 4.7,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Azelaic Acid;Vitamin C;Niacinamide"
  },

  // Sensitive Scalp Hair Care (MAISON)
  {
    attributes: { type: "Product2", referenceId: "FFShampooSensitive" },
    Name: "Scalp Comfort Fragrance-Free Shampoo",
    Brand__c: "MAISON",
    Category__c: "Shampoo",
    Price__c: 28.00,
    Description__c: "Fragrance-free shampoo for sensitive scalps. No perfumes, dyes, or irritating sulfates.",
    Image_URL__c: "/assets/products/ff-shampoo-sensitive.png",
    Skin_Types__c: "",
    Concerns__c: "sensitive scalp;fragrance-free;gentle",
    Rating__c: 4.7,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Aloe Vera;Chamomile;Glycerin"
  },
  {
    attributes: { type: "Product2", referenceId: "FFConditionerSensitive" },
    Name: "Scalp Comfort Fragrance-Free Conditioner",
    Brand__c: "MAISON",
    Category__c: "Conditioner",
    Price__c: 30.00,
    Description__c: "Fragrance-free conditioner for sensitive scalps. Gentle formula that won't irritate.",
    Image_URL__c: "/assets/products/ff-conditioner-sensitive.png",
    Skin_Types__c: "",
    Concerns__c: "sensitive scalp;fragrance-free;gentle",
    Rating__c: 4.6,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Argan Oil;Aloe Vera;Panthenol"
  },

  // Dermatologist-Recommended Collection
  {
    attributes: { type: "Product2", referenceId: "DermRecMoisturizer" },
    Name: "Clinician's Choice Barrier Cream",
    Brand__c: "DERMAFIX",
    Category__c: "Moisturizer",
    Price__c: 58.00,
    Description__c: "Dermatologist-developed moisturizer used in clinical settings. Hospital-grade formula for post-procedure care.",
    Image_URL__c: "/assets/products/derm-rec-moisturizer.png",
    Skin_Types__c: "Sensitive;Normal;Dry;Combination",
    Concerns__c: "post-procedure;clinical-grade;healing",
    Rating__c: 4.9,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: false,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Petrolatum;Ceramides;Panthenol"
  },
  {
    attributes: { type: "Product2", referenceId: "DermRecCleanser" },
    Name: "Clinical Gentle Cleanser",
    Brand__c: "DERMAFIX",
    Category__c: "Cleanser",
    Price__c: 32.00,
    Description__c: "pH-balanced cleanser recommended by dermatologists for daily use on compromised skin.",
    Image_URL__c: "/assets/products/derm-rec-cleanser.png",
    Skin_Types__c: "Sensitive;Normal;Dry;Combination;Oily",
    Concerns__c: "pH-balanced;dermatologist recommended;gentle",
    Rating__c: 4.8,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Glycerin;Ceramides;Niacinamide"
  },

  // Additional niche products for variety
  {
    attributes: { type: "Product2", referenceId: "SensitiveEyeCream" },
    Name: "Gentle Eyes Sensitive Eye Cream",
    Brand__c: "SERENE",
    Category__c: "Eye Care",
    Price__c: 48.00,
    Description__c: "Fragrance-free, hypoallergenic eye cream for sensitive eyes. Ophthalmologist tested.",
    Image_URL__c: "/assets/products/sensitive-eye-cream.png",
    Skin_Types__c: "Sensitive;Normal;Dry",
    Concerns__c: "sensitive eyes;ophthalmologist tested;gentle",
    Rating__c: 4.7,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Caffeine;Peptides;Vitamin K"
  },
  {
    attributes: { type: "Product2", referenceId: "VeganSerumHA" },
    Name: "Plant-Pure Hyaluronic Serum",
    Brand__c: "LUMIERE",
    Category__c: "Serum",
    Price__c: 52.00,
    Description__c: "100% vegan hyaluronic acid serum. HA derived from plant fermentation, not animal sources.",
    Image_URL__c: "/assets/products/vegan-serum-ha.png",
    Skin_Types__c: "Normal;Dry;Combination;Sensitive",
    Concerns__c: "vegan;plant-derived;hydration",
    Rating__c: 4.8,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Vegan Hyaluronic Acid;Glycerin;Aloe Vera"
  },
  {
    attributes: { type: "Product2", referenceId: "FFTonerCalming" },
    Name: "Pure Calm Fragrance-Free Toner",
    Brand__c: "SERENE",
    Category__c: "Toner",
    Price__c: 28.00,
    Description__c: "Zero fragrance toner that soothes and preps sensitive skin. Alcohol-free formula.",
    Image_URL__c: "/assets/products/ff-toner-calming.png",
    Skin_Types__c: "Sensitive;Normal;Dry;Combination",
    Concerns__c: "fragrance-free;alcohol-free;calming",
    Rating__c: 4.6,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Centella Asiatica;Aloe Vera;Panthenol"
  },
  {
    attributes: { type: "Product2", referenceId: "CleanMaskHydrating" },
    Name: "Pure Glow Clean Beauty Mask",
    Brand__c: "SERENE",
    Category__c: "Mask",
    Price__c: 42.00,
    Description__c: "Clean beauty hydrating mask with only 10 ingredients. No synthetics, parabens, or fragrances.",
    Image_URL__c: "/assets/products/clean-mask-hydrating.png",
    Skin_Types__c: "Normal;Dry;Sensitive;Combination",
    Concerns__c: "clean beauty;minimal ingredients;hydration",
    Rating__c: 4.7,
    Is_Travel__c: false,
    In_Stock__c: true,
    IsActive: true,
    Is_Fragrance_Free__c: true,
    Is_Vegan__c: true,
    Is_Cruelty_Free__c: true,
    Is_Paraben_Free__c: true,
    Is_Hypoallergenic__c: true,
    Is_Dermatologist_Tested__c: true,
    Key_Ingredients__c: "Honey;Aloe Vera;Glycerin"
  }
];

// Combine updated existing products with new products
const finalRecords = [...updatedRecords, ...newProducts];

// Write updated file
const output = {
  records: finalRecords
};

writeFileSync(productPath, JSON.stringify(output, null, 2), 'utf-8');

console.log(`✓ Updated ${updatedRecords.length} existing products with preference fields`);
console.log(`✓ Added ${newProducts.length} new niche products`);
console.log(`✓ Total products: ${finalRecords.length}`);
console.log('\nNew fields added:');
console.log('  - Is_Fragrance_Free__c');
console.log('  - Is_Vegan__c');
console.log('  - Is_Cruelty_Free__c');
console.log('  - Is_Paraben_Free__c');
console.log('  - Is_Hypoallergenic__c');
console.log('  - Is_Dermatologist_Tested__c');
console.log('  - Key_Ingredients__c');
