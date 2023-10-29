import { Metadata } from "next";
import SidebarLayout from "./SidebarLayout";

function isNotFound(e: unknown): boolean {
  if (!(e instanceof Error)) {
    return false;
  }

  switch (e.message) {
    case "Not yet authenticated":
    case "Unauthorized":
      return true;
    default:
      return false;
  }
}

export function safeMetadata<P>(
  generateMetadata: (params: P) => Promise<Metadata>,
): (params: P) => Promise<Metadata> {
  return async (params: P): Promise<Metadata> => {
    try {
      return await generateMetadata(params);
    } catch (e) {
      if (isNotFound(e)) {
        return { title: "Not Found" };
      }

      throw e;
    }
  };
}

export function safePage<P>(
  page: (params: P) => Promise<React.ReactElement>,
): (params: P) => Promise<React.ReactElement> {
  return async (params: P) => {
    try {
      return await page(params);
    } catch (e) {
      if (isNotFound(e)) {
        return NotFound();
      }

      throw e;
    }
  };
}

function NotFound() {
  return <SidebarLayout>Not Found</SidebarLayout>;
}
