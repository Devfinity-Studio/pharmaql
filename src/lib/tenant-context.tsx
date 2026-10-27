"use client";

import React, { createContext, useContext, type ReactNode } from "react";

export interface TenantContextValue {
	id?: string;
	slug: string;
	displayName: string;
	shortName: string;
	logoUrl: string;
	address: string;
	phone: string;
	email: string;
	gstin: string;
	customDomain: string;
	isDevPortal: boolean;
}

const defaultTenantContext: TenantContextValue = {
	id: "00000000-0000-0000-0000-000000000001",
	slug: "asmee",
	displayName: "Asmee Pharma Pvt. Ltd.",
	shortName: "Asmee Pharma",
	logoUrl: "/logo.png",
	address: "Plot No. 12, GIDC Industrial Estate, Ankleshwar, Gujarat - 393002",
	phone: "+91 98765 43210",
	email: "info@asmeepharma.com",
	gstin: "24AAAAA0000A1Z5",
	customDomain: "portal.asmeepharma.com",
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
