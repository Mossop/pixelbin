import { MetaFunction } from "@remix-run/node";

import SidebarLayout from "@/components/SidebarLayout";

export const meta: MetaFunction = () => [{ title: "PixelBin" }];

export default function Index() {
  return <SidebarLayout>Hello</SidebarLayout>;
}
