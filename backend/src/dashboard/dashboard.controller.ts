
import {
  BadRequestException,
  Controller,
  Get,
  Query,
} from "@nestjs/common";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  getSummary(@Query("period") period = "monthly") {
    if (period !== "monthly" && period !== "weekly") {
      throw new BadRequestException(
        "period must be monthly or weekly",
      );
    }

    return this.dashboardService.getSummary(period);
  }
}
