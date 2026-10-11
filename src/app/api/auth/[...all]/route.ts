import { NextResponse } from "next/server";

export async function GET() {
	return NextResponse.json({ message: "Stateless Auth Active" });
}

export async function POST() {
	return NextResponse.json({ message: "Stateless Auth Active" });
}
