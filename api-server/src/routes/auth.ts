import { Router, Request, Response } from "express";
import { dbPool } from "../db";

export const authRouter = Router();

/**
 * MR Profile Lookup by Email or Mobile for OTP Issuance
 */
authRouter.post("/mr-lookup", async (req: Request, res: Response) => {
  try {
    const { emailOrPhone } = req.body || {};
    const cleanInput = (emailOrPhone || "").trim();

    if (!cleanInput) {
      res.status(400).json({ success: false, error: "Email or phone is required" });
      return;
    }

    const [rows] = await dbPool.query(
      `
      SELECT 
        mr.*,
        mr.ID AS ID,
        mr.MRName AS MRName,
        mr.EmailId AS EmailId,
        mr.MobileNo AS MobileNo,
        mr.JobProfile AS JobProfile,
        mr.IsInActive AS IsInActive,
        mr.DivisionID AS DivisionID,
        l.Division AS DivisionName,
        m.ID AS CompanyID,
        m.Code AS CompanyCode,
        m.Description AS CompanyName
      FROM \`pdyasvmaster\`.\`l_mktcompany_mr\` mr
      LEFT JOIN \`pdyasvmaster\`.\`l_mktcompany\` l ON mr.DivisionID = l.ID
      LEFT JOIN \`pdyasvmaster\`.\`m_mktcompany\` m ON l.CompCode = m.Code
      WHERE mr.EmailId = ? OR mr.MobileNo = ? OR mr.MRName = ?
      ORDER BY mr.ID ASC
      `,
      [cleanInput, cleanInput, cleanInput]
    );

    const mrList = rows as any[];
    if (!mrList || mrList.length === 0) {
      res.json({ success: true, data: null });
      return;
    }

    const mr = mrList[0];
    const assignments = mrList.map((item) => ({
      id: String(item.ID),
      divisionId: item.DivisionID || null,
      division: item.DivisionName ? String(item.DivisionName).trim() : null,
      companyId: item.CompanyID || null,
      companyCode: item.CompanyCode ? String(item.CompanyCode).trim() : null,
      company: item.CompanyName ? String(item.CompanyName).trim() : null,
      manufacturer: item.CompanyName ? String(item.CompanyName).trim() : (item.DivisionName || "General"),
    }));

    const allDivisions = Array.from(new Set(assignments.map((a: any) => a.division).filter(Boolean)));
    const allCompanies = Array.from(new Set(assignments.map((a: any) => a.company).filter(Boolean)));
    const allCodes = Array.from(new Set(assignments.map((a: any) => a.companyCode).filter(Boolean)));

    // Resolve rank from database across all member records without null rows defaulting to 3
    let explicitRank: 1 | 2 | 3 | null = null;
    for (const item of mrList) {
      const rawRank = item.Rank ?? item.rank ?? item.UserRank ?? item.MRRank;
      let r: 1 | 2 | 3 | null = null;
      if (rawRank !== undefined && rawRank !== null && String(rawRank).trim() !== "") {
        const parsed = Number(rawRank);
        if (parsed === 1 || parsed === 2 || parsed === 3) {
          r = parsed as 1 | 2 | 3;
        }
      } else if (item.JobProfile) {
        const jp = String(item.JobProfile).toUpperCase().trim();
        if (jp === "MR") r = 1;
        else if (jp === "ABM" || jp === "BO") r = 2;
        else if (jp === "ASM" || jp === "RSM" || jp === "ZSM" || jp === "NSM") r = 3;
      }
      if (r !== null) {
        if (explicitRank === null || r > explicitRank) {
          explicitRank = r;
        }
      }
    }
    const maxRank: 1 | 2 | 3 = explicitRank ?? 3;

    res.json({
      success: true,
      data: {
        id: String(mr.ID),
        name: (mr.MRName || "Medical Representative").trim(),
        email: (mr.EmailId || "").trim(),
        mobile: (mr.MobileNo || "").trim(),
        division: allDivisions.join(", ") || (mr.DivisionName ? String(mr.DivisionName).trim() : null),
        company: allCompanies.join(", ") || (mr.CompanyName ? String(mr.CompanyName).trim() : null),
        companyCode: allCodes.join(",") || (mr.CompanyCode ? String(mr.CompanyCode).trim() : null),
        isBlocked: mrList.every((item) => Number(item.IsInActive || 0) === 1),
        rank: maxRank,
        locNo: "11",
        assignments,
        allIds: Array.from(new Set(mrList.map((item) => String(item.ID)))),
      },
    });
  } catch (error: any) {
    console.error("[Auth API] MR Lookup Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to look up MR" });
  }
});
