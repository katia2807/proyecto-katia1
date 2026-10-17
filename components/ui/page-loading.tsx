import { BrandMark } from "@/components/brand-mark";
import styles from "./page-loading.module.css";

export function PageLoading() {
  return (
    <div className={styles.screen}>
      <div className={styles.content} role="status" aria-live="polite" aria-label="Cargando información">
        <BrandMark size="large" />
        <strong>Abriendo el apartado</strong>
        <p>Estamos cargando la información.</p>
        <span className={styles.track} aria-hidden="true"><span /></span>
      </div>
    </div>
  );
}
