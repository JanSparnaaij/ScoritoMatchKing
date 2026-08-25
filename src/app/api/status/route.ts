import { getLocalStatus, testApiConnections } from "@/application/services/status-service";

export async function GET() {
  const status = await getLocalStatus();
  return Response.json(status);
}

export async function POST() {
  const result = await testApiConnections();
  return Response.json(result);
}
