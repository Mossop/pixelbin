"use client";

import { createContext, useContext } from "react";

import { ApiConfig } from "@/modules/api";
import { State } from "@/modules/types";

interface IConfigContext {
  config: ApiConfig;
  state: State | undefined;
}

const ConfigContext = createContext<IConfigContext | null>(null);

export function useConfig(): ApiConfig {
  return useContext(ConfigContext)!.config;
}

export function useAppState(): State | undefined {
  return useContext(ConfigContext)?.state;
}

export default function ConfigProvider({
  config,
  children,
}: {
  config: IConfigContext;
  children: React.ReactNode;
}) {
  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  );
}
