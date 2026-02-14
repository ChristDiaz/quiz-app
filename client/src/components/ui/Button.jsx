import { cn } from './cn';
import styles from './Button.module.css';

function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  className,
  children,
  ...props
}) {
  const componentProps = { ...props };

  if (Component === 'button') {
    componentProps.type = type;
    componentProps.disabled = disabled;
  } else if (disabled) {
    componentProps['aria-disabled'] = 'true';
    componentProps.tabIndex = -1;
    componentProps.onClick = (event) => {
      event.preventDefault();
    };
  }

  return (
    <Component
      className={cn(styles.button, styles[variant], styles[size], className)}
      {...componentProps}
    >
      {children}
    </Component>
  );
}

export default Button;
