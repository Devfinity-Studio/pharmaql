import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const client = new S3Client({
	endpoint: process.env.AWS_ENDPOINT_URL_S3,
	region: process.env.AWS_REGION || "ap-southeast-1",
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
	},
	forcePathStyle: true,
});

async function main() {
	const bucket = "pharmaql-tenant-logos";
	const key = "logos/asmee-logo.png";
	const fileBuffer = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));

	console.log(`Uploading public/logo.png (${fileBuffer.length} bytes) to ${bucket}/${key}...`);

	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: key,
		Body: fileBuffer,
		ContentType: "image/png",
	});

	const response = await client.send(command);
	console.log("Upload HTTP status:", response.$metadata.httpStatusCode);

	const endpoint = process.env.AWS_ENDPOINT_URL_S3.replace(/\/+$/, "");
	const publicUrl = `${endpoint}/${bucket}/${key}`;
	console.log("Public URL:", publicUrl);
}

main().catch(console.error);
