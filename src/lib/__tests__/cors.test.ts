import { describe, expect, it } from "vitest";
import { corsMiddleware, getAllowedOrigins } from "../../../api-server/src/middleware/cors";

describe("api-server strict CORS middleware", () => {
  it("normalizes and parses allowed origins while ignoring wildcards", () => {
    process.env.ALLOWED_ORIGINS =
      "https://app.asmeepharma.com, https://asmeepharma.com, *, http://localhost:3000";
    const origins = getAllowedOrigins();

    expect(origins).toContain("https://app.asmeepharma.com");
    expect(origins).toContain("https://asmeepharma.com");
    expect(origins).toContain("http://localhost:3000");
    expect(origins).not.toContain("*");
  });

  it("passes requests through safely when no Origin header is present", () => {
    let nextCalled = false;
    const req: any = { headers: {}, method: "GET" };
    const res: any = {
      setHeader: () => {},
      status: () => res,
      json: () => res,
    };

    corsMiddleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it("sets dynamic CORS headers for whitelisted origins", () => {
    process.env.ALLOWED_ORIGINS = "https://app.asmeepharma.com";
    let nextCalled = false;
    const headersSet: Record<string, string> = {};

    const req: any = {
      headers: { origin: "https://app.asmeepharma.com" },
      method: "POST",
    };
    const res: any = {
      setHeader: (k: string, v: string) => {
        headersSet[k] = v;
      },
      status: () => res,
      json: () => res,
    };

    corsMiddleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(headersSet["Access-Control-Allow-Origin"]).toBe("https://app.asmeepharma.com");
    expect(headersSet["Access-Control-Allow-Credentials"]).toBe("true");
    expect(headersSet["Access-Control-Allow-Methods"]).toContain("GET");
    expect(headersSet["Access-Control-Allow-Methods"]).toContain("POST");
    expect(headersSet["Access-Control-Allow-Methods"]).toContain("OPTIONS");
  });

  it("terminates preflight OPTIONS requests early with HTTP 204", () => {
    process.env.ALLOWED_ORIGINS = "https://app.asmeepharma.com";
    let nextCalled = false;
    let statusCode: number | null = null;
    let ended = false;

    const req: any = {
      headers: { origin: "https://app.asmeepharma.com" },
      method: "OPTIONS",
    };
    const res: any = {
      setHeader: () => {},
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      end: () => {
        ended = true;
      },
    };

    corsMiddleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(204);
    expect(ended).toBe(true);
  });

  it("rejects unauthorized origins in production with HTTP 403", () => {
    process.env.ALLOWED_ORIGINS = "https://app.asmeepharma.com";
    process.env.STRICT_CORS = "true";

    let nextCalled = false;
    let statusCode: number | null = null;
    let jsonPayload: any = null;

    const req: any = {
      headers: { origin: "https://malicious-attacker.com" },
      method: "GET",
    };
    const res: any = {
      setHeader: () => {},
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (payload: any) => {
        jsonPayload = payload;
        return res;
      },
    };

    corsMiddleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(403);
    expect(jsonPayload?.error).toContain("Forbidden");
  });
});
