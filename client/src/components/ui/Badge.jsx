import { cn } from './cn';
import styles from './Badge.module.css';

function Badge({ variant = 'default', className, children }) {
  return <span className={cn(styles.badge, styles[variant], className)}>{children}</span>;
}

export default Badge;
