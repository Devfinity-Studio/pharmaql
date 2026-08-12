"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMR } from "@/server/actions/mrs";

export function AddMRButton() {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");

		const res = await createMR(name, email);
		if (res.success) {
			setOpen(false);
			setName("");
			setEmail("");
		} else {
			setError(res.error || "Failed to create MR");
		}
		setLoading(false);
	}

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger asChild>
				<Button
					className="rounded-xl px-6 py-3 font-bold shadow-sm"
					variant="default"
				>
					<Plus className="mr-2 h-4 w-4" />
					Add MR
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Add New Medical Representative</DialogTitle>
						<DialogDescription>
							Create a new MR account. They will be able to log in using OTP via
							their email address.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-4 items-center gap-4">
							<Label className="text-right" htmlFor="name">
								Name
							</Label>
							<Input
								className="col-span-3"
								id="name"
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g. John Doe"
								required
								value={name}
							/>
						</div>
						<div className="grid grid-cols-4 items-center gap-4">
							<Label className="text-right" htmlFor="email">
								Email
							</Label>
							<Input
								className="col-span-3"
								id="email"
								onChange={(e) => setEmail(e.target.value)}
								placeholder="john@example.com"
								required
								type="email"
								value={email}
							/>
						</div>
						{error && (
							<div className="col-span-4 mt-2 text-center text-red-600 text-sm">
								{error}
							</div>
						)}
					</div>
					<DialogFooter>
						<Button disabled={loading} type="submit">
							{loading ? "Adding..." : "Add MR"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
