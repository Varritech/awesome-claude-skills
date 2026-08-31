"use client";

import { useState } from "react";
import Image from "next/image";
import { Card } from "@/components/ui";
import { tutorials, type Tutorial } from "@/lib/help/tutorials";

function TutorialModal({ tutorial, onClose }: { tutorial: Tutorial; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tutorial.title}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="relative w-full max-w-2xl mx-4 bg-cf-card rounded-[20px] overflow-hidden shadow-2xl">
        {/* Video / placeholder */}
        <div className="aspect-video bg-black flex items-center justify-center">
          {tutorial.videoUrl.includes("youtube.com/embed") ? (
            <iframe
              src={tutorial.videoUrl}
              title={tutorial.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-white/30">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
              </svg>
              <p className="text-[13px]">Video coming soon</p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold text-white/30 uppercase tracking-wide mb-1">
                {tutorial.category}
              </p>
              <h2 className="text-[18px] font-bold font-heading">{tutorial.title}</h2>
              <p className="text-[13px] text-white/40 mt-2 leading-relaxed">
                {tutorial.description}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close tutorial"
              onClick={onClose}
              className="w-8 h-8 shrink-0 rounded-full bg-white/[0.06] hover:bg-white/[0.12] transition-colors flex items-center justify-center text-white/40"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TutorialsPage() {
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <a
            href="/help"
            className="text-[13px] text-white/30 hover:text-white/60 transition-colors"
          >
            Help Center
          </a>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-white/20"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          <span className="text-[13px] text-white/60">Video Tutorials</span>
        </div>
        <h1 className="text-[22px] font-bold tracking-tight font-heading">Video Tutorials</h1>
        <p className="text-[13px] text-white/25 mt-1">
          Step-by-step video walkthroughs for every ConvergeFlow feature
        </p>
      </div>

      {/* Tutorial grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tutorials.map((tutorial) => (
          <button
            key={tutorial.id}
            type="button"
            onClick={() => setActiveTutorial(tutorial)}
            className="w-full text-left group"
          >
            <Card className="p-0 overflow-hidden hover:!bg-cf-elevated transition-colors cursor-pointer">
              {/* Thumbnail */}
              <div className="relative aspect-video bg-black/40 overflow-hidden">
                <Image
                  src={tutorial.thumbnail}
                  alt={tutorial.title}
                  fill
                  className="object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                  unoptimized
                />
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-cf-orange/80 transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" className="ml-0.5">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
                {/* Duration badge */}
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-[6px] bg-black/70 text-[11px] font-bold text-white">
                  {tutorial.duration}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-wide mb-1">
                  {tutorial.category}
                </p>
                <p className="text-[14px] font-bold font-heading leading-snug">{tutorial.title}</p>
                <p className="text-[12px] text-white/35 mt-1.5 leading-relaxed line-clamp-2">
                  {tutorial.description}
                </p>
              </div>
            </Card>
          </button>
        ))}
      </div>

      {/* Modal */}
      {activeTutorial && (
        <TutorialModal tutorial={activeTutorial} onClose={() => setActiveTutorial(null)} />
      )}
    </>
  );
}
