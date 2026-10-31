import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getLatestRelease } from "@/lib/releases-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	try {
		const searchParams = req.nextUrl.searchParams;
		const version = searchParams.get("version");

		// Locate the compiled binary on disk if available
		const binaryLocations = [
			path.join(process.cwd(), "api-server", "dist", "api-server.exe"),
			path.join(process.cwd(), "dist", "api-server.exe"),
			path.join(process.cwd(), "public", "downloads", "api-server.exe"),
		];

		let foundPath: string | null = null;
		for (const loc of binaryLocations) {
			if (fs.existsSync(loc)) {
				foundPath = loc;
				break;
			}
		}

		if (foundPath) {
			const stat = fs.statSync(foundPath);
			const fileStream = fs.createReadStream(foundPath);

			const headers = new Headers();
			headers.set("Content-Type", "application/octet-stream");
			headers.set(
				"Content-Disposition",
				`attachment; filename="api-server${version ? `-${version}` : ""}.exe"`
			);
			headers.set("Content-Length", stat.size.toString());

			// Convert node stream to web ReadableStream
			const stream = new ReadableStream({
				start(controller) {
					fileStream.on("data", (chunk) => controller.enqueue(chunk));
					fileStream.on("end", () => controller.close());
					fileStream.on("error", (err) => controller.error(err));
				},
			});

			return new NextResponse(stream, { headers });
		}

		// If binary isn't on disk locally (e.g. cloud serverless), check release downloadUrl
		const latest = await getLatestRelease();
		if (latest && latest.downloadUrl && !latest.downloadUrl.includes("/api/releases/download")) {
			return NextResponse.redirect(latest.downloadUrl);
		}

		return NextResponse.json(
			{
				error: "Executable binary not packaged yet on this host.",
				hint: "Compile api-server via 'pnpm --filter api-server build:exe' or configure an external downloadUrl in Dev Control Center.",
			},
			{ status: 404 }
		);
	} catch (err: any) {
		console.error("[ReleasesAPI] Download error:", err);
		return NextResponse.json(
			{ error: "Failed to download release", details: err?.message },
			{ status: 500 }
		);
	}
}

