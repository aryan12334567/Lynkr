"use client";

import dynamic from "next/dynamic";

// Client-only: the app reads saved state from localStorage on its first render.
export const ClientApp = dynamic(() => import("./LynkrApp").then((m) => m.LynkrApp), { ssr: false });
