import { useTranslation } from "react-i18next";

const PRICE_PER_ITEM = 12;

/**
 * The translated surface. Between them these keys exercise every part of the setup that
 * fails silently when it is wrong: a plain key, an interpolated key, and a real ICU
 * plural.
 */
export function Storefront({ itemCount }: { itemCount: number }) {
  const { t } = useTranslation();
  const amount = `${(itemCount * PRICE_PER_ITEM).toFixed(2)} kr`;

  return (
    <section>
      <h2>{t("cart.heading")}</h2>
      {itemCount === 0 ? (
        <p>{t("cart.empty")}</p>
      ) : (
        <>
          <p>{t("cart.count", { count: itemCount })}</p>
          <p>{t("cart.total", { amount })}</p>
          <button type="button">{t("checkout.button.pay", { amount })}</button>
        </>
      )}
    </section>
  );
}
