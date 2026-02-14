import styles from './QuestionCard.module.css';
import { Badge } from '../ui';

function CardHeader({ questionNumber, totalQuestions, topicLabel }) {
  const hasTotal = Number.isInteger(totalQuestions) && totalQuestions > 0;
  const progressValue = hasTotal
    ? Math.min(100, Math.max(0, (questionNumber / totalQuestions) * 100))
    : 0;

  return (
    <header className={styles.cardHeader}>
      <div className={styles.headerMeta}>
        <p className={styles.questionIndexText}>
          Question {questionNumber}
          {hasTotal ? ` of ${totalQuestions}` : ''}
        </p>
        {topicLabel ? <Badge className={styles.topicChip}>{topicLabel}</Badge> : null}
      </div>

      {hasTotal ? (
        <div className={styles.progressCluster}>
          <span className={styles.progressText}>{Math.round(progressValue)}%</span>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressFill} style={{ width: `${progressValue}%` }} />
          </div>
        </div>
      ) : null}
    </header>
  );
}

export default CardHeader;
