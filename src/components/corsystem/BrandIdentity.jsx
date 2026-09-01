import { COMPANY_PROFILE, companyPhoneHref } from "@/config/corsystem";
import styles from "./BrandIdentity.module.css";

export default function BrandIdentity({ variant = "default", showDetails = false, className = "" }) {
  const variantClass = styles[variant] || styles.default;
  return (
    <div className={`${styles.root} ${variantClass} ${className}`.trim()}>
      <img
        className={styles.logo}
        src={COMPANY_PROFILE.logoPath}
        alt="Logo CorSystem"
      />
      <div className={styles.copy}>
        <div className={styles.companyName}>{COMPANY_PROFILE.displayName}</div>
        <div className={styles.tagline}>{COMPANY_PROFILE.tagline}</div>
        {showDetails ? (
          <div className={styles.details}>
            <span>{COMPANY_PROFILE.address}</span>
            <span>P.IVA {COMPANY_PROFILE.vatNumber}</span>
            <a href={companyPhoneHref()}>Tel/WhatsApp {COMPANY_PROFILE.phone}</a>
            {COMPANY_PROFILE.emailHref ? (
              <a href={`mailto:${COMPANY_PROFILE.emailHref}`}>{COMPANY_PROFILE.email}</a>
            ) : (
              <span>{COMPANY_PROFILE.email}</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
