import { Router, Request, Response } from "express";
import { dbPool } from "../db.js";

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
        mr.ID AS ID,
        mr.MRName AS MRName,
        mr.EmailId AS EmailId,
        mr.MobileNo AS MobileNo,
        mr.IsInActive AS IsInActive,
        l.Division AS DivisionName,
        m.Code AS CompanyCode,
        m.Description AS CompanyName
      FROM \`pdyasvmaster\`.\`l_mktcompany_mr\` mr
      LEFT JOIN \`pdyasvmaster\`.\`l_mktcompany\` l ON mr.DivisionID = l.ID
      LEFT JOIN \`pdyasvmaster\`.\`m_mktcompany\` m ON l.CompCode = m.Code
      WHERE mr.EmailId = ? OR mr.MobileNo = ? OR mr.MRName = ?
      LIMIT 1
      `,
      [cleanInput, cleanInput, cleanInput]
    );

    const mrList = rows as any[];
    if (!mrList || mrList.length === 0) {
      res.json({ success: true, data: null });
      return;
    }

    const mr = mrList[0];
    res.json({
      success: true,
      data: {
        id: String(mr.ID),
        name: (mr.MRName || "Medical Representative").trim(),
        email: (mr.EmailId || "").trim(),
        mobile: (mr.MobileNo || "").trim(),
        division: mr.DivisionName ? String(mr.DivisionName).trim() : null,
        company: mr.CompanyName ? String(mr.CompanyName).trim() : null,
        companyCode: mr.CompanyCode ? String(mr.CompanyCode).trim() : null,
        isBlocked: Number(mr.IsInActive || 0) === 1,
        locNo: "11",
      },
    });
  } catch (error: any) {
    console.error("[Auth API] MR Lookup Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to look up MR" });
  }
});
