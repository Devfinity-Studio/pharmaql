import { Router, Request, Response } from "express";
import { dbPool } from "../db.js";
import { getOrSetCache } from "../cache.js";

export const kpiRouter = Router();

/**
 * Global Admin Dashboard KPI Counts (Cached 5 minutes)
 */
kpiRouter.get("/summary", async (_req: Request, res: Response) => {
  try {
    const summary = await getOrSetCache("admin_kpi_summary", 300, async () => {
      const [[custRows], [itemRows], [mrRows]] = await Promise.all([
        dbPool.query(`SELECT COUNT(*) as total FROM \`pdyasvmaster\`.\`m_customer\` WHERE InActive = 0`),
        dbPool.query(`SELECT COUNT(*) as total FROM \`pdyasvmaster\`.\`m_item\` WHERE InActive = 0`),
        dbPool.query(`SELECT COUNT(DISTINCT MRName) as total FROM \`pdyasvmaster\`.\`l_mktcompany_mr\` WHERE IsInActive = 0`),
      ]);

      const totalCustomers = Number((custRows as any[])?.[0]?.total || 0);
      const totalProducts = Number((itemRows as any[])?.[0]?.total || 0);
      const totalMRs = Number((mrRows as any[])?.[0]?.total || 0);

      return {
        totalCustomers,
        totalProducts,
        totalMRs,
      };
    });

    res.json({ success: true, data: summary });
  } catch (error: any) {
    console.error("[KPI API] Summary Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to load KPI summary" });
  }
});

/**
 * Admin Dashboard Stats (Counts + Manufacturer Product Breakdown)
 */
kpiRouter.get("/dashboard-stats", async (_req: Request, res: Response) => {
  try {
    const stats = await getOrSetCache("admin_dashboard_full_stats", 300, async () => {
      const [[mrRows], [companyRows], [itemRows], [mfgRows]] = await Promise.all([
        dbPool.query(`SELECT COUNT(*) AS total FROM \`pdyasvmaster\`.\`l_mktcompany_mr\` WHERE IsInActive = 0`),
        dbPool.query(`SELECT COUNT(*) AS total FROM \`pdyasvmaster\`.\`m_mktcompany\` WHERE IsInActive = 0`),
        dbPool.query(`SELECT COUNT(*) AS total FROM \`pdyasvmaster\`.\`m_item\` WHERE InActive = 0`),
        dbPool.query(`
          SELECT 
            m.Code AS manufacturer,
            m.Description AS description,
            COUNT(DISTINCT i.ID) AS totalProducts
          FROM \`pdyasvmaster\`.\`m_mktcompany\` m
          LEFT JOIN \`pdyasvmaster\`.\`l_mktcompany\` l ON m.Code = l.CompCode
          LEFT JOIN \`pdyasvmaster\`.\`m_item\` i ON i.DivisionId = l.ID AND i.InActive = 0
          WHERE m.IsInActive = 0
          GROUP BY m.Code, m.Description
          ORDER BY totalProducts DESC
          LIMIT 15
        `),
      ]);

      return {
        totalMRs: Number((mrRows as any[])?.[0]?.total || 0),
        totalCompanies: Number((companyRows as any[])?.[0]?.total || 0),
        totalItems: Number((itemRows as any[])?.[0]?.total || 0),
        manufacturerStats: (mfgRows as any[]) || [],
      };
    });

    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error("[KPI API] Dashboard Stats Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to load dashboard stats" });
  }
});
