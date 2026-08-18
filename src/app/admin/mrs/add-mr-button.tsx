"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import { createMR } from "@/server/actions/mrs";

interface AddMRButtonProps {
	manufacturers: {
		manufacturer: string | null;
		division: string | null;
	}[];
}

export function AddMRButton({ manufacturers }: AddMRButtonProps) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	// Permissions state
	const [permissions, setPermissions] = useState({
		canViewFreeScheme: true,
		canViewStock: true,
		canViewSales: true,
		canViewPartyWise: true,
		canViewProductWise: true,
	});

	// Manufacturers state
	const [selectedMfrs, setSelectedMfrs] = useState<
		{ manufacturer: string; division: string | null }[]
	>([]);

	const handleMfrToggle = (mfr: string, div: string | null) => {
		setSelectedMfrs((prev) => {
			const exists = prev.find(
				(p) => p.manufacturer === mfr && p.division === div,
			);
			if (exists) {
				return prev.filter(
					(p) => !(p.manufacturer === mfr && p.division === div),
				);
			}
			return [...prev, { manufacturer: mfr, division: div }];
		});
	};

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError("");

		const res = await createMR(name, email, permissions, selectedMfrs);
		if (res.success) {
			setOpen(false);
			setName("");
			setEmail("");
			setSelectedMfrs([]);
			setPermissions({
				canViewFreeScheme: true,
				canViewStock: true,
				canViewSales: true,
				canViewPartyWise: true,
				canViewProductWise: true,
			});
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
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Add New Medical Representative</DialogTitle>
						<DialogDescription>
							Create a new MR, assign their permissions, and select their
							allowed companies.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-6 py-4">
						{/* Basic Info */}
						<div className="space-y-4">
							<h3 className="border-b pb-2 font-medium text-gray-900 text-sm">
								Basic Info
							</h3>
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
						</div>

						{/* Permissions */}
						<div className="space-y-4">
							<h3 className="border-b pb-2 font-medium text-gray-900 text-sm">
								Report Permissions
							</h3>
							<div className="grid grid-cols-2 gap-4">
								{Object.entries(permissions).map(([key, value]) => (
									<div className="flex items-center space-x-2" key={key}>
										<Switch
											checked={value}
											id={key}
											onCheckedChange={(checked) =>
												setPermissions((prev) => ({ ...prev, [key]: checked }))
											}
										/>
										<Label
											className="cursor-pointer font-normal text-sm"
											htmlFor={key}
										>
											{key
												.replace("canView", "View ")
												.replace(/([A-Z])/g, " $1")
												.trim()}
										</Label>
									</div>
								))}
							</div>
						</div>

						{/* Company Assignments */}
						<div className="space-y-4">
							<h3 className="border-b pb-2 font-medium text-gray-900 text-sm">
								Assign Companies
							</h3>
							<div className="grid max-h-[200px] grid-cols-1 gap-3 overflow-y-auto rounded-md border bg-gray-50 p-4 md:grid-cols-2">
								{manufacturers.map((m, idx) => {
									if (!m.manufacturer) return null;
									const isChecked = !!selectedMfrs.find(
										(p) =>
											p.manufacturer === m.manufacturer &&
											p.division === m.division,
									);
									const labelId = `mfr-${idx}`;
									return (
										<div className="flex items-start space-x-2" key={idx}>
											<Checkbox
												checked={isChecked}
												id={labelId}
												onCheckedChange={() =>
													handleMfrToggle(m.manufacturer!, m.division)
												}
											/>
											<Label
												className="cursor-pointer font-normal text-sm leading-none"
												htmlFor={labelId}
											>
												{m.manufacturer}
												{m.division ? (
													<span className="ml-1 text-gray-500 text-xs">
														({m.division})
													</span>
												) : null}
											</Label>
										</div>
									);
								})}
							</div>
						</div>

						{error && (
							<div className="mt-2 text-center font-medium text-red-600 text-sm">
								{error}
							</div>
						)}
					</div>
					<DialogFooter>
						<Button
							className="w-full sm:w-auto"
							disabled={loading}
							type="submit"
						>
							{loading ? "Adding..." : "Add MR & Assign"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
