"use client";

import AppLayout from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { Clock, ArrowRight, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getTimeline, deleteTimelineEvent, TimelineResponse } from "@/lib/api";

export default function TimelinePage() {
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
      <div className="p-8 max-w-[900px] mx-auto">
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-white">Timeline</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Chronological view of your memories and events
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div
            className="absolute left-6 top-0 bottom-0 w-px"
            style={{ background: "var(--border)" }}
          />

          {loading ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          ) : allEvents.length === 0 ? (
            <div className="text-center p-10" style={{ color: "var(--text-muted)" }}>
              No events yet — start using EVOLVE AI!
            </div>
          ) : (
            <div className="space-y-6">
              {allEvents.map(({ date, event }, i) => (
                <motion.div
                  key={event.id}
                  className="relative flex gap-6 items-start pl-14"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                >
                  {/* Dot on timeline */}
                  <div
                    className="absolute left-[18px] w-4 h-4 rounded-full border-2 z-10"
                    style={{
                      borderColor: event.color,
                      background: "var(--bg-primary)",
                      boxShadow: `0 0 10px ${event.color}44`,
                    }}
                  />

                  {/* Card */}
                  <div className="card p-5 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock size={12} style={{ color: "var(--text-muted)" }} />
                        <span className="text-[11px] font-medium" style={{ color: event.color }}>
                          {date}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(event.id);
                        }}
                        className="p-1.5 rounded-lg transition-all hover:bg-red-500/10"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Trash2 size={14} className="hover:text-red-500" />
                      </button>
                    </div>
                    <h3 className="text-sm font-semibold text-white">{event.title}</h3>
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                      {event.description}
                    </p>
                    <button
                      className="flex items-center gap-1 mt-3 text-[11px] font-medium"
                      style={{ color: "var(--accent)" }}
                    >
                      View details <ArrowRight size={11} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
