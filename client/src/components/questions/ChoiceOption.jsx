import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import styles from './ChoiceOption.module.css';

function ChoiceOption({
  id,
  name,
  letter,
  text,
  isSelected,
  onSelect,
  isDisabled,
  isSubmitted,
  isCorrect,
  isIncorrectSelection,
  isMuted,
  isShaking,
}) {
  const classNames = [styles.optionCard];

  if (isSelected) classNames.push(styles.selected);
  if (isSubmitted && isCorrect) classNames.push(styles.submittedCorrect);
  if (isSubmitted && isIncorrectSelection) classNames.push(styles.submittedIncorrect);
  if (isSubmitted && isMuted) classNames.push(styles.submittedMuted);
  if (isDisabled) classNames.push(styles.disabled);
  if (isShaking) classNames.push(styles.shake);

  let statusIcon = null;
  let statusText = '';

  if (isSubmitted && isCorrect) {
    statusIcon = <CheckCircle2 className={styles.iconCorrect} aria-hidden="true" />;
    statusText = 'Correct answer';
  } else if (isSubmitted && isIncorrectSelection) {
    statusIcon = <XCircle className={styles.iconIncorrect} aria-hidden="true" />;
    statusText = 'Incorrect selected answer';
  } else if (isSubmitted) {
    statusIcon = <Circle className={styles.iconMuted} aria-hidden="true" />;
    statusText = isSelected ? 'Selected answer' : 'Not selected';
  }

  const safeText = text?.trim() ? text : 'Empty option';

  return (
    <label className={classNames.join(' ')}>
      <input
        id={id}
        className={styles.radioInput}
        type="radio"
        name={name}
        value={safeText}
        checked={isSelected}
        onChange={onSelect}
        disabled={isDisabled}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (!isDisabled) {
              onSelect();
            }
          }
        }}
      />

      <span className={styles.letterBadge} aria-hidden="true">
        {letter}
      </span>
      <span className={styles.choiceText}>{safeText}</span>
      <span className={styles.statusIcon}>{statusIcon}</span>
      {statusText ? <span className={styles.screenReaderOnly}>{statusText}</span> : null}
    </label>
  );
}

export default ChoiceOption;
