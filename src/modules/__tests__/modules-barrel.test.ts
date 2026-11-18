import { describe, expect, it } from "vitest";

import * as authModule from "@/modules/auth";
import * as controlPlaneModule from "@/modules/control-plane";
import * as reportsModule from "@/modules/reports";
import * as overdueModule from "@/modules/overdue";
import * as fieldMrsModule from "@/modules/field-mrs";
import * as commsModule from "@/modules/comms";
import * as devTelemetryModule from "@/modules/dev-telemetry";

describe("Domain Modules Barrel Verification", () => {
	it("should properly export auth domain actions and helpers", () => {
		expect(typeof authModule.requestMrOtp).toBe("function");
		expect(typeof authModule.verifyMrOtp).toBe("function");
		expect(typeof authModule.loginAdminOrDev).toBe("function");
		expect(typeof authModule.startMrImpersonation).toBe("function");
		expect(typeof authModule.stopMrImpersonation).toBe("function");
	});

	it("should properly export control-plane domain actions", () => {
		expect(typeof controlPlaneModule.listTenantsAction).toBe("function");
		expect(typeof controlPlaneModule.saveTenantAction).toBe("function");
		expect(typeof controlPlaneModule.getMultiTenantLicensesAction).toBe("function");
	});

	it("should properly export reports domain actions", () => {
		expect(typeof reportsModule.fetchReportQuery).toBe("function");
		expect(typeof reportsModule.fetchPartyWiseSales).toBe("function");
		expect(typeof reportsModule.getMRwisePeriodicalOutstanding).toBe("function");
	});

	it("should properly export overdue domain actions and policies", () => {
		expect(typeof overdueModule.evaluateMROverdueStatus).toBe("function");
		expect(typeof overdueModule.getOverdueBlockingStatus).toBe("function");
		expect(typeof overdueModule.getCustomerBlockingMap).toBe("function");
	});

	it("should properly export field-mrs domain actions", () => {
		expect(typeof fieldMrsModule.getMRInfo).toBe("function");
		expect(typeof fieldMrsModule.getAllMRUsers).toBe("function");
		expect(typeof fieldMrsModule.getItemCatalog).toBe("function");
	});

	it("should properly export comms domain actions", () => {
		expect(typeof commsModule.getNotices).toBe("function");
		expect(typeof commsModule.getActiveNotices).toBe("function");
		expect(typeof commsModule.submitFeedbackAction).toBe("function");
	});

	it("should properly export dev-telemetry domain actions", () => {
		expect(typeof devTelemetryModule.getServiceHealthTelemetry).toBe("function");
		expect(typeof devTelemetryModule.refreshAllCaches).toBe("function");
		expect(typeof devTelemetryModule.sendPresenceHeartbeatAction).toBe("function");
	});
});
