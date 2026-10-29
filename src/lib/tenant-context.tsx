"use client";

import React, { createContext, useContext, type ReactNode } from "react";

export interface TenantContextValue {
	id?: string;
	slug: string;
	displayName: string;
	shortName: string;
	logoUrl: string;
	primaryColor: string;
	accentColor: string;
	address: string;
	phone: string;
	email: string;
	supportEmail: string;
	userEmailDomain: string;
	gstin: string;
	customDomain: string;
	legacyDbName: string;
	erpSoftwareType: string;
	compNo: number;
	locNo: number;
	overdueDirectBlockDays: number;
	overdueDivisionBlockDays: number;
	isDevPortal: boolean;
}

const defaultTenantContext: TenantContextValue = {
	id: "00000000-0000-0000-0000-000000000001",
	slug: "asmee",
	displayName: "Asmee Pharma Pvt. Ltd.",
	shortName: "Asmee Pharma",
	logoUrl: "/logo.png",
	primaryColor: "#0B2545",
	accentColor: "#134074",
	address: "Plot No. 12, GIDC Industrial Estate, Ankleshwar, Gujarat - 393002",
	phone: "+91 98765 43210",
	email: "info@asmeepharma.com",
	supportEmail: "asmeepharma2022@gmail.com",
	userEmailDomain: "@asmeepharma.com",
	gstin: "24AAAAA0000A1Z5",
	customDomain: "portal.asmeepharma.com",
	legacyDbName: "pdyasvmaster",
	erpSoftwareType: "Technomax",
	compNo: 11,
	locNo: 11,
	overdueDirectBlockDays: 90,
	overdueDivisionBlockDays: 95,
	isDevPortal: false,
};

const TenantContext = createContext<TenantContextValue>(defaultTenantContext);

export function TenantProvider({
	children,
	value,
}: {
	children: ReactNode;
	value?: Partial<TenantContextValue>;
}) {
	const mergedValue: TenantContextValue = {
		...defaultTenantContext,
		...(value || {}),
	};

	return (
		<TenantContext.Provider value={mergedValue}>
			{children}
		</TenantContext.Provider>
	);
}

export function useTenant(): TenantContextValue {
	return useContext(TenantContext);
}
