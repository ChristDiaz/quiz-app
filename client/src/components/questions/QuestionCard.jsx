import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import CardHeader from './CardHeader';
import ChoiceOption from './ChoiceOption';
import ExplanationPanel from './ExplanationPanel';
import QuestionImageLightbox from '../QuestionImageLightbox';
import styles from './QuestionCard.module.css';

const CHOICE_QUESTION_TYPES = new Set(['multiple-choice', 'image-based', 'true-false']);

const formatQuestionType = (value = '') => {
  if (!value) return '';
  if (value === 'true-false') return 'True / False';
  return value
    .split('-')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
};

const shouldUseTwoColumns = (options) =>
  options.length >= 4 && options.every((option) => (option || '').trim().length <= 42);

function QuestionCard({
  question,
  questionIndex,
  totalQuestions,
  questionId,
  selectedAnswer,
  onAnswerChange,
  isLocked,
  isChecked,
  isAnswerCorrect,
  feedback,
  actions,
  helperText,
  shakeWrongSelection,
}) {
  if (!question) {
    return null;
  }

  const questionType = question.questionType || '';
  const isChoiceQuestion = CHOICE_QUESTION_TYPES.has(questionType);
  const options = questionType === 'true-false'
    ? ['True', 'False']
    : (question.options || []).filter((option) => option !== undefined && option !== null);
  const useTwoColumns = isChoiceQuestion && shouldUseTwoColumns(options);
  const feedbackStatus = feedback?.status || 'neutral';
  const hasFeedback = Boolean(feedback);
  const feedbackClassNames = [styles.feedbackStrip];

  if (feedbackStatus === 'correct') feedbackClassNames.push(styles.feedbackCorrect);
  if (feedbackStatus === 'incorrect') feedbackClassNames.push(styles.feedbackIncorrect);
  if (feedbackStatus === 'neutral') feedbackClassNames.push(styles.feedbackNeutral);
  if (!hasFeedback) feedbackClassNames.push(styles.feedbackPlaceholder);

  let feedbackIcon = <Info className={styles.feedbackIcon} aria-hidden="true" />;
  if (feedbackStatus === 'correct') {
    feedbackIcon = <CheckCircle2 className={styles.feedbackIcon} aria-hidden="true" />;
  } else if (feedbackStatus === 'incorrect') {
    feedbackIcon = <AlertCircle className={styles.feedbackIcon} aria-hidden="true" />;
  }

  const explanationText = question.explanation || question.rationale || question.notes || '';
  const referenceText = question.reference || (question.sourcePage ? `Source page ${question.sourcePage}` : '');
  const topicLabel = question.topic || question.category || formatQuestionType(questionType);

  return (
    <section className={styles.shell}>
      <article className={styles.questionCard}>
        <CardHeader
          questionNumber={questionIndex + 1}
          totalQuestions={totalQuestions}
          topicLabel={topicLabel}
        />

        <div className={styles.questionBody}>
          <h2 className={styles.questionTitle}>{question.questionText}</h2>
          <QuestionImageLightbox
            src={question.imageUrl}
            alt={`Question ${questionIndex + 1}`}
            wrapperClassName={styles.questionImageWrapper}
            buttonClassName={styles.imageButton}
            imageClassName={styles.questionImage}
          />
        </div>

        {isChoiceQuestion ? (
          <div
            className={`${styles.choicesGrid} ${useTwoColumns ? styles.choicesGridTwoColumns : ''}`}
            role="radiogroup"
            aria-label={`Question ${questionIndex + 1} answer choices`}
          >
            {options.map((option, index) => {
              const optionText = option?.trim() ? option : '';
              const isSelected = selectedAnswer === option;
              const isCorrectChoice = isChecked && option === question.correctAnswer;
              const isIncorrectSelection = isChecked && isSelected && !isCorrectChoice;
              const isMuted = isChecked && !isSelected && !isCorrectChoice;

              return (
                <ChoiceOption
                  key={`${questionId}-choice-${index}`}
                  id={`${questionId}-choice-${index}`}
                  name={`question-${questionId}`}
                  letter={String.fromCharCode(65 + index)}
                  text={optionText}
                  isSelected={isSelected}
                  onSelect={() => onAnswerChange(option)}
                  isDisabled={isLocked}
                  isSubmitted={isChecked}
                  isCorrect={isCorrectChoice}
                  isIncorrectSelection={isIncorrectSelection}
                  isMuted={isMuted}
                  isShaking={Boolean(shakeWrongSelection && isIncorrectSelection)}
                />
              );
            })}
          </div>
        ) : (
          <div className={styles.fillInWrapper}>
            <label htmlFor={`fill-in-${questionId}`} className={styles.fillInLabel}>
              Type your answer
            </label>
            <input
              id={`fill-in-${questionId}`}
              type="text"
              className={styles.fillInInput}
              value={selectedAnswer}
              onChange={(event) => onAnswerChange(event.target.value)}
              disabled={isLocked}
              autoComplete="off"
            />
            <p className={styles.fillInHint}>
              Separate multiple acceptable answers with <code>;</code>.
            </p>
          </div>
        )}

        <footer className={styles.cardFooter}>
          <p className={styles.helperText}>{helperText}</p>
          <div className={styles.footerActions}>{actions}</div>
        </footer>

        <div
          className={feedbackClassNames.join(' ')}
          aria-live="polite"
          aria-atomic="true"
          role="status"
        >
          <span className={styles.feedbackIconWrapper}>{feedbackIcon}</span>
          <div className={styles.feedbackText}>
            <p className={styles.feedbackTitle}>{feedback?.title || 'Feedback'}</p>
            <p className={styles.feedbackMessage}>
              {feedback?.message || 'Check your answer to see correctness and review details.'}
            </p>
          </div>
        </div>

        <ExplanationPanel
          isVisible={isChecked}
          panelId={questionId}
          correctAnswer={question.correctAnswer}
          explanation={explanationText}
          reference={referenceText}
          defaultExpanded={Boolean(isChecked && !isAnswerCorrect)}
        />
      </article>
    </section>
  );
}

export default QuestionCard;
