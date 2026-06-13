import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  products,
  sales,
  mrManufacturers,
  user,
  mrInventory,
} from "@/server/db/schema";
import { eq, inArray, and, gte, lte } from "drizzle-orm";
import * as xlsx from "xlsx";

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mrId = searchParams.get("mrId");
  const company = searchParams.get("company") || "All";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format") || "csv"; // csv or excel

  if (!mrId) {
    return new NextResponse("Missing mrId", { status: 400 });
  }

  // Authorize: Admin or the MR themselves
  const requestingUserId = session.user.id;
  const isSelf = requestingUserId === mrId;
  const isAdmin = (session.user as any).role === "admin";

  if (!isSelf && !isAdmin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Get MR Info to check permissions
  const mrInfoArr = await db
    .select()
    .from(user)
    .where(eq(user.id, mrId))
    .limit(1);
  const mrInfo = mrInfoArr[0];
  if (!mrInfo) {
    return new NextResponse("MR not found", { status: 404 });
  }

  const canViewSales = isAdmin || mrInfo.canViewSales;
  const canViewStock = isAdmin || mrInfo.canViewStock;
  const canViewFreeScheme = isAdmin || mrInfo.canViewFreeScheme;

  // Get MR's assigned manufacturers
  const assigned = await db
    .select()
    .from(mrManufacturers)
    .where(eq(mrManufacturers.mrId, mrId));
  const manufacturerNames = assigned.map((a) => a.manufacturer);
  const companiesToQuery = company === "All" ? manufacturerNames : [company];

  if (companiesToQuery.length === 0) {
    return new NextResponse("No data assigned", { status: 404 });
  }

  // Get Products
  const accessibleProducts = await db
    .select()
    .from(products)
    .where(inArray(products.manufacturer, companiesToQuery));
  const productIds = accessibleProducts.map((p) => p.id);

  if (productIds.length === 0) {
    return new NextResponse("No products found", { status: 404 });
  }

  // Fetch Stock
  const stockMap = new Map<string, number>();
  if (canViewStock) {
    const inventory = await db
      .select()
      .from(mrInventory)
      .where(
        and(
          inArray(mrInventory.productId, productIds),
          eq(mrInventory.mrId, mrId),
        ),
      );
    inventory.forEach((inv) => stockMap.set(inv.productId, inv.stock));
  }

  // Fetch Sales
  const productSalesMap = new Map<string, number>();
  if (canViewSales) {
    let salesCondition = and(
      inArray(sales.productId, productIds),
      eq(sales.mrId, mrId),
    );
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        salesCondition = and(salesCondition, gte(sales.createdAt, fromDate));
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        toDate.setUTCHours(23, 59, 59, 999);
        salesCondition = and(salesCondition, lte(sales.createdAt, toDate));
      }
    }

    const accessibleSales = await db
      .select({
        productId: sales.productId,
        quantity: sales.quantity,
      })
      .from(sales)
      .where(salesCondition);

    accessibleSales.forEach((sale) => {
      productSalesMap.set(
        sale.productId,
        (productSalesMap.get(sale.productId) || 0) + sale.quantity,
      );
    });
  }

  // Build Output Data
  const reportData = accessibleProducts.map((p) => {
    const row: any = { "Product Name": p.name };
    if (canViewFreeScheme) {
      row["Free Scheme"] = p.freeScheme || "N/A";
    }
    if (canViewStock) {
      row["Current Stock"] = stockMap.get(p.id) || 0;
    }
    if (canViewSales) {
      row["Total Sales"] = productSalesMap.get(p.id) || 0;
    }
    return row;
  });

  // Sort by Total Sales if viewable, otherwise alphabetically
  reportData.sort((a, b) => {
    if (canViewSales) {
      return (b["Total Sales"] || 0) - (a["Total Sales"] || 0);
    }
    return a["Product Name"].localeCompare(b["Product Name"]);
  });

  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `Report_${company.replace(/[^a-zA-Z0-9]/g, "_")}_${timestamp}`;

  if (format === "json") {
    return NextResponse.json(reportData);
  }

  if (format === "excel") {
    const worksheet = xlsx.utils.json_to_sheet(reportData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Report");
    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } else {
    // CSV
    if (reportData.length === 0 || !reportData[0]) {
      return new NextResponse("No data available", { status: 200 });
    }
    const headersKeys = Object.keys(reportData[0]);
    const csvContent = [
      headersKeys.join(","),
      ...reportData.map((row) =>
        headersKeys
          .map((key) => {
            const val = row[key];
            return typeof val === "string"
              ? `"${val.replace(/"/g, '""')}"`
              : val;
          })
          .join(","),
      ),
    ].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  }
}
