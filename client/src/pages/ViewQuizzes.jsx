import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader'; // Import the PageHeader component
import { apiClient } from '../context/AuthContext';
import { Badge, Button, Card } from '../components/ui';

function ViewQuizzes() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true); // Add loading state
  const [error, setError] = useState(null); // Add error state
  const [selectedQuizIds, setSelectedQuizIds] = useState([]);
  const [mergeError, setMergeError] = useState('');
  const [mergeSuccess, setMergeSuccess] = useState('');
  const [mergedQuizId, setMergedQuizId] = useState('');
  const [isMerging, setIsMerging] = useState(false);

  useEffect(() => {
    const fetchQuizzes = async () => {
      setLoading(true); // Start loading
      setError(null); // Reset error
      try {
        const response = await apiClient.get('/quizzes');
        setQuizzes(response.data);
        setSelectedQuizIds((currentSelection) => currentSelection
          .filter((quizId) => response.data.some((quiz) => quiz._id === quizId)));
      } catch (err) {
        console.error('Error fetching quizzes:', err);
        setError('Failed to load quizzes. Please try again later.'); // Set error message
      } finally {
        setLoading(false); // End loading regardless of success/failure
      }
    };

    fetchQuizzes();
  }, []); // Empty dependency array means this runs once on mount

  const handleDelete = async (id) => {
    // Find the quiz title for the confirmation message
    const quizToDelete = quizzes.find((quiz) => quiz._id === id);
    const quizTitle = quizToDelete ? quizToDelete.title : 'this quiz';

    if (window.confirm(`Are you sure you want to delete "${quizTitle}"? This action cannot be undone.`)) {
      try {
        await apiClient.delete(`/quizzes/${id}`);
        // Update state by filtering out the deleted quiz
        setQuizzes((currentQuizzes) => currentQuizzes.filter((quiz) => quiz._id !== id));
        setSelectedQuizIds((currentSelection) => currentSelection.filter((quizId) => quizId !== id));
        // Optionally show a success message
      } catch (err) {
        console.error('Error deleting quiz:', err);
        // Show an error message to the user
        alert(`Failed to delete quiz: ${err.response?.data?.message || err.message}`);
      }
    }
  };

  const toggleQuizSelection = (quizId) => {
    setSelectedQuizIds((currentSelection) => {
      if (currentSelection.includes(quizId)) {
        return currentSelection.filter((id) => id !== quizId);
      }
      return [...currentSelection, quizId];
    });
    setMergeError('');
    setMergeSuccess('');
    setMergedQuizId('');
  };

  const handleMergeSelected = async () => {
    setMergeError('');
    setMergeSuccess('');
    setMergedQuizId('');

    if (selectedQuizIds.length < 2) {
      setMergeError('Select at least two quizzes to merge.');
      return;
    }

    if (!window.confirm(`Merge ${selectedQuizIds.length} selected quizzes into one new quiz?`)) {
      return;
    }

    try {
      setIsMerging(true);
      const response = await apiClient.post('/quizzes/merge', { quizIds: selectedQuizIds });
      const mergedQuiz = response.data?.quiz;
      const ignoredDuplicateQuestionCount = Number(response.data?.metadata?.ignoredDuplicateQuestionCount) || 0;

      if (!mergedQuiz?._id) {
        throw new Error('Merged quiz was created, but no quiz ID was returned.');
      }

      setQuizzes((currentQuizzes) => [mergedQuiz, ...currentQuizzes]);
      setSelectedQuizIds([]);
      setMergeSuccess(
        `Created "${mergedQuiz.title}" with ${mergedQuiz.questions?.length || 0} questions. `
        + `Ignored ${ignoredDuplicateQuestionCount} duplicate question${ignoredDuplicateQuestionCount === 1 ? '' : 's'}.`
      );
      setMergedQuizId(mergedQuiz._id);
    } catch (err) {
      console.error('Error merging quizzes:', err);
      setMergeError(err.response?.data?.message || err.message || 'Failed to merge selected quizzes.');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="All Quizzes"
        subtitle="Browse, manage, and merge quizzes from one consistent workspace."
      />

      {/* Loading State */}
      {loading && (
        <div className="text-center text-[var(--muted)] py-10">
          <p className="animate-pulse">Loading quizzes...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="text-center text-[var(--danger)] bg-[rgb(180_35_24_/_0.08)] border-[rgb(180_35_24_/_0.3)]">
          <p>{error}</p>
        </Card>
      )}

      {/* Quiz Grid - Only show if not loading and no error */}
      {!loading && !error && (
        <>
          {quizzes.length > 0 && (
            <Card as="section" className="mb-6">
              <h2 className="text-lg font-semibold text-[var(--text)]">Merge Quizzes</h2>
              <p className="text-sm text-[var(--muted)] mt-1">
                Select two or more quizzes, then create one merged quiz with an AI-generated title and description.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <Button
                  onClick={handleMergeSelected}
                  disabled={isMerging || selectedQuizIds.length < 2}
                >
                  {isMerging ? 'Merging...' : `Merge Selected (${selectedQuizIds.length})`}
                </Button>
                <Badge>
                  {selectedQuizIds.length === 1 ? '1 quiz selected' : `${selectedQuizIds.length} quizzes selected`}
                </Badge>
              </div>
              {mergeSuccess && (
                <p className="text-sm text-[var(--success)] mt-3">
                  {mergeSuccess}{' '}
                  {mergedQuizId && (
                    <Link className="underline hover:text-green-800" to={`/quiz/${mergedQuizId}`}>
                      View merged quiz
                    </Link>
                  )}
                </p>
              )}
              {mergeError && <p className="text-sm text-[var(--danger)] mt-3">{mergeError}</p>}
            </Card>
          )}

          {quizzes.length === 0 ? (
            <Card className="text-center text-[var(--muted)] py-10">
              <p>No quizzes found. Why not <Link to="/create-quiz" className="text-[var(--primary)] hover:underline">create one</Link>?</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => (
                <Card key={quiz._id} className="flex flex-col justify-between">
                  {/* Card Content */}
                  <div>
                    <label className="inline-flex items-center gap-2 text-xs text-[var(--muted)] mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedQuizIds.includes(quiz._id)}
                        onChange={() => toggleQuizSelection(quiz._id)}
                        className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      Select for merge
                    </label>
                    <h2 className="text-lg font-semibold text-[var(--text)] mb-1 truncate" title={quiz.title}>{quiz.title}</h2>
                    <p className="text-[var(--muted)] text-sm mt-1 mb-4 line-clamp-3">{quiz.description || <span className="italic text-gray-400">No description provided.</span>}</p>
                  </div>
                  {/* Card Footer */}
                  <div>
                    <p className="text-[var(--muted)]/80 text-xs mb-3">{quiz.questions?.length || 0} questions</p>
                    <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                      <Button
                        as={Link}
                        to={`/quiz/${quiz._id}`}
                        size="sm"
                        variant="secondary"
                      >
                        View
                      </Button>
                      <Button
                        as={Link}
                        to={`/quiz/${quiz._id}/edit`}
                        size="sm"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(quiz._id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ViewQuizzes;
