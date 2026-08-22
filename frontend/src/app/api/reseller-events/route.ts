import { NextResponse } from "next/server";

import { mockScrapedCalendar } from "@/lib/calendar";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => ({})) as { query?: string; item_interests?: string[] };
  const query = body.query || body.item_interests?.[0] || "general";
  const mock = mockScrapedCalendar(query);

  return NextResponse.json({
    area: "San Francisco Bay Area",
    search_window: "next 21 days",
    source: "mock_scraped_calendar",
    opportunities: mock.map((event) => ({
      title: event.title,
      url: event.url,
      date_and_time: event.date,
      location: event.location,
      why_it_may_be_valuable: event.why,
      likely_items: event.items,
      opportunity_score: event.score,
    })),
    notes: ["Mock-scraped Lu.ma / Eventbrite / flea calendar kept in reseller context."],
  });
}
