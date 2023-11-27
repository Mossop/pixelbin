import { config } from "@/modules/api";

export async function GET() {
  let apiConfig = await config();

  return Response.json(apiConfig);
}
