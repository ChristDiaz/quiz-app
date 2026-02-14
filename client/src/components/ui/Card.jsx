import { cn } from './cn';
import styles from './Card.module.css';

function Card({ as: Component = 'div', variant = 'default', className, children, ...props }) {
  return (
    <Component
      className={cn(
        styles.card,
        variant === 'subtle' && styles.subtle,
        variant === 'flat' && styles.flat,
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export default Card;
