export interface EventCard {
  title: string;
  url?: string;
  date?: string;
  location?: string;
  why?: string;
  items?: string[];
  score?: number;
}

interface CalendarSeed {
  keywords: string[];
  events: Omit<EventCard, "date">[];
}

function dayOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const SEEDS: CalendarSeed[] = [
  {
    keywords: ["headphone", "earbud", "audio", "sony", "beats", "speaker"],
    events: [
      {
        title: "SF Audiophile Swap Meet",
        url: "https://lu.ma/sf-audiophile-swap",
        location: "Fort Mason, San Francisco",
        why: "Attendees buy used headphones, DACs, and cables on-site. XM4/XM5 kits move fast.",
        items: ["Sony XM5", "IEMs", "headphone amps", "cases"],
        score: 86,
      },
      {
        title: "Berkeley Music Production Night",
        url: "https://www.eventbrite.com/e/berkeley-music-night",
        location: "The UC Theatre, Berkeley",
        why: "Studio-adjacent crowd — demand spike for closed-back headphones and interfaces.",
        items: ["studio headphones", "audio interfaces", "XLR cables"],
        score: 78,
      },
    ],
  },
  {
    keywords: ["bike", "bicycle", "cycling", "ebike"],
    events: [
      {
        title: "Critical Mass + Bike Swap",
        url: "https://lu.ma/sf-bike-swap",
        location: "Justin Herman Plaza, SF",
        why: "Riders pick up helmets, lights, and used frames after the ride.",
        items: ["helmets", "lights", "repair kits", "road bikes"],
        score: 88,
      },
      {
        title: "Marin Gravel Clinic",
        url: "https://www.eventbrite.com/e/marin-gravel",
        location: "Fairfax, Marin",
        why: "Gravel weekend — bottles, bags, and mid-tier bikes resell above weekday comps.",
        items: ["gravel bikes", "saddle bags", "multi-tools"],
        score: 81,
      },
    ],
  },
  {
    keywords: ["camera", "photo", "lens", "sony a", "canon", "nikon"],
    events: [
      {
        title: "Mission Night Photography Walk",
        url: "https://lu.ma/mission-photo-walk",
        location: "Mission Dolores Park, SF",
        why: "Walkers rent/buy used lenses and flashes the same week.",
        items: ["prime lenses", "flashes", "camera bags", "batteries"],
        score: 84,
      },
    ],
  },
  {
    keywords: ["furniture", "table", "chair", "sofa", "desk"],
    events: [
      {
        title: "Oakland Estate Sale Weekend",
        url: "https://www.estatesales.net/CA/Oakland",
        location: "Adams Point, Oakland",
        why: "Sourcing day for mid-century pieces; flip locally the following weekend.",
        items: ["side tables", "walnut dressers", "lamps"],
        score: 80,
      },
    ],
  },
];

const ALWAYS_ON: Omit<EventCard, "date">[] = [
  {
    title: "Alemany Flea Market",
    url: "https://sf.gov/location/alemany-farmers-market",
    location: "100 Alemany Blvd, San Francisco",
    why: "Weekly open-air resale. Good for testing list prices and unloading extras.",
    items: ["general goods", "small electronics", "housewares"],
    score: 74,
  },
  {
    title: "Alameda Point Antiques Faire (preview)",
    url: "https://alamedapointantiquesfaire.com",
    location: "Alameda Point",
    why: "First Sunday crowd pays up for cleaned, complete items. Stage inventory now.",
    items: ["vintage audio", "furniture", "decor"],
    score: 83,
  },
  {
    title: "Stanford Flea + Student Move-Out",
    url: "https://lu.ma/stanford-moveout",
    location: "Palo Alto",
    why: "Campus turnover dumps priced-to-move electronics. Buy Friday, list Sunday.",
    items: ["monitors", "mini-fridges", "headphones"],
    score: 79,
  },
];

export function mockScrapedCalendar(query: string): EventCard[] {
  const haystack = query.toLowerCase();
  const matched = SEEDS.filter((seed) => seed.keywords.some((keyword) => haystack.includes(keyword)))
    .flatMap((seed) => seed.events);
  const pool = [...matched, ...ALWAYS_ON];
  return pool.slice(0, 5).map((event, index) => ({
    ...event,
    date: dayOffset(2 + index * 3),
  }));
}
