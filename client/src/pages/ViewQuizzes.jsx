import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader'; // Import the PageHeader component
import { apiClient } from '../context/AuthContext';

function ViewQuizzes() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true); // Add loading state
  const [error, setError] = useState(null); // Add error state
  const [selectedQuizIds, setSelectedQuizIds] = useState([]);
  const [mergeError, setMergeError] = useState('');
  const [mergeSuccess, setMergeSuccess] = useState('');
  const [mergedQuizId, setMergedQuizId] = useState('');
  const [isMerging, setIsMerging] = useState(false);

  // --- Define Consistent Button Styles (Adapted for card size) ---

  // Primary (Blue - for Edit)
  const primaryButtonClasses = "bg-[#2980b9] text-white px-3 py-1 rounded text-sm hover:bg-[#2573a6] text-center transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2573a6]";

  // Secondary (Gray - for View)
  const secondaryButtonClasses = "bg-gray-300 text-gray-800 px-3 py-1 rounded text-sm hover:bg-gray-400 text-center transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400";

  // Tertiary (Red - for Delete)
  const deleteButtonClasses = "bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 text-center transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600";
  const mergeButtonClasses = "bg-emerald-600 text-white px-4 py-2 rounded text-sm hover:bg-emerald-700 text-center transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed";

  // --- End Button Styles ---

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

      if (!mergedQuiz?._id) {
        throw new Error('Merged quiz was created, but no quiz ID was returned.');
      }

      setQuizzes((currentQuizzes) => [mergedQuiz, ...currentQuizzes]);
      setSelectedQuizIds([]);
      setMergeSuccess(`Created "${mergedQuiz.title}" with ${mergedQuiz.questions?.length || 0} questions.`);
      setMergedQuizId(mergedQuiz._id);
    } catch (err) {
      console.error('Error merging quizzes:', err);
      setMergeError(err.response?.data?.message || err.message || 'Failed to merge selected quizzes.');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="p-8">
      {/* Use the PageHeader component */}
      <PageHeader title="All Quizzes" />

      {/* Loading State */}
      {loading && (
        <div className="text-center text-gray-500 py-10">
          <p className="animate-pulse">Loading quizzes...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center text-red-600 bg-red-100 p-4 rounded border border-red-300">
          <p>{error}</p>
        </div>
      )}

      {/* Quiz Grid - Only show if not loading and no error */}
      {!loading && !error && (
        <>
          {quizzes.length > 0 && (
            <section className="mb-6 border border-gray-300 rounded-lg bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800">Merge Quizzes</h2>
              <p className="text-sm text-gray-600 mt-1">
                Select two or more quizzes, then create one merged quiz with an AI-generated title and description.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <button
                  type="button"
                  className={mergeButtonClasses}
                  onClick={handleMergeSelected}
                  disabled={isMerging || selectedQuizIds.length < 2}
                >
                  {isMerging ? 'Merging...' : `Merge Selected (${selectedQuizIds.length})`}
                </button>
                <span className="text-sm text-gray-500">
                  {selectedQuizIds.length === 1 ? '1 quiz selected' : `${selectedQuizIds.length} quizzes selected`}
                </span>
              </div>
              {mergeSuccess && (
                <p className="text-sm text-green-700 mt-3">
                  {mergeSuccess}{' '}
                  {mergedQuizId && (
                    <Link className="underline hover:text-green-800" to={`/quiz/${mergedQuizId}`}>
                      View merged quiz
                    </Link>
                  )}
                </p>
              )}
              {mergeError && <p className="text-sm text-red-600 mt-3">{mergeError}</p>}
            </section>
          )}

          {quizzes.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              <p>No quizzes found. Why not <Link to="/create-quiz" className="text-blue-600 hover:underline">create one</Link>?</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => (
                <div key={quiz._id} className="border border-gray-300 rounded-lg p-4 bg-white shadow hover:shadow-md transition flex flex-col justify-between"> {/* Added border color, rounded-lg */}
                  {/* Card Content */}
                  <div>
                    <label className="inline-flex items-center gap-2 text-xs text-gray-600 mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedQuizIds.includes(quiz._id)}
                        onChange={() => toggleQuizSelection(quiz._id)}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600"
                      />
                      Select for merge
                    </label>
                    <h2 className="text-lg font-semibold text-[#2980b9] mb-1 truncate" title={quiz.title}>{quiz.title}</h2> {/* Added truncate */}
                    <p className="text-gray-600 text-sm mt-1 mb-4 line-clamp-3">{quiz.description || <span className="italic text-gray-400">No description provided.</span>}</p> {/* Added line-clamp */}
                  </div>
                  {/* Card Footer */}
                  <div>
                    <p className="text-gray-400 text-xs mb-3">{quiz.questions?.length || 0} questions</p> {/* Added null check, adjusted spacing */}
                    <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-3"> {/* Added border-t */}
                      <Link
                        to={`/quiz/${quiz._id}`}
                        // Apply the SECONDARY (Gray) style to VIEW
                        className={secondaryButtonClasses}
                      >
                        View
                      </Link>
                      <Link
                        to={`/quiz/${quiz._id}/edit`}
                        // Apply the PRIMARY (Blue) style to EDIT
                        className={primaryButtonClasses}
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(quiz._id)}
                        // Apply the TERTIARY (Red) style to DELETE
                        className={deleteButtonClasses}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ViewQuizzes;
