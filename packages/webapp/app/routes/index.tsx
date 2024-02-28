import { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => [{ title: "PixelBin" }];

export default function Index() {
  return "Hello";
}
