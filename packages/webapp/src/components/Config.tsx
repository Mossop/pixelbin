"use client";

import { createContext, useContext } from "react";

import { ApiConfig } from "@/modules/api";

const ConfigContext = createContext<ApiConfig | null>(null);

export function useConfig(): ApiConfig {
  return useContext(ConfigContext)!;
}

export default function ConfigProvider({
  config,
  children,
}: {
  config: ApiConfig;
  children: React.ReactNode;
}) {
  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  );
}
