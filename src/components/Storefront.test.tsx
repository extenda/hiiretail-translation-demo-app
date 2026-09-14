import { render, screen } from "@testing-library/react";
import i18next from "i18next";
import ICU from "i18next-icu";
import { beforeAll, describe, expect, it } from "vitest";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { Storefront } from "./Storefront";

beforeAll(async () => {
  await i18next
    .use(ICU)
    .use(initReactI18next)
    .init({
      lng: "en-US",
      keySeparator: false,
      nsSeparator: false,
      interpolation: { escapeValue: false },
      resources: {
        "en-US": {
          translation: {
            "cart.heading": "Your cart",
            "cart.count": "{count, plural, one {{count} item} other {{count} items}}",
            "cart.empty": "Your cart is empty",
            "cart.total": "Total {amount}",
            "checkout.button.pay": "Pay {amount}",
          },
        },
      },
    });
});

function renderStorefront(itemCount: number) {
  return render(
    <I18nextProvider i18n={i18next}>
      <Storefront itemCount={itemCount} />
    </I18nextProvider>,
  );
}

describe("Storefront", () => {
  it("renders a plural as text, not as raw ICU syntax", () => {
    renderStorefront(3);
    expect(screen.getByText("3 items")).toBeInTheDocument();
    expect(screen.queryByText(/plural,/)).not.toBeInTheDocument();
  });

  it("uses the singular form for one item", () => {
    renderStorefront(1);
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("shows the empty state instead of a total when the cart is empty", () => {
    renderStorefront(0);
    expect(screen.getByText("Your cart is empty")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("interpolates the amount into the pay button", () => {
    renderStorefront(2);
    expect(screen.getByRole("button")).toHaveTextContent(/Pay /);
  });
});
