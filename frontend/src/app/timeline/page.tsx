"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Clock, ArrowRight, Loader2, Trash2, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTimeline, deleteTimelineEvent, TimelineResponse } from "@/lib/api";

export default function TimelinePage() {
  const router = useRouter();
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const handleViewDetails = (event: any) => {
    if (event.related_document) {
      router.push(`/ask?docId=${event.related_document}`);
    } else if (event.event_type === "chat") {
      router.push("/ask");
    } else if (event.event_type && (event.event_type.includes("sync") || event.event_type.includes("source"))) {
      router.push("/sources");
    } else if (event.event_type === "file_upload" || event.event_type === "pdf_upload") {
      router.push("/files");
    } else {
      router.push("/memory-graph");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getTimeline();
      setTimelineData(data);
    } catch (e) {
      console.error("Failed to fetch timeline", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (eventId: string) => {
    try {
      await deleteTimelineEvent(eventId);
      await fetchData(); // Refresh the timeline
    } catch (e) {
      console.error("Failed to delete timeline event", e);
    }
  };

  // Flatten events with date
  const allEvents: Array<{ date: string; event: any }> = [];
  if (timelineData) {
    for (const date of Object.keys(timelineData.events_by_date)) {
      for (const event of timelineData.events_by_date[date]) {
        allEvents.push({ date, event });
      }
    }
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-[900px] mx-auto">
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.15)',
            }}>
              <Clock size={18} style={{ color: '#fbbf24' }} />
            </div>
            <h1 className="text-2xl font-bold text-white">Timeline</h1>
          </div>
          <p className="text-sm mt-1 ml-12" style={{ color: "var(--text-secondary)" }}>
            Chronological view of your memories and events
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line with gradient */}
          <div
            className="absolute left-6 top-0 bottom-0 w-px"
            style={{
              background: "linear-gradient(180deg, rgba(124, 92, 252, 0.3), rgba(34, 211, 238, 0.15), rgba(148, 163, 184, 0.05))",
            }}
          />

          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#7c5cfc" }} />
              <p className="text-xs text-slate-500">Loading timeline...</p>
            </div>
          ) : allEvents.length === 0 ? (
            <div className="text-center py-16 rounded-2xl ml-14" style={{
              background: 'rgba(14, 14, 32, 0.3)',
              border: '1px solid rgba(148, 163, 184, 0.05)',
            }}>
              <Activity className="mx-auto mb-3 text-slate-700" size={32} />
              <p className="text-sm text-slate-500">No events yet</p>
              <p className="text-xs text-slate-600 mt-1">Start using EVOLVE AI to build your timeline!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allEvents.map(({ date, event }, i) => (
                <motion.div
                  key={event.id}
                  className="relative flex gap-5 items-start pl-14"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Dot on timeline */}
                  <div className="absolute left-[17px] top-5 z-10">
                    <div
                      className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center"
                      style={{
                        borderColor: event.color || '#7c5cfc',
                        background: "#06060e",
                        boxShadow: `0 0 12px ${event.color || '#7c5cfc'}30`,
                      }}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ background: event.color || '#7c5cfc' }} />
                    </div>
                  </div>

                  {/* Card */}
                  <motion.div
                    className="p-5 rounded-2xl flex-1 group cursor-pointer"
                    style={{
                      background: "rgba(14, 14, 32, 0.4)",
                      border: "1px solid rgba(148, 163, 184, 0.05)",
                      backdropFilter: "blur(8px)",
                    }}
                    whileHover={{
                      y: -1,
                      borderColor: `${event.color || '#7c5cfc'}20`,
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={11} className="text-slate-600" />
                        <span className="text-[11px] font-semibold" style={{ color: event.color || '#7c5cfc' }}>
                          {date}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(event.id);
                        }}
                        className="p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:bg-red-500/10"
                      >
                        <Trash2 size={13} className="text-slate-600 hover:text-red-400" />
                      </button>
                    </div>
                    <h3 className="text-sm font-semibold text-white">{event.title}</h3>
                    <p className="text-xs mt-1 text-slate-500">
                      {event.description}
                    </p>
                    <button
                      onClick={() => handleViewDetails(event)}
                      className="flex items-center gap-1.5 mt-3 text-[11px] font-medium transition-all hover:gap-2.5"
                      style={{ color: "#7c5cfc" }}
                    >
                      View details <ArrowRight size={11} />
                    </button>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
