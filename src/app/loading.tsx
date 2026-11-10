import { Icon } from "@/components/workspace/icon";
import styles from "@/components/workspace/workspace.module.css";

export default function Loading() {
  return <div className={styles.loading} role="status"><Icon name="folder" /><span>Loading your workspace…</span></div>;
}
