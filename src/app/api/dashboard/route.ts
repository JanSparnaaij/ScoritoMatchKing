import { buildDashboardView } from "@/application/services/dashboard-service";
import { container } from "@/infrastructure/di/container";

export async function GET() {
  const dashboard = await buildDashboardView({
    matchRepository: container.repositories.matchRepository,
  });
  return Response.json(dashboard);
}
