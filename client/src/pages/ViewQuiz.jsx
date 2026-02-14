import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { BookOpen } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import CourseHeader from '../components/questions/CourseHeader';
import QuestionImageLightbox from '../components/QuestionImageLightbox';
import { Button, Card } from '../components/ui';

function ViewQuiz() {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true); // Add loading state
  const [error, setError] = useState(null); // Add error state

  useEffect(() => {
    const fetchQuiz = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`/api/quizzes/${id}`);
        setQuiz(response.data);
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setError(`Failed to load quiz: ${err.response?.data?.message || err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [id]);

  // --- Loading State ---
  if (loading) {
    return (
      <div className="text-center">
        <PageHeader title="Loading Quiz..." /> {/* Use PageHeader even for loading */}
        <div className="text-[var(--muted)] animate-pulse mt-8">Fetching quiz details...</div>
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <div>
         <PageHeader title="Error" />
         <Card className="text-center text-[var(--danger)] bg-[rgb(180_35_24_/_0.08)] border-[rgb(180_35_24_/_0.3)] mt-8">
           <p>{error}</p>
           <Link to="/view-quizzes" className="mt-4 inline-block text-blue-600 hover:underline">
             Go back to Quizzes list
           </Link>
         </Card>
      </div>
    );
  }

  // --- Quiz Not Found State ---
  if (!quiz) {
     return (
      <div>
         <PageHeader title="Quiz Not Found" />
         <Card className="text-center text-[var(--muted)] mt-8">
           <p>The quiz you are looking for could not be found.</p>
           <Link to="/view-quizzes" className="mt-4 inline-block text-blue-600 hover:underline">
             Go back to Quizzes list
           </Link>
         </Card>
      </div>
    );
  }

  const questionTypeTags = Array.from(
    new Set(
      (quiz.questions || [])
        .map((question) => question.questionType)
        .filter(Boolean)
        .map((questionType) => {
          if (questionType === 'true-false') return 'True / False';
          return questionType
            .split('-')
            .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
            .join(' ');
        }),
    ),
  );

  // --- Main Content ---
  return (
    <div className="min-h-full">
      <CourseHeader
        category="Quiz details"
        title={quiz.title}
        subtitle={quiz.description || 'Browse each question. Answers are hidden until you reveal them.'}
        tags={questionTypeTags}
      />

      {/* Questions List */}
      <div className="space-y-6"> {/* Add space between question blocks */}
        {quiz.questions?.map((q, index) => (
          <Card key={q._id || index}>
            {/* Question Text */}
            <h2 className="font-semibold text-lg text-[#102a43] mb-3">{index + 1}. {q.questionText}</h2>

            {/* Image (if applicable) */}
            <QuestionImageLightbox
              src={q.imageUrl}
              alt={`Question ${index + 1}`}
              wrapperClassName="mb-4"
              buttonClassName="w-full"
              imageClassName="w-full max-w-md rounded border border-gray-200" // Added border
            />

            {/* Options (for MC and Image-based) */}
            {(q.questionType === 'multiple-choice' || q.questionType === 'image-based') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2"> {/* Reduced gap */}
                {q.options && q.options.length > 0 && q.options.some(opt => opt?.trim() !== '') ? (
                  q.options.map((opt, i) => (
                    <div
                      key={i}
                      className="border rounded-2xl p-3 flex items-start gap-2 text-sm bg-gray-50 border-gray-200 text-gray-700"
                    >
                      <span className="font-semibold w-5 text-right flex-shrink-0 text-gray-500">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      <span>{opt || <span className="italic text-gray-400">Empty Option</span>}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 italic text-sm col-span-full">No options provided for this question.</div>
                )}
              </div>
            )}

            <details className="mt-4 pt-3 border-t border-gray-200">
              <summary className="cursor-pointer text-sm font-semibold text-[#102a43] hover:text-[#1d5f91]">
                Reveal answer and explanation
              </summary>
              <div className="mt-3 text-sm text-gray-700 space-y-2">
                <p>
                  <span className="font-semibold text-gray-800">Correct Answer:</span>{' '}
                  <span className="text-green-700 font-semibold">
                    {q.correctAnswer || <span className="italic text-gray-400">Not specified</span>}
                  </span>
                </p>
                {q.explanation && (
                  <p>
                    <span className="font-semibold text-gray-800">Explanation:</span> {q.explanation}
                  </p>
                )}
                {q.reference && (
                  <p>
                    <span className="font-semibold text-gray-800">Reference:</span> {q.reference}
                  </p>
                )}
              </div>
            </details>

          </Card> // End Question Block
        ))}
      </div>

      {/* Back Button */}
      <div className="mt-10 text-center"> {/* Increased top margin */}
        <Button
          as={Link}
          to="/view-quizzes"
        >
          <BookOpen className="w-5 h-5" />
          Back to Quizzes
        </Button>
      </div>
    </div>
  );
}

export default ViewQuiz;
