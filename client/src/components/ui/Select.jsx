import { useId } from 'react';
import { cn } from './cn';
import styles from './Field.module.css';

function Select({ id, label, hint, error, className, wrapperClassName, children, ...props }) {
  const autoId = useId();
  const controlId = id || `select-${autoId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn(styles.field, wrapperClassName)}>
      {label ? <label className={styles.label} htmlFor={controlId}>{label}</label> : null}
      <select
        id={controlId}
        className={cn(styles.control, error && styles.error, className)}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...props}
      >
        {children}
      </select>
      {hint ? <p id={hintId} className={styles.hint}>{hint}</p> : null}
      {error ? <p id={errorId} className={styles.errorText}>{error}</p> : null}
    </div>
  );
}

export default Select;
