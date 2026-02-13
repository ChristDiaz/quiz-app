import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import styles from './ExplanationPanel.module.css';

function ExplanationPanel({
  isVisible,
  panelId,
  correctAnswer,
  explanation,
  reference,
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (!isVisible) {
      setExpanded(false);
      return;
    }

    setExpanded(defaultExpanded);
  }, [defaultExpanded, isVisible, panelId]);

  if (!isVisible) {
    return null;
  }

  const regionId = `explanation-region-${panelId}`;
  const cleanCorrectAnswer = correctAnswer?.trim() || 'Not available';
  const cleanExplanation = explanation?.trim();
  const cleanReference = reference?.trim();

  return (
    <section className={styles.panel}>
      <button
        type="button"
        className={styles.summaryButton}
        aria-expanded={expanded}
        aria-controls={regionId}
        onClick={() => setExpanded((previous) => !previous)}
      >
        <span className={styles.summaryText}>Answer & explanation</span>
        {expanded ? (
          <ChevronUp className={styles.chevron} aria-hidden="true" />
        ) : (
          <ChevronDown className={styles.chevron} aria-hidden="true" />
        )}
      </button>

      {expanded ? (
        <div id={regionId} className={styles.content}>
          <p className={styles.row}>
            <span className={styles.label}>Correct Answer:</span>{' '}
            <span className={styles.value}>{cleanCorrectAnswer}</span>
          </p>
          {cleanExplanation ? (
            <p className={styles.row}>
              <span className={styles.label}>Explanation:</span>{' '}
              <span className={styles.value}>{cleanExplanation}</span>
            </p>
          ) : (
            <p className={styles.row}>
              <span className={styles.label}>Explanation:</span>{' '}
              <span className={styles.valueMuted}>No explanation provided for this question.</span>
            </p>
          )}
          {cleanReference ? (
            <p className={styles.row}>
              <span className={styles.label}>Reference:</span>{' '}
              <span className={styles.value}>{cleanReference}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default ExplanationPanel;
