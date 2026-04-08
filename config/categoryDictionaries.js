"use strict";

const CATEGORY_DICTIONARIES = {
  baby_kids: {
    brands: ["Pigeon", "Kodomo", "MamyPoko", "Hegen"],
    productHints: [
      "baby bottle",
      "diapers",
      "milk powder",
      "baby lotion",
      "kids snack",
      "stroller",
      "เด็ก",
      "ทารก"
    ]
  },
  beauty_skincare: {
    brands: [
      "Srichand",
      "Mizumi",
      "Cathy Doll",
      "Suu Balm",
      "Allies of Skin",
      "In2It",
      "Mistine",
      "Snailwhite",
      "Her Hyness",
      "ศรีจันทร์",
      "มิสทีน"
    ],
    productHints: [
      "serum",
      "sunscreen",
      "powder",
      "lip tint",
      "moisturizer",
      "cream",
      "cleanser",
      "toner",
      "mist",
      "บาล์ม",
      "ครีม",
      "เซรั่ม"
    ]
  },
  deals_duty_free: {
    brands: ["TWG", "Lotte", "Shilla"],
    productHints: [
      "duty free",
      "airport exclusive",
      "travel retail",
      "limited pack",
      "gift set"
    ]
  },
  electronics_gadgets: {
    brands: ["Anker", "Sony", "Xiaomi", "DJI"],
    productHints: [
      "power bank",
      "earbuds",
      "charger",
      "camera",
      "gimbal",
      "headphones",
      "smartwatch"
    ]
  },
  fashion_accessories: {
    brands: ["Charles & Keith", "Gentle Woman", "Cariuma"],
    productHints: [
      "bag",
      "wallet",
      "shirt",
      "cap",
      "sandals",
      "รองเท้า",
      "กระเป๋า"
    ]
  },
  health_pharmacy: {
    brands: ["Suu Balm", "Tiger Balm", "Vicks"],
    productHints: [
      "balm",
      "supplement",
      "vitamin",
      "pain relief",
      "pharmacy find",
      "ointment"
    ]
  },
  home_living: {
    brands: ["LocknLock", "IKEA", "Muji"],
    productHints: [
      "storage",
      "container",
      "kitchenware",
      "mug",
      "home scent",
      "linen"
    ]
  },
  luxury_designer: {
    brands: ["Chanel", "Dior", "Louis Vuitton", "Gentle Monster"],
    productHints: [
      "handbag",
      "wallet",
      "sunglasses",
      "perfume",
      "designer piece"
    ]
  },
  other: {
    brands: [],
    productHints: ["must buy", "local find", "rare", "exclusive"]
  },
  snacks_drinks: {
    brands: [
      "Bento",
      "Mama",
      "Tasto",
      "Irvins",
      "TWG",
      "Ya Kun",
      "Pocky",
      "Meiji",
      "เบนโตะ",
      "มาม่า"
    ],
    productHints: [
      "chips",
      "cookies",
      "tea",
      "kaya",
      "noodles",
      "roll",
      "snack",
      "drink",
      "cracker",
      "biscuit",
      "ขนม",
      "ชา",
      "บะหมี่"
    ]
  },
  souvenirs_local_finds: {
    brands: [],
    productHints: [
      "souvenir",
      "gift",
      "local find",
      "must buy",
      "ของฝาก",
      "rare local"
    ]
  },
  sports_outdoors: {
    brands: ["Yonex", "Decathlon", "Hydro Flask"],
    productHints: [
      "sports gear",
      "outdoor gear",
      "fitness item",
      "bottle",
      "running"
    ]
  },
  stationery_books: {
    brands: ["Midori", "Muji", "Pilot", "Zebra"],
    productHints: [
      "planner",
      "notebook",
      "pen",
      "stationery",
      "journal",
      "bookstore find"
    ]
  },
  toys_collectibles: {
    brands: ["Bandai", "Pop Mart", "Sanrio", "Pokemon"],
    productHints: [
      "figure",
      "toy",
      "blind box",
      "collectible",
      "plush",
      "model kit"
    ]
  }
};

function getCategoryDictionary(category) {
  const key = String(category || "other").toLowerCase();
  return CATEGORY_DICTIONARIES[key] || CATEGORY_DICTIONARIES.other;
}

module.exports = {
  CATEGORY_DICTIONARIES,
  getCategoryDictionary
};