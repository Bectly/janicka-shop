"use client";

import dynamic from "next/dynamic";
import { AnalyticsSkeleton } from "./admin-skeletons";

export const AnalyticsSection = dynamic(
  () => import("./analytics-section").then((m) => m.AnalyticsSection),
  { ssr: false, loading: () => <AnalyticsSkeleton /> },
);
