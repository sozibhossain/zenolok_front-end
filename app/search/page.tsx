"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SectionLoading } from "@/components/shared/section-loading";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { eventApi, paginateArray } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

type SearchTab = "Messages" | "System" | "All";
const SEARCH_PAGE_SIZE = 6;

export default function SearchPage() {
  const router = useRouter();
  const [activeTab] = useState<SearchTab>("Messages");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const eventsQuery = useQuery({
    queryKey: queryKeys.events({ filter: "all" }),
    queryFn: () => eventApi.getAll({ filter: "all" }),
  });

  const results = useMemo(() => {
    const events = eventsQuery.data || [];
    const q = query.toLowerCase();

    if (!q) {
      return events;
    }

    return events.filter((event) => {
      if (activeTab === "Messages") {
        return event.title.toLowerCase().includes(q) || Boolean(event.todos?.some((todo) => todo.text.toLowerCase().includes(q)));
      }

      if (activeTab === "System") {
        return event.location?.toLowerCase().includes(q);
      }

      return (
        event.title.toLowerCase().includes(q) ||
        event.location?.toLowerCase().includes(q) ||
        Boolean(event.todos?.some((todo) => todo.text.toLowerCase().includes(q)))
      );
    });
  }, [activeTab, eventsQuery.data, query]);
  const totalPages = Math.max(1, Math.ceil(results.length / SEARCH_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const paged = useMemo(() => paginateArray(results, safePage, SEARCH_PAGE_SIZE), [results, safePage]);

  return (
    <div className="space-y-4">
      <section className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-xl font-medium text-[#2E333B]">
          <ArrowLeft className="size-5" /> Search
        </button>
      </section>

      <section className="rounded-[28px] border border-[#E0E4EC] bg-[#F4F6FA] p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#979FB0]" />
            <Input
              className="h-11 rounded-xl bg-white pl-9"
              placeholder="Search by name or location"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {eventsQuery.isLoading ? (
          <SectionLoading rows={4} />
        ) : results.length ? (
          <div className="space-y-3">
            {paged.items.map((event) => (
              <Card key={event._id} className="rounded-2xl bg-[#E7EBF2] p-4 shadow-none">
                <p className="text-2xl font-semibold text-[#3A3F49]">{event.title}</p>
                <p className="text-xl text-[#5F6677]">{event.location || "No location"}</p>
                <p className="mt-1 text-sm text-[#8E95A4]">{new Date(event.startTime).toLocaleString()}</p>
              </Card>
            ))}
            <PaginationControls page={paged.page} totalPages={paged.totalPages} onPageChange={setPage} />
          </div>
        ) : (
          <EmptyState title="No search results" description="Try another keyword or switch tab." />
        )}
      </section>
    </div>
  );
}
