import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "./AdminPage";

const keySet = {
  "app.title": { value: "Hii Retail corner shop", description: "The page heading" },
  "cart.count": {
    value: "{count} items",
    parameters: ["count"],
    plural: { parameter: "count", forms: { one: "{count} item", other: "{count} items" } },
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Published en-US key set, no other language published, publishes succeed. */
function service(overrides: { publish?: Response; sv?: Response } = {}) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const target = String(url);

    if (init?.method === "PUT") {
      return Promise.resolve(overrides.publish ?? json({}, 201));
    }
    if (target.includes("/language-tags")) {
      return Promise.resolve(json({ moduleId: "trs-demo-app", languageTags: ["en-US"] }));
    }
    if (target.includes("/translations/en-US")) {
      return Promise.resolve(json({ module: "trs-demo-app", entries: keySet }));
    }
    if (target.includes("/translations/sv-SE")) {
      return Promise.resolve(overrides.sv ?? json({ message: "not found" }, 404));
    }
    return Promise.reject(new TypeError(`unexpected ${target}`));
  });
}

async function chooseNewLanguage(tag: string) {
  await userEvent.selectOptions(await screen.findByLabelText("Language"), "__add__");
  await userEvent.type(screen.getByLabelText("New language tag"), tag);
}

beforeEach(() => window.history.replaceState({}, "", "/"));
afterEach(() => vi.unstubAllGlobals());

describe("AdminPage", () => {
  it("says plainly that a language cannot be deleted", async () => {
    vi.stubGlobal("fetch", service());

    render(<AdminPage tenantId={undefined} />);

    expect(
      await screen.findByText(/There is no delete: the service exposes publish only/),
    ).toBeInTheDocument();
  });

  it("rejects a bare subtag before it reaches the service", async () => {
    const fetchSpy = service();
    vi.stubGlobal("fetch", fetchSpy);

    render(<AdminPage tenantId={undefined} />);
    await chooseNewLanguage("sv");

    expect(
      screen.getByText(/must be a full RFC 5646 language tag in canonical form/),
    ).toBeInTheDocument();
    expect(
      fetchSpy.mock.calls.some(([url]) => String(url).includes("/translations/sv?")),
    ).toBe(false);
  });

  it("publishes only the keys that were translated", async () => {
    const fetchSpy = service();
    vi.stubGlobal("fetch", fetchSpy);

    render(<AdminPage tenantId={undefined} />);
    await userEvent.type(await screen.findByLabelText("IAM token"), "t0ken");
    await chooseNewLanguage("sv-SE");

    await userEvent.type(await screen.findByLabelText("Translation"), "Hii Retail närbutik");
    await userEvent.click(screen.getByRole("button", { name: /^Publish 1 key/ }));

    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());

    const put = fetchSpy.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(String(put?.[0])).toContain("/translations/sv-SE/layers/managed");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({
      // cart.count was left blank, so it stays absent rather than publishing as empty.
      entries: { "app.title": { value: "Hii Retail närbutik" } },
    });
    expect(screen.getByRole("status")).toHaveTextContent("Created sv-SE in the managed layer");
  });

  it("asks for one box per plural form and sends them together", async () => {
    const fetchSpy = service();
    vi.stubGlobal("fetch", fetchSpy);

    render(<AdminPage tenantId={undefined} />);
    await userEvent.type(await screen.findByLabelText("IAM token"), "t0ken");
    await chooseNewLanguage("sv-SE");

    await userEvent.type(await screen.findByLabelText("one"), "{{count} vara");
    // Half filled: the service would answer 422, so the page says so first.
    expect(
      screen.getByText(/Every plural form is required for sv-SE/),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("other"), "{{count} varor");
    await userEvent.click(screen.getByRole("button", { name: /^Publish 1 key/ }));

    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());

    const put = fetchSpy.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body)).entries["cart.count"]).toEqual({
      value: "{count} varor",
      plural: { forms: { one: "{count} vara", other: "{count} varor" } },
    });
  });

  it("opens on what the language already has, so a publish replaces rather than truncates", async () => {
    vi.stubGlobal(
      "fetch",
      service({
        sv: json({
          module: "trs-demo-app",
          entries: { "app.title": { value: "Hii Retail närbutik" } },
        }),
      }),
    );

    render(<AdminPage tenantId={undefined} />);
    await chooseNewLanguage("sv-SE");

    await waitFor(() =>
      expect(screen.getByLabelText("Translation")).toHaveValue("Hii Retail närbutik"),
    );
  });

  it("shows the service's own violations verbatim", async () => {
    vi.stubGlobal(
      "fetch",
      service({
        publish: json(
          { message: ["entries.app.title.parameters is owned by the default layer"] },
          422,
        ),
      }),
    );

    render(<AdminPage tenantId={undefined} />);
    await userEvent.type(await screen.findByLabelText("IAM token"), "t0ken");
    await chooseNewLanguage("sv-SE");
    await userEvent.type(await screen.findByLabelText("Translation"), "Hii Retail närbutik");
    await userEvent.click(screen.getByRole("button", { name: /^Publish 1 key/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "entries.app.title.parameters is owned by the default layer",
    );
  });

  it("keeps the token out of storage and out of the url", async () => {
    vi.stubGlobal("fetch", service());

    render(<AdminPage tenantId={undefined} />);
    await userEvent.type(await screen.findByLabelText("IAM token"), "s3cret");

    expect(screen.getByLabelText("IAM token")).toHaveAttribute("type", "password");
    expect(JSON.stringify(localStorage)).not.toContain("s3cret");
    expect(JSON.stringify(sessionStorage)).not.toContain("s3cret");
    expect(window.location.href).not.toContain("s3cret");
  });

  it("will not publish without a token", async () => {
    vi.stubGlobal("fetch", service());

    render(<AdminPage tenantId={undefined} />);
    await chooseNewLanguage("sv-SE");
    await userEvent.type(await screen.findByLabelText("Translation"), "Hii Retail närbutik");

    expect(screen.getByRole("button", { name: /^Publish 1 key/ })).toBeDisabled();
  });

  it("warns that a tenant publish follows the token, not the tenant in the url", async () => {
    vi.stubGlobal("fetch", service());

    render(<AdminPage tenantId={undefined} />);
    await userEvent.click(await screen.findByLabelText("tenant"));

    expect(
      screen.getByText(/the tenant in your token, not the \?tenant= box/),
    ).toBeInTheDocument();
  });
});
